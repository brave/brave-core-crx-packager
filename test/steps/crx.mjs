import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import JSZip from 'jszip'
import Pbf from 'pbf'
import zlib from 'node:zlib'
import os from 'node:os'
import path from 'node:path'

const HEADER_LENGTH_OFFSET = 8
const HEADER_OFFSET = 12

const toLE32 = (num) => {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(num)
  return buffer
}

const getIDFromBinary = (buffer) => {
  // extensions have special hex encoding, see util.getIDFromBase64PublicKey
  return buffer.toString('hex').replace(/[0-9a-f]/g, (c) => {
    return 'abcdefghijklmnop'.charAt('0123456789abcdef'.indexOf(c))
  })
}

async function parseHeader (crxBuffer) {
  const { readCrxFileHeader } = await import('../../lib/crx3.pb.js')
  const headerLength = crxBuffer.readUInt32LE(HEADER_LENGTH_OFFSET)
  const headerData = crxBuffer.subarray(HEADER_OFFSET, HEADER_OFFSET + headerLength)
  return readCrxFileHeader(new Pbf(headerData))
}

Given('RSA signing keys and a staged extension directory', function () {
  this.testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crx-feature-'))
  this.contentPath = path.join(this.testDir, 'content')
  fs.mkdirSync(this.contentPath, { recursive: true })
  this.extensionKeyPath = path.join(this.testDir, 'extension-key.pem')
  this.publisherKeyPath = path.join(this.testDir, 'publisher-key.pem')
  this.publisherKeyAltPath = path.join(this.testDir, 'publisher-key-alt.pem')
  this.verifiedContentsKeyPath = path.join(this.testDir, 'verified-contents.pem')
  for (const keyPath of [this.extensionKeyPath, this.publisherKeyPath, this.publisherKeyAltPath, this.verifiedContentsKeyPath]) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    fs.writeFileSync(keyPath, privateKey)
  }
  fs.writeFileSync(path.join(this.contentPath, 'manifest.json'), '{}')
  fs.writeFileSync(path.join(this.contentPath, 'file1.js'), 'file1')
  fs.writeFileSync(path.join(this.contentPath, 'file2.html'), 'file2')
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(this.testDir)
})

When('the extension is packaged with publisher keys and verified contents', async function () {
  const crx = (await import('../../lib/crx.js')).default
  const result = await crx.generateCrx(
    this.contentPath,
    this.extensionKeyPath,
    [this.publisherKeyPath, this.publisherKeyAltPath],
    this.verifiedContentsKeyPath
  )
  this.crxBuffer = result.crx
  this.result = result
})

When('the extension is packaged with publisher keys but no verified contents key', async function () {
  const crx = (await import('../../lib/crx.js')).default
  const result = await crx.generateCrx(
    this.contentPath,
    this.extensionKeyPath,
    [this.publisherKeyPath, this.publisherKeyAltPath],
    undefined
  )
  this.crxBuffer = result.crx
})

When('the extension is packaged without publisher keys and without verified contents', async function () {
  const crx = (await import('../../lib/crx.js')).default
  const result = await crx.generateCrx(
    this.contentPath,
    this.extensionKeyPath,
    [],
    undefined
  )
  this.crxBuffer = result.crx
})

function getZipBuffer (crxBuffer) {
  const headerLength = crxBuffer.readUInt32LE(HEADER_LENGTH_OFFSET)
  return crxBuffer.subarray(HEADER_OFFSET + headerLength)
}

Then('the CRX buffer starts with magic {string} and version {int}', function (magic, version) {
  expect(this.crxBuffer.subarray(0, 4).toString()).to.equal(magic)
  expect(this.crxBuffer.readUInt32LE(4)).to.equal(version)
})

Then('the zip payload contains {string} with content {string}', async function (file, content) {
  const zip = await JSZip.loadAsync(getZipBuffer(this.crxBuffer))
  expect(await zip.files[file].async('text')).to.equal(content)
})

Then('the zipped manifest declares update url {string}', async function (updateUrl) {
  const zip = await JSZip.loadAsync(getZipBuffer(this.crxBuffer))
  const manifest = JSON.parse(await zip.files['manifest.json'].async('text'))
  expect(manifest.update_url).to.equal(updateUrl)
})

