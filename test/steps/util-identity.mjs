import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

let util

async function loadUtil () {
  if (!util) util = (await import('../../lib/util.js')).default
  return util
}

When('the component id is derived from a generated base64 public key', async function () {
  await loadUtil()
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  this.publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  this.componentId = util.getIDFromBase64PublicKey(this.publicKeyBase64)
})

When('the empty string is hashed with SHA-256', async function () {
  await loadUtil()
  this.hash = util.generateSHA256Hash('')
})

Given('a file containing {string}', function (content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'util-hash-'))
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(dir)
  this.payloadFile = path.join(dir, 'payload.bin')
  fs.writeFileSync(this.payloadFile, content)
})

When('the file is hashed and hashed with version {string}', async function (version) {
  await loadUtil()
  this.hash = util.generateSHA256HashOfFile(this.payloadFile)
  this.versionedHash = util.generateVersionedSHA256HashOfFile(this.payloadFile, version)
})

When('the error handlers are installed', async function () {
  await loadUtil()
  const exceptionBefore = process.listeners('uncaughtException').length
  const rejectionBefore = process.listeners('unhandledRejection').length
  util.installErrorHandlers()
  this.exceptionHandlers = process.listeners('uncaughtException').slice(exceptionBefore)
  this.rejectionHandlers = process.listeners('unhandledRejection').slice(rejectionBefore)
})

Then('the id is {int} characters from the a-p alphabet', function (length) {
  expect(this.componentId).to.have.lengthOf(length)
  expect(this.componentId).to.match(/^[a-p]{32}$/)
})

Then('deriving it again yields the same id', async function () {
  expect(util.getIDFromBase64PublicKey(this.publicKeyBase64)).to.equal(this.componentId)
})

Then('deriving from a different key yields a different id', async function () {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const otherBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  expect(util.getIDFromBase64PublicKey(otherBase64)).to.not.equal(this.componentId)
})

Then('the hash is {string}', function (expected) {
  expect(this.hash).to.equal(expected)
})

Then('the versioned hash equals sha256 of {string} and differs from the unversioned hash', function (input) {
  const expected = crypto.createHash('sha256').update(input).digest('hex')
  expect(this.versionedHash).to.equal(expected)
  expect(this.versionedHash).to.not.equal(this.hash)
})

Then('an uncaughtException handler is registered', function () {
  expect(this.exceptionHandlers.length).to.equal(1)
})

Then('an unhandledRejection handler is registered', function () {
  expect(this.rejectionHandlers.length).to.equal(1)
})

Then('invoking the uncaughtException handler exits with code {int}', function (code) {
  expect(this.exceptionHandlers.length).to.be.at.least(1)
  this.exceptionHandlers[0](new Error('trigger uncaughtException'))
  expect(mockState().scripts.exitCalls).to.include(code)
  expect(this.state.logs.some(entry => entry.level === 'error')).to.equal(true)
})

Then('invoking the unhandledRejection handler exits with code {int}', function (code) {
  expect(this.rejectionHandlers.length).to.be.at.least(1)
  this.rejectionHandlers[0](new Error('trigger unhandledRejection'))
  expect(mockState().scripts.exitCalls).to.include(code)
})

After(function () {
  for (const handler of this.exceptionHandlers || []) {
    process.removeListener('uncaughtException', handler)
  }
  for (const handler of this.rejectionHandlers || []) {
    process.removeListener('unhandledRejection', handler)
  }
})
