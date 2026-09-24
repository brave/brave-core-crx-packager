import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import fc from 'fast-check'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

let adBlockRustUtils
let ZSTD_MAGIC

Given('the adblock-rust engine is available', async function () {
  adBlockRustUtils = await import('../../lib/adBlockRustUtils.js')
  ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
})

When('the following list is preprocessed:', function (doc) {
  this.preprocessed = adBlockRustUtils.preprocess({ data: doc })
})

Then('the preprocessed output is exactly:', function (doc) {
  expect(this.preprocessed.data).to.equal(doc)
})

When('a payload of IOS_VALIDATOR_ZSTD_THRESHOLD minus {int} characters is prepared for the iOS validator', async function (minus) {
  this.headers = { 'Content-Type': 'application/json' }
  this.payload = 'x'.repeat(adBlockRustUtils.IOS_VALIDATOR_ZSTD_THRESHOLD - minus)
  this.compressed = await adBlockRustUtils.maybeZstdCompressIosValidatorBody(this.payload, this.headers)
})

When('a payload of exactly IOS_VALIDATOR_ZSTD_THRESHOLD characters is prepared for the iOS validator', async function () {
  this.headers = { 'Content-Type': 'application/json' }
  this.payload = 'x'.repeat(adBlockRustUtils.IOS_VALIDATOR_ZSTD_THRESHOLD)
  this.compressed = await adBlockRustUtils.maybeZstdCompressIosValidatorBody(this.payload, this.headers)
})

When('a payload larger than IOS_VALIDATOR_ZSTD_THRESHOLD is prepared for the iOS validator', async function () {
  this.headers = { 'Content-Type': 'application/json' }
  this.payload = `{${' "k": "v",'.repeat(adBlockRustUtils.IOS_VALIDATOR_ZSTD_THRESHOLD / 10)}}`
  this.compressed = await adBlockRustUtils.maybeZstdCompressIosValidatorBody(this.payload, this.headers)
})

Then('the body is returned unchanged as a string', function () {
  expect(this.compressed).to.equal(this.payload)
  expect(typeof this.compressed).to.equal('string')
})

Then('no {string} header is set', function (header) {
  expect(this.headers[header]).to.equal(undefined)
})

Then('the body is a buffer starting with the zstd magic bytes', function () {
  expect(Buffer.isBuffer(this.compressed)).to.equal(true)
  expect(this.compressed.subarray(0, 4)).to.deep.equal(ZSTD_MAGIC)
})

Then('the {string} header is {string}', function (header, value) {
  expect(this.headers[header]).to.equal(value)
})

Then('the body decompresses back to the original payload', function () {
  const decompressed = zlib.zstdDecompressSync(this.compressed)
  expect(decompressed.toString()).to.equal(this.payload)
})

When('the corrupted elc-1.0.3814 list is sanity checked', async function () {
  const corruptedList = fs.readFileSync('./test/elc-1.0.3814-corrupted.txt', { encoding: 'utf8' })
  try {
    await adBlockRustUtils.sanityCheckList({ title: 'corrupted list', data: corruptedList, format: 'Standard' })
    this.sanityError = null
  } catch (error) {
    this.sanityError = error
  }
})

Then('the check fails with {string}', function (fragment) {
  expect(this.sanityError).to.be.an('error')
  expect(this.sanityError.message.startsWith(fragment)).to.equal(true)
})

Then('no network request was made', function () {
  expect(mockState().fetchCalls).to.have.lengthOf(0)
})

When('a {int}-rule list is sanity checked', async function (rules) {
  const data = Array.from({ length: rules }, (_, i) => `##.adblock-zstd-${i}`).join('\n')
  try {
    await adBlockRustUtils.sanityCheckList({ title: 'large list', data, format: 'Standard' })
    this.sanityError = null
  } catch (error) {
    this.sanityError = error
  }
})