Then('the manifest key resolves to the signed CRX id', async function () {
  const util = (await import('../../lib/util.js')).default
  const { readSignedData } = await import('../../lib/crx3.pb.js')
  const zip = await JSZip.loadAsync(getZipBuffer(this.crxBuffer))
  const manifest = JSON.parse(await zip.files['manifest.json'].async('text'))
  const header = await parseHeader(this.crxBuffer)
  const signedData = readSignedData(new Pbf(header.signed_header_data))
  expect(util.getIDFromBase64PublicKey(manifest.key)).to.equal(getIDFromBinary(signedData.crx_id))
})

Then('the header embeds verified contents described as {string}', async function (description) {
  const header = await parseHeader(this.crxBuffer)
  const verifiedContents = JSON.parse(zlib.gunzipSync(header.verified_contents))[0]
  expect(verifiedContents.description).to.equal(description)
  this.verifiedContents = verifiedContents
})

Then('the verified contents payload item id matches the signed CRX id', async function () {
  const { readSignedData } = await import('../../lib/crx3.pb.js')
  const header = await parseHeader(this.crxBuffer)
  const signedData = readSignedData(new Pbf(header.signed_header_data))
  const payload = JSON.parse(
    Buffer.from(this.verifiedContents.signed_content.payload, 'base64url').toString()
  )
  expect(payload.item_id).to.equal(getIDFromBinary(signedData.crx_id))
})

Then('the verified contents carry exactly {int} signature', function (count) {
  expect(this.verifiedContents.signed_content.signatures.length).to.equal(count)
})

Then('every sha256-with-rsa proof in the header verifies', async function () {
  const header = await parseHeader(this.crxBuffer)
  const zip = getZipBuffer(this.crxBuffer)
  for (const proof of header.sha256_with_rsa) {
    const publicKey = crypto.createPublicKey({ key: proof.public_key, type: 'spki', format: 'der' })
    const verifier = crypto.createVerify('sha256')
    verifier.update(Buffer.from('CRX3 SignedData\x00', 'utf-8'))
    verifier.update(toLE32(header.signed_header_data.length))
    verifier.update(header.signed_header_data)
    verifier.update(zip)
    expect(verifier.verify(publicKey, proof.signature), 'proof failed to verify').to.equal(true)
  }
})

When('the zip payload is corrupted', function () {
  this.corrupted = Buffer.from(this.crxBuffer)
  const zip = getZipBuffer(this.corrupted)
  zip[10] = ~zip[10]
})

When('the header length byte is corrupted', function () {
  this.corrupted = Buffer.from(this.crxBuffer)
  this.corrupted[HEADER_LENGTH_OFFSET] += 1
})

When('the header body is corrupted', function () {
  this.corrupted = Buffer.from(this.crxBuffer)
  this.corrupted[HEADER_LENGTH_OFFSET + 5] += 1
})

Then('signature verification fails', async function () {
  const header = await parseHeader(this.corrupted)
  const zip = getZipBuffer(this.corrupted)
  expect(header.sha256_with_rsa.length, 'no proofs parsed').to.be.at.least(1)
  let allValid = true
  for (const proof of header.sha256_with_rsa) {
    try {
      const publicKey = crypto.createPublicKey({ key: proof.public_key, type: 'spki', format: 'der' })
      const verifier = crypto.createVerify('sha256')
      verifier.update(Buffer.from('CRX3 SignedData\x00', 'utf-8'))
      verifier.update(toLE32(header.signed_header_data.length))
      verifier.update(header.signed_header_data)
      verifier.update(zip)
      allValid = allValid && verifier.verify(publicKey, proof.signature)
    } catch {
      // an unparseable proof also fails verification
      allValid = false
    }
  }
  expect(allValid, 'all proofs unexpectedly verified').to.equal(false)
})

Then('the header has no verified contents', async function () {
  const header = await parseHeader(this.crxBuffer)
  expect(header.verified_contents).to.equal(undefined)
})
