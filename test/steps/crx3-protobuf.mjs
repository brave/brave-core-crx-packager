import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import Pbf from 'pbf'

function writeMessage (writeFn, obj) {
  const pbf = new Pbf()
  writeFn(obj, pbf)
  return Buffer.from(pbf.finish())
}

function readMessage (readFn, buffer) {
  return readFn(new Pbf(buffer))
}

function proof (i) {
  return { public_key: Buffer.from(`pk-${i}`), signature: Buffer.from(`sig-${i}`) }
}

When('signed data with crx id {string} is written and read back', async function (crxId) {
  const pb = await import('../../lib/crx3.pb.js')
  this.original = { crx_id: Buffer.from(crxId) }
  this.roundTripped = readMessage(pb.readSignedData, writeMessage(pb.writeSignedData, this.original))
})

When('a proof with public key {string} and signature {string} is written and read back', async function (publicKey, signature) {
  const pb = await import('../../lib/crx3.pb.js')
  this.original = { public_key: Buffer.from(publicKey), signature: Buffer.from(signature) }
  this.roundTrip = readMessage(pb.readAsymmetricKeyProof, writeMessage(pb.writeAsymmetricKeyProof, this.original))
})

When('a CRX file header is written with {int} rsa proofs, signed header data {string} and verified contents {string}', async function (proofCount, signedHeaderData, verifiedContents) {
  const pb = await import('../../lib/crx3.pb.js')
  this.originalHeader = {
    sha256_with_rsa: Array.from({ length: proofCount }, (_, i) => proof(i)),
    signed_header_data: Buffer.from(signedHeaderData),
    verified_contents: Buffer.from(verifiedContents)
  }
  this.roundTrippedHeader = readMessage(pb.readCrxFileHeader, writeMessage(pb.writeCrxFileHeader, this.originalHeader))
})

When('a CRX file header is written with {int} ecdsa proof and no signed data', async function (proofCount) {
  const pb = await import('../../lib/crx3.pb.js')
  this.originalHeader = {
    sha256_with_ecdsa: Array.from({ length: proofCount }, (_, i) => proof(i))
  }
  this.roundTrippedHeader = readMessage(pb.readCrxFileHeader, writeMessage(pb.writeCrxFileHeader, this.originalHeader))
})

Then('the crx id reads back as {string}', function (crxId) {
  expect(this.roundTripped.crx_id).to.deep.equal(Buffer.from(crxId))
})

Then('the proof reads back public key {string} and signature {string}', function (publicKey, signature) {
  expect(this.roundTrip.public_key).to.deep.equal(Buffer.from(publicKey))
  expect(this.roundTrip.signature).to.deep.equal(Buffer.from(signature))
})

Then('the header reads back {int} identical rsa proofs', function (proofCount) {
  expect(this.roundTrippedHeader.sha256_with_rsa).to.have.lengthOf(proofCount)
  for (let i = 0; i < proofCount; i++) {
    expect(this.roundTrippedHeader.sha256_with_rsa[i]).to.deep.equal(this.originalHeader.sha256_with_rsa[i])
  }
})

Then('the header reads back {int} identical ecdsa proof', function (proofCount) {
  expect(this.roundTrippedHeader.sha256_with_ecdsa).to.have.lengthOf(proofCount)
  for (let i = 0; i < proofCount; i++) {
    expect(this.roundTrippedHeader.sha256_with_ecdsa[i]).to.deep.equal(this.originalHeader.sha256_with_ecdsa[i])
  }
})

Then('the header signed header data reads back {string}', function (signedHeaderData) {
  expect(this.roundTrippedHeader.signed_header_data).to.deep.equal(Buffer.from(signedHeaderData))
})

Then('the header verified contents read back {string}', function (verifiedContents) {
  expect(this.roundTrippedHeader.verified_contents).to.deep.equal(Buffer.from(verifiedContents))
})

Then('the header has no signed header data', function () {
  expect(this.roundTrippedHeader.signed_header_data).to.equal(undefined)
})
