import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

let contentSign
let util

async function loadModules () {
  if (!contentSign) {
    contentSign = (await import('../../lib/contentSign.js')).default
    util = (await import('../../lib/util.js')).default
  }
}

const blockHash = (buffer) => crypto.createHash('sha256').update(buffer).digest()

// Chrome-compatible tree hash: 4096-byte blocks, sha256 per block,
// reduced 128-way until a single root remains.
function rootOf (content) {
  const buffer = Buffer.from(content)
  const blocks = []
  for (let offset = 0; offset < buffer.length; offset += 4096) {
    blocks.push(buffer.subarray(offset, Math.min(offset + 4096, buffer.length)))
  }
  if (blocks.length === 0) blocks.push(Buffer.alloc(0))
  let hashes = blocks.map(blockHash)
  const branchFactor = 4096 / 32
  while (hashes.length > 1) {
    const parents = []
    let i = 0
    while (i !== hashes.length) {
      const hash = crypto.createHash('sha256')
      for (let j = 0; j < branchFactor && i !== hashes.length; j++, i++) {
        hash.update(hashes[i])
      }
      parents.push(hash.digest())
    }
    hashes = parents
  }
  return hashes[0].toString('base64url')
}

function parsePayload (world) {
  world.payload = JSON.parse(
    Buffer.from(world.result[0].signed_content.payload, 'base64url').toString()
  )
  return world.payload
}

Given('a component directory with a private key and an id', async function () {
  await loadModules()
  this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-sign-'))
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(this.dir)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  this.privateKeyFile = path.join(this.dir, 'key.pem')
  fs.writeFileSync(this.privateKeyFile, privateKey)
  this.publicKey = publicKey.export({ type: 'spki', format: 'der' })
  this.componentId = util.getIDFromBase64PublicKey(this.publicKey.toString('base64'))
  this.componentVersion = '1.2.3'
})

Given('the component directory also contains {string}', function (file) {
  fs.mkdirpSync(path.join(this.dir, path.dirname(file)))
  fs.writeFileSync(path.join(this.dir, file), 'ignored-content')
})

When('verified contents are created with pattern {string} over an empty file {string}', async function (pattern, file) {
  await loadModules()
  fs.writeFileSync(path.join(this.dir, file), '')
  this.result = contentSign.createVerifiedContents(this.dir, [pattern], this.componentId, this.componentVersion, this.privateKeyFile)
})

When('verified contents are created over the boundary files {string} of {int} byte(s), {string} of {int} bytes and {string} of {int} bytes', async function (nameA, sizeA, nameB, sizeB, nameC, sizeC) {
  await loadModules()
  const specs = [[nameA, sizeA], [nameB, sizeB], [nameC, sizeC]]
  this.boundaryFiles = {}
  for (const [name, size] of specs) {
    const filler = name.startsWith('tiny') ? 'x' : name.startsWith('full') ? 'y' : 'z'
    fs.writeFileSync(path.join(this.dir, name), filler.repeat(size))
  }
  this.result = contentSign.createVerifiedContents(
    this.dir,
    specs.map(([name]) => name),
    this.componentId,
    this.componentVersion,
    this.privateKeyFile
  )
})

When('verified contents are created over the file {string}', async function (file) {
  await loadModules()
  fs.writeFileSync(path.join(this.dir, file), 'data')
  this.result = contentSign.createVerifiedContents(this.dir, [file], this.componentId, this.componentVersion, this.privateKeyFile)
})

When('verified contents are created with pattern {string}', async function (pattern) {
  await loadModules()
  fs.writeFileSync(path.join(this.dir, 'empty.txt'), '')
  fs.writeFileSync(path.join(this.dir, 'tiny.txt'), 'x')
  this.result = contentSign.createVerifiedContents(this.dir, [pattern], this.componentId, this.componentVersion, this.privateKeyFile)
})

When('the payload is modified', function () {
  const signedContent = this.result[0].signed_content
  const payload = JSON.parse(Buffer.from(signedContent.payload, 'base64url').toString())
  payload.item_version = '9.9.9'
  signedContent.payload = Buffer.from(JSON.stringify(payload)).toString('base64url')
})

Then('the payload lists {int} file(s)', function (count) {
  expect(parsePayload(this).content_hashes[0].files).to.have.lengthOf(count)
})

Then('the file {string} has root hash equal to sha256 of the empty buffer', function (name) {
  const entry = parsePayload(this).content_hashes[0].files.find(entry => entry.path.endsWith(name))
  expect(entry.root_hash).to.equal(blockHash(Buffer.alloc(0)).toString('base64url'))
})

Then('the root hash of {string} equals sha256 of its content', function (name) {
  const contents = { 'tiny.txt': 'x', 'full.bin': 'y'.repeat(4096) }
  const entry = parsePayload(this).content_hashes[0].files.find(entry => entry.path.endsWith(name))
  expect(entry.root_hash).to.equal(rootOf(contents[name]))
})

Then('the root hash of {string} equals sha256 of the concatenation of its block hashes', function (name) {
  const entry = parsePayload(this).content_hashes[0].files.find(entry => entry.path.endsWith(name))
  // spill.bin: 4097 bytes -> two blocks; <= 128 blocks so the root is
  // sha256 over the concatenated block hashes
  const buffer = Buffer.from('z'.repeat(4097))
  const blocks = [buffer.subarray(0, 4096), buffer.subarray(4096)]
  const expected = blockHash(Buffer.concat(blocks.map(blockHash))).toString('base64url')
  expect(entry.root_hash).to.equal(expected)
})

Then('the payload item id is the component id', function () {
  expect(parsePayload(this).item_id).to.equal(this.componentId)
})

Then('the payload item version is {string}', function (version) {
  expect(parsePayload(this).item_version).to.equal(version)
})

Then('the payload protocol version is {int}', function (version) {
  expect(parsePayload(this).protocol_version).to.equal(version)
})

Then('the single signature has protected header alg {string} and kid {string}', function (alg, kid) {
  const signedContent = this.result[0].signed_content
  expect(signedContent.signatures).to.have.lengthOf(1)
  const signature = signedContent.signatures[0]
  const protection = JSON.parse(Buffer.from(signature.protected, 'base64url').toString())
  expect(protection.alg).to.equal(alg)
  expect(signature.header.kid).to.equal(kid)
})

Then('the signature verifies against the payload with the component public key', function () {
  const signedContent = this.result[0].signed_content
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(signedContent.signatures[0].protected)
  verifier.update('.')
  verifier.update(signedContent.payload)
  const ok = verifier.verify(crypto.createPublicKey({ key: this.publicKey, format: 'der', type: 'spki' }), Buffer.from(signedContent.signatures[0].signature, 'base64url'))
  expect(ok).to.equal(true)
})

Then('the signature no longer verifies', function () {
  const signedContent = this.result[0].signed_content
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(signedContent.signatures[0].protected)
  verifier.update('.')
  verifier.update(signedContent.payload)
  const ok = verifier.verify(crypto.createPublicKey({ key: this.publicKey, format: 'der', type: 'spki' }), Buffer.from(signedContent.signatures[0].signature, 'base64url'))
  expect(ok).to.equal(false)
})

Then('exactly the files {string} are listed in the payload', function (list) {
  const paths = parsePayload(this).content_hashes[0].files.map(entry => entry.path.replace(/^\//, ''))
  expect(paths.sort()).to.deep.equal(list.split(', ').sort())
})
