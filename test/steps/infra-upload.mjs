import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { mockState } from '../support/state.mjs'

async function loadUtil () {
  if (!globalThis.__infraUtil) {
    globalThis.__infraUtil = (await import('../../lib/util.js')).default
  }
  return globalThis.__infraUtil
}

// Builds a signed fixture CRX with the pure-JS packager (fast 512-bit key).
async function buildFixture (world, name, version) {
  const util = await loadUtil()
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infra-fixture-'))
  world.tmpDirs.push(stagingDir)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  const extensionKeyFile = path.join(stagingDir, 'extension-key.pem')
  fs.writeFileSync(extensionKeyFile, privateKey)
  const manifest = {
    name: 'My Component',
    version,
    key: publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  }
  fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest))
  const crx = (await import('../../lib/crx.js')).default
  const result = await crx.generateCrx(stagingDir, extensionKeyFile, [], undefined)
  const crxFile = path.join(world.sandbox, name)
  fs.mkdirpSync(path.dirname(crxFile))
  fs.writeFileSync(crxFile, result.crx)
  world.crxFile = crxFile
  world.componentId = util.getIDFromBase64PublicKey(manifest.key)
  world.crxHash = util.generateSHA256Hash(result.crx)
}

function ensureSandbox (world) {
  if (!world.sandbox) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'infra-upload-'))
    world.tmpDirs = world.tmpDirs || []
    world.tmpDirs.push(dir)
    world.originalArgv = [...process.argv]
    world.listeners = {
      uncaughtException: process.listeners('uncaughtException').length,
      unhandledRejection: process.listeners('unhandledRejection').length
    }
    world.savedCwd = process.cwd()
    process.chdir(dir)
    world.sandbox = dir
  }
}

function setupUploadMocks (world) {
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  mockState().s3.replies.GetObjectCommand = {
    value: () => ({ Body: Readable.from([Buffer.from('previous-crx-bytes')]) })
  }
  mockState().s3.replies.HeadObjectCommand = { error: Object.assign(new Error('NotFound'), { name: 'NotFound' }) }
}

async function runInfra (world, script, flags) {
  const commanderInstance = (await import('commander')).default
  for (const flag of ['crxFile', 'crxDirectory', 'patches', 'concurrency', 'endpoint', 'region']) {
    commanderInstance[flag] = undefined
  }
  process.argv = ['node', 'script', ...flags.split(' ').filter(Boolean)]
  const packager = await import(`../../scripts/${script}`)
  try {
    await packager.main(process.argv)
    world.packageError = null
  } catch (error) {
    world.packageError = error
  }
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const done = world.state.logs.some(log => {
      const text = String(log.args[0] || '')
      return text.includes('Updated DB for') || text.includes('All patches generated.')
    })
    if (world.packageError || mockState().scripts.exitCalls.length > 0 || done) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

Given('an uploadable CRX fixture {string} with version {string}', async function (name, version) {
  ensureSandbox(this)
  await buildFixture(this, name, version)
  setupUploadMocks(this)
})

Given('a crx directory {string} with {string} and its {string} content {string} plus {string}', async function (dir, crxName, contentHashFile, contentHash, extraFile) {
  ensureSandbox(this)
  await buildFixture(this, path.join(dir, crxName), '2.0.0')
  fs.writeFileSync(path.join(this.sandbox, dir, contentHashFile), contentHash)
  fs.writeFileSync(path.join(this.sandbox, extraFile), 'notes')
  setupUploadMocks(this)
})

Given('the S3 GetObject serves the previous version body', function () {
  mockState().s3.replies.GetObjectCommand = {
    value: () => ({ Body: Readable.from([Buffer.from('previous-crx-bytes')]) })
  }
})

When('the infra upload runs with crx file {string}', async function (crxFile) {
  await runInfra(this, 'uploadComponent.js', `--crx-file ${crxFile}`)
})

When('the infra upload runs with {string}', async function (flags) {
  await runInfra(this, 'uploadComponent.js', flags)
})

When('the CRX upload is attempted with {string}', async function (flags) {
  await runInfra(this, 'uploadComponent.js', flags)
})

Then('the infra run fails with {string}', function (fragment) {
  expect(this.packageError).to.be.an('error')
  expect(this.packageError.message).to.include(fragment)
})

When('the puff patches are generated with {string}', async function (flags) {
  await runInfra(this, 'generatePuffpatches.js', flags)
})

Then('the upload PutObject targeted {string} with content type {string}', function (keyTemplate, contentType) {
  const key = keyTemplate.replace('<id>', this.componentId)
  const puts = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectCommand')
  const target = puts.find(call => call.input.Key === key)
  expect(target, JSON.stringify(puts.map(put => put.input.Key))).to.not.equal(undefined)
  expect(target.input.ContentType).to.equal(contentType)
})

Then('the DynamoDB records version {string} for the uploaded component', function (version) {
  const putCalls = mockState().dynamodb.sendCalls.filter(call => call.command === 'PutItemCommand')
  expect(putCalls).to.have.lengthOf(1)
  expect(putCalls[0].input.Item.Version.S).to.equal(version)
  expect(putCalls[0].input.Item.ID.S).to.equal(this.componentId)
})

Then('the DynamoDB records content hash {string} for component {string}', function (contentHash, componentName) {
  const putCalls = mockState().dynamodb.sendCalls.filter(call => call.command === 'PutItemCommand')
  expect(putCalls).to.have.lengthOf(1)
  expect(putCalls[0].input.Item.ContentHash.S).to.equal(contentHash)
})

Then('no .txt files were uploaded', function () {
  const puts = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectCommand')
  expect(puts.every(put => put.input.Key.endsWith('.crx')), JSON.stringify(puts)).to.equal(true)
})

Then('a .puff patch exists for the fixture component', function () {
  const patchDir = path.join(this.sandbox, 'build', 'patches', this.componentId, this.crxHash)
  const patches = fs.existsSync(patchDir) ? fs.readdirSync(patchDir).filter(file => file.endsWith('.puff')) : []
  expect(patches.length).to.be.at.least(1)
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
    for (const event of ['uncaughtException', 'unhandledRejection']) {
      const listeners = process.listeners(event)
      while (listeners.length > this.listeners[event]) {
        process.removeListener(event, listeners.pop())
      }
    }
    this.listeners = null
  }
})
