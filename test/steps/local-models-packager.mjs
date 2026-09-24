import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

let util

async function loadUtil () {
  if (!util) util = (await import('../../lib/util.js')).default
  return util
}

Given('a sandbox with manifests and a resource dir for component type {string}', async function (componentType) {
  await loadUtil()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-models-packager-'))
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(dir)
  this.sandbox = dir
  this.componentType = componentType

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  this.publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

  fs.mkdirpSync(path.join(dir, 'manifests', componentType))
  fs.writeFileSync(
    path.join(dir, 'manifests', componentType, 'default-manifest.json'),
    JSON.stringify({ name: 'Test Local Models', version: '0.0.0', key: this.publicKeyBase64 })
  )
  fs.mkdirpSync(path.join(dir, 'test-models'))
  fs.writeFileSync(path.join(dir, 'test-models', 'model.gguf'), 'model-bytes')
  fs.writeFileSync(path.join(dir, 'key.pem'), privateKey)

  this.recordPath = path.join(dir, 'chrome-record.jsonl')
  process.env.CRX_PACKAGER_RECORD = this.recordPath
  this.originalArgv = [...process.argv]
  this.listeners = {
    uncaughtException: process.listeners('uncaughtException').length,
    unhandledRejection: process.listeners('unhandledRejection').length
  }
  this.savedCwd = process.cwd()
  process.chdir(dir)
})

Given('the DynamoDB table has version {string} stored for the component', function (version) {
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  mockState().dynamodb.replies.QueryCommand = { value: { Items: [{ Version: { S: version } }] } }
})

When('the local models component is packaged with {string}', async function (flags) {
  await loadUtil()
  // commander v2's default export is a singleton instance — boolean flags
  // from earlier scenarios leak into later parses, so reset before parsing.
  const commanderInstance = (await import('commander')).default
  commanderInstance.localRun = undefined
  process.argv = ['node', 'script', ...flags.split(' ').filter(Boolean)]
  const packager = await import('../../lib/localModelsPackager.js')
  try {
    packager.packageLocalModelsComponent({
      componentType: this.componentType,
      resourceDir: 'test-models'
    })
    this.packageError = null
  } catch (error) {
    this.packageError = error
  }
  // the DynamoDB -> stage -> sign chain is asynchronous; wait for the
  // final console.log('Generated ...') marker (or time out)
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const generated = this.state.logs.some(log => String(log.args[0] || '').includes('Generated build/'))
    if (generated || this.packageError) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
})

Then('the staged manifest {string} declares version {string}', function (stagedManifest, version) {
  expect(JSON.parse(fs.readFileSync(stagedManifest, 'utf8')).version).to.equal(version)
})

Then('no CRX file was generated at {string}', function (crxFile) {
  expect(fs.existsSync(crxFile)).to.equal(false)
})

Then('the CRX file {string} exists', function (crxFile) {
  // packageLocalModelsComponent is synchronous but its DynamoDB chain is
  // asynchronous — poll for the signed output to appear.
  const deadline = Date.now() + 5000
  while (!fs.existsSync(crxFile) && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }
  expect(fs.existsSync(crxFile), crxFile).to.equal(true)
})

Then('chrome was invoked with {string} for the staged dir {string}', function (flag, stagedDir) {
  const records = fs.readFileSync(this.recordPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
  const argv = records.flatMap(entry => entry.argv)
  const packArg = argv.find(arg => arg.startsWith(flag))
  expect(packArg, JSON.stringify(records)).to.not.equal(undefined)
  expect(packArg.endsWith(stagedDir)).to.equal(true)
})

Then('the signing key was passed to chrome', function () {
  const records = fs.readFileSync(this.recordPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
  const argv = records.flatMap(entry => entry.argv)
  expect(argv.some(arg => arg.includes('--pack-extension-key'))).to.equal(true)
})

Then('the packaging fails with {string}', function (fragment) {
  expect(this.packageError).to.be.an('error')
  expect(this.packageError.message).to.include(fragment)
})

After(function () {
  if (this.savedCwd) {
    process.chdir(this.savedCwd)
    this.savedCwd = null
  }
  if (this.originalArgv) {
    process.argv = this.originalArgv
    this.originalArgv = null
  }
  if (this.listeners) {
    // installErrorHandlers registers one handler each — remove any added
    for (const event of ['uncaughtException', 'unhandledRejection']) {
      const listeners = process.listeners(event)
      while (listeners.length > this.listeners[event]) {
        process.removeListener(event, listeners.pop())
      }
    }
    this.listeners = null
  }
})
