import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

let ntpUtil
let util

function sha256Hex (content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

Given('a fresh working directory with a private key {string}', function (keyFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntp-key-'))
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(dir)
  this.keyDir = dir
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  this.privateKeyPem = privateKey
  this.publicKeyDer = publicKey.export({ type: 'spki', format: 'der' })
  fs.writeFileSync(path.join(dir, keyFile), privateKey)
  this.keyFile = keyFile
  // ntpUtil writes public.pub into the CWD — chdir into the sandbox
  this.recordPath = path.join(dir, 'openssl-record.jsonl')
  process.env.CRX_PACKAGER_RECORD = this.recordPath
  this.savedCwd = process.cwd()
  process.chdir(dir)
})

When('the public key and id are derived from {string}', async function (keyFile) {
  ntpUtil = (await import('../../lib/ntpUtil.js')).default
  this.derived = ntpUtil.generatePublicKeyAndID(keyFile)
})

Then('the derived public key matches the base64 of the generated public key', function () {
  const expected = this.publicKeyDer.toString('base64')
  expect(this.derived[0]).to.equal(expected)
})

Then('the derived id matches the component id of that public key', async function () {
  util = (await import('../../lib/util.js')).default
  expect(this.derived[1]).to.equal(util.getIDFromBase64PublicKey(this.derived[0]))
})

Then('the openssl shim received {string} and {string}', function (fragmentA, fragmentB) {
  const records = fs.readFileSync(this.recordPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
  const argv = records.flatMap(entry => entry.argv)
  expect(argv.some(arg => arg.includes(fragmentA)), JSON.stringify(argv)).to.equal(true)
  expect(argv).to.include(fragmentB.replace('-out ', ''))
})

Then('{string} exists in the working directory', function (file) {
  expect(fs.existsSync(path.join(this.keyDir, file))).to.equal(true)
})

Given('an assets manifest at {string} listing {string} with content {string}', function (manifestUrl, assetPath, content) {
  serveAssetsManifest(manifestUrl, [{ path: assetPath, content, sha256: sha256Hex(content) }])
  this.manifestUrl = manifestUrl
  this.assetPath = assetPath
})

Given('an assets manifest at {string} listing {string} with content {string} but sha256 {string}', function (manifestUrl, assetPath, content, wrongHash) {
  this.manifestUrl = manifestUrl
  serveAssetsManifest(manifestUrl, { path: assetPath, content, sha256: wrongHash })
})

Given('an assets manifest at {string} with asset path {string}', function (manifestUrl, assetPath) {
  this.manifestUrl = manifestUrl
  serveAssetsManifest(manifestUrl, { path: assetPath, content: 'content', sha256: sha256Hex('other') })
})

function serveAssetsManifest (manifestUrl, asset) {
  const assets = Array.isArray(asset) ? asset : [asset]
  mockState().fetchRoutes.push({
    match: manifestUrl,
    status: 200,
    body: JSON.stringify({ assets: assets.map(entry => ({ path: entry.path, sha256: entry.sha256 })) })
  })
  for (const entry of assets) {
    const assetUrl = new URL(entry.path, manifestUrl).href
    mockState().fetchRoutes.push({ match: assetUrl, status: 200, body: entry.content })
  }
}

When('the assets are prepared into a target resource directory', async function () {
  await prepareAssets(this)
  this.targetDir = this.assetTargetDir
})

When('the assets are prepared', async function () {
  await prepareAssets(this)
})

async function prepareAssets (world) {
  ntpUtil = (await import('../../lib/ntpUtil.js')).default
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntp-assets-'))
  world.tmpDirs = world.tmpDirs || []
  world.tmpDirs.push(targetDir)
  world.assetTargetDir = targetDir
  try {
    await ntpUtil.prepareAssets(world.manifestUrl, targetDir)
    world.prepareError = null
  } catch (error) {
    world.prepareError = error
  }
}

Then('the file {string} exists under the target directory', function (assetPath) {
  expect(fs.existsSync(path.join(this.assetTargetDir, assetPath))).to.equal(true)
})

Then('no preparation error was raised', function () {
  expect(this.prepareError).to.equal(null)
})

Then('the preparation fails with {string}', function (fragment) {
  expect(this.prepareError).to.be.an('error')
  expect(this.prepareError.message).to.include(fragment)
})

After(function () {
  if (this.savedCwd) {
    process.chdir(this.savedCwd)
    this.savedCwd = null
  }
})