Then('exactly {int} network request was made to the iOS validator', function (count) {
  const calls = mockState().fetchCalls
  expect(calls).to.have.lengthOf(count)
  if (count > 0) {
    expect(calls[0].url).to.equal('https://2sq625b43mykl2tqumoue7j4k40vkupj.lambda-url.us-west-2.on.aws')
    expect(calls[0].opts.method).to.equal('POST')
    this.validatorRequest = calls[0]
  }
})

Then('the request body is zstd-compressed JSON with rules at least IOS_VALIDATOR_ZSTD_THRESHOLD bytes long', function () {
  const init = this.validatorRequest.opts
  expect(init.headers['Content-Type']).to.equal('application/json')
  expect(init.headers['Content-Encoding']).to.equal('application/zstd')
  expect(Buffer.isBuffer(init.body)).to.equal(true)
  expect(init.body.subarray(0, 4)).to.deep.equal(ZSTD_MAGIC)
  const decompressed = zlib.zstdDecompressSync(init.body)
  const rules = JSON.parse(decompressed.toString())
  expect(Array.isArray(rules)).to.equal(true)
  expect(JSON.stringify(rules).length).to.be.at.least(adBlockRustUtils.IOS_VALIDATOR_ZSTD_THRESHOLD)
})

When('a Brave resources JSON is served from {string} as:', function (url, doc) {
  mockState().fetchRoutes.push({ match: url, status: 200, body: doc })
})

When('the resources file is generated', async function () {
  this.resourcesFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'resources-file-')), 'resourcefile')
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(path.dirname(this.resourcesFile))
  this.resourcesError = null
  try {
    await adBlockRustUtils.generateResourcesFile(this.resourcesFile)
  } catch (error) {
    this.resourcesError = error
  }
})

Then('the resources file is a JSON array with at least {int} entries', function (count) {
  expect(this.resourcesError, this.resourcesError && this.resourcesError.message).to.equal(null)
  const resources = JSON.parse(fs.readFileSync(this.resourcesFile))
  expect(Object.prototype.toString.call(resources)).to.equal('[object Array]')
  expect(resources.length).to.be.at.least(count)
  this.resources = resources
})

Then('every JavaScript entry base64-decodes to syntactically valid JS', function () {
  for (const resource of JSON.parse(fs.readFileSync(this.resourcesFile))) {
    expect(resource.kind, JSON.stringify(resource.name)).to.not.equal(undefined)
    expect(resource.kind.mime).to.not.equal(undefined)
    if (resource.kind.mime === 'application/javascript' || resource.kind.mime === 'fn/javascript') {
      const script = atob(resource.content)
      const subprocess = spawnSync('node', ['--check'], { input: script })
      expect(subprocess.status, `Resource ${resource.name} is not valid JS:\n${subprocess.stderr.toString()}\n${script}`).to.equal(0)
    }
  }
})

When('the preprocessor property holds for {int} runs', async function (runs) {
  const { preprocess } = adBlockRustUtils
  const directives = fc.constantFrom('!#if ext_ublock', '!#if env_firefox', '!#else', '!#endif', '!#if unknownvar')
  const lines = fc.array(fc.oneof(
    directives,
    fc.constant('rule##sel:remove()')
  ), { minLength: 0, maxLength: 30 })
  this.propertyHolds = true
  await fc.assert(fc.asyncProperty(lines, async (input) => {
    // A stack machine on balanced input: closing an empty stack throws, so
    // only feed inputs whose !#endif count never exceeds the open count.
    let open = 0
    let wellFormed = true
    for (const line of input) {
      if (line === '!#if ext_ublock' || line === '!#if env_firefox' || line === '!#if unknownvar') open++
      if (line === '!#else' && open === 0) wellFormed = false
      if (line === '!#endif') {
        if (open === 0) wellFormed = false
        else open--
      }
    }
    if (!wellFormed || open !== 0) return
    const { data } = preprocess({ data: input.join('\n') })
    for (const directive of ['!#if', '!#else', '!#endif']) {
      expect(data).to.not.include(directive)
    }
  }), { numRuns: runs })
})

Then('the property holds', function () {
  expect(this.propertyHolds).to.equal(true)
})
