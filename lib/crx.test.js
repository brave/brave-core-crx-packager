// crx.test.js
import crx from './crx.js'
import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import JSZip from 'jszip'
import Pbf from 'pbf'
import * as crxpb from './crx3.pb.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import util from './util.js'
import zlib from 'zlib'

const generatePrivateKey = (outputPath) => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })
  fs.writeFileSync(outputPath, privateKey)
}

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

const HEADER_OFFSET = 12
const HEADER_LENGTH_OFFSET = 8

const getHeader = (crxBuffer) => {
  const headerLength = crxBuffer.readUInt32LE(HEADER_LENGTH_OFFSET)
  const headerData = crxBuffer.subarray(
    HEADER_OFFSET,
    HEADER_OFFSET + headerLength
  )
  return crxpb.readCrxFileHeader(new Pbf(headerData))
}

const getZipBuffer = (crxBuffer) => {
  const headerLength = crxBuffer.readUInt32LE(HEADER_LENGTH_OFFSET)
  // zip should be right after header.
  return crxBuffer.subarray(HEADER_OFFSET + headerLength)
}

describe('generateCrx', () => {
  const testDir = path.join('build', 'test-crx')
  fs.mkdirSync(testDir, { recursive: true })

  const contentPath = path.join(path.join(testDir, 'content'))
  fs.mkdirSync(contentPath, { recursive: true })

  const extensionKeyPath = path.join(testDir, 'extension-key.pem')
  const publisherKeyPath = path.join(testDir, 'publisher-key.pem')
  const publisherKeyAltPath = path.join(testDir, 'publisher-key-alt.pem')
  const verifiedContentsKeyPath = path.join(testDir, 'verified-contents.pem')
  let crxBuffer

  before(async () => {
    generatePrivateKey(extensionKeyPath)
    generatePrivateKey(publisherKeyPath)
    generatePrivateKey(publisherKeyAltPath)
    generatePrivateKey(verifiedContentsKeyPath)

    fs.writeFileSync(path.join(contentPath, 'manifest.json'), '{}')
    fs.writeFileSync(path.join(contentPath, 'file1.js'), 'file1')
    fs.writeFileSync(path.join(contentPath, 'file2.html'), 'file2')

    const result = await crx.generateCrx(
      contentPath,
      extensionKeyPath,
      [publisherKeyPath, publisherKeyAltPath],
      verifiedContentsKeyPath
    )
    crxBuffer = result.crx
  })

  after(() => {
    fs.removeSync(testDir, { recursive: true })
  })

  it('should have valid CRX header', () => {
    assert.equal(crxBuffer.subarray(0, 4).toString(), 'Cr24') // Magic
    assert.equal(crxBuffer.readUInt32LE(4), 3) // crx version
  })

  it('should include a valid ZIP payload', async () => {
    const zip = await JSZip.loadAsync(getZipBuffer(crxBuffer))

    const manifest = JSON.parse(await zip.files['manifest.json'].async('text'))
    assert.equal(
      manifest.update_url,
      'https://clients2.google.com/service/update2/crx'
    )

    const id = util.getIDFromBase64PublicKey(manifest.key)
    const header = getHeader(crxBuffer)
    const signedData = crxpb.readSignedData(new Pbf(header.signed_header_data))
    assert.equal(id, getIDFromBinary(signedData.crx_id))

    assert.equal('file1', await zip.files['file1.js'].async('text'))
    assert.equal('file2', await zip.files['file2.html'].async('text'))
  })

  it('should have valid verified contents', async () => {
    const header = getHeader(crxBuffer)
    const verifiedContents = JSON.parse(
      zlib.gunzipSync(header.verified_contents)
    )[0]
    assert.equal(verifiedContents.description, 'treehash per file')
    const payload = JSON.parse(
      Buffer.from(
        verifiedContents.signed_content.payload,
        'base64url'
      ).toString()
    )
    const signedData = crxpb.readSignedData(new Pbf(header.signed_header_data))
    assert.equal(payload.item_id, getIDFromBinary(signedData.crx_id))
    assert.equal(verifiedContents.signed_content.signatures.length, 1)
  })

  it('should have valid cryptographic signatures', async () => {
    const header = getHeader(crxBuffer)
    const zip = getZipBuffer(crxBuffer)

    // Verify each signature
    for (const proof of header.sha256_with_rsa) {
      const publicKey = crypto.createPublicKey({
        key: proof.public_key,
        type: 'spki',
        format: 'der'
      })
      const verifier = crypto.createVerify('sha256')

      // Reconstruct signed content
      verifier.update(Buffer.from('CRX3 SignedData\x00', 'utf-8'))
      verifier.update(toLE32(header.signed_header_data.length))
      verifier.update(header.signed_header_data)
      verifier.update(zip)

      const isValid = verifier.verify(publicKey, proof.signature)
      assert.ok(isValid)
    }
  })
})
