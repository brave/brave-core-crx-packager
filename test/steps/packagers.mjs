import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

const BRAVE_LIST_FILES = [
  'webcompat-exceptions.json',
  'debounce.json',
  'request-otr.json',
  'clean-urls.json',
  'clean-urls-permissions.json',
  'https-upgrade-exceptions-list.txt',
  'localhost-permission-allow-list.txt'
]

function createPackagerSandbox (world, keyFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packager-sandbox-'))
  world.tmpDirs = world.tmpDirs || []
  world.tmpDirs.push(dir)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  fs.writeFileSync(path.join(dir, keyFile), privateKey)
  world.publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  world.recordPath = path.join(dir, 'chrome-record.jsonl')
  process.env.CRX_PACKAGER_RECORD = world.recordPath
  world.originalArgv = [...process.argv]
  world.listeners = {
    uncaughtException: process.listeners('uncaughtException').length,
    unhandledRejection: process.listeners('unhandledRejection').length
  }
  world.savedCwd = process.cwd()
  process.chdir(dir)
  world.sandbox = dir
}

function ensureSandbox (world) {
  if (!world.sandbox) {
    createPackagerSandbox(world, 'key.pem')
  }
}

function writeResource (world, resourceFile, content = 'resource-bytes') {
  fs.mkdirpSync(path.dirname(path.join(world.sandbox, resourceFile)))
  fs.writeFileSync(path.join(world.sandbox, resourceFile), content)
}

Given('a packager sandbox with a signing key {string}', function (keyFile) {
  createPackagerSandbox(this, keyFile)
})

Given('a default manifest for {string} and resource file {string}', function (componentName, resourceFile) {
  ensureSandbox(this)
  fs.mkdirpSync(path.join(this.sandbox, 'manifests', componentName))
  fs.writeFileSync(
    path.join(this.sandbox, 'manifests', componentName, 'default-manifest.json'),
    JSON.stringify({ name: componentName, version: '0.0.0', key: this.publicKeyBase64 })
  )
  writeResource(this, resourceFile)
})

Given('committed data for {string} with manifest name {string}', function (componentName, manifestName) {
  ensureSandbox(this)
  fs.mkdirpSync(path.join(this.sandbox, 'component-data', componentName))
  fs.writeFileSync(
    path.join(this.sandbox, 'component-data', componentName, 'manifest.json'),
    JSON.stringify({ name: manifestName, version: '0.0.0', key: this.publicKeyBase64 })
  )
  fs.writeFileSync(path.join(this.sandbox, 'component-data', componentName, 'script.js'), 'injector')
})

Given('the NTP background images resources are staged', function () {
  ensureSandbox(this)
  fs.mkdirpSync(path.join(this.sandbox, 'build', 'ntp-background-images', 'resources'))
  fs.writeFileSync(path.join(this.sandbox, 'build', 'ntp-background-images', 'resources', 'bg.jpg'), 'bg-bytes')
})

Given('a default manifest for {string} and p3a config files', function (_componentName) {
  ensureSandbox(this)
  fs.mkdirpSync(path.join(this.sandbox, 'manifests', 'p3a-config'))
  fs.writeFileSync(
    path.join(this.sandbox, 'manifests', 'p3a-config', 'default-manifest.json'),
    JSON.stringify({ name: 'p3a-config', version: '0.0.0', key: this.publicKeyBase64 })
  )
  fs.mkdirpSync(path.join(this.sandbox, 'node_modules', 'p3a-config', 'dist'))
  fs.writeFileSync(path.join(this.sandbox, 'node_modules', 'p3a-config', 'dist', 'p3a_manifest.json'), '{"a":1}')
  fs.mkdirpSync(path.join(this.sandbox, 'node_modules', 'p3a-config-staging', 'dist'))
  fs.writeFileSync(path.join(this.sandbox, 'node_modules', 'p3a-config-staging', 'dist', 'p3a_manifest.json'), '{"staging":true}')
})

Given('a default manifest for {string} and brave list files', function (_componentName) {
  ensureSandbox(this)
  fs.mkdirpSync(path.join(this.sandbox, 'manifests', 'local-data-files-updater'))
  fs.writeFileSync(
    path.join(this.sandbox, 'manifests', 'local-data-files-updater', 'default-manifest.json'),
    JSON.stringify({ name: 'local-data-files-updater', version: '0.0.0', key: this.publicKeyBase64 })
  )
  fs.mkdirpSync(path.join(this.sandbox, 'brave-lists'))
  for (const file of BRAVE_LIST_FILES) {
    fs.writeFileSync(path.join(this.sandbox, 'brave-lists', file), `[] /* ${file} */`)
  }
})

When('the packager {string} runs with {string}', async function (script, flags) {
  // commander v2's default export is a singleton instance — boolean and
  // value flags from earlier scenarios leak into later parses, so reset.
  const commanderInstance = (await import('commander')).default
  for (const flag of ['localRun', 'staging', 'keyFile', 'keysDirectory', 'binary', 'publisherProofKey', 'publisherProofKeyAlt', 'endpoint', 'region']) {
    commanderInstance[flag] = undefined
  }
  process.argv = ['node', 'script', ...flags.split(' ').filter(Boolean)]
  const packager = await import(`../../scripts/${script}`)
  try {
    await packager.main(process.argv)
    this.packageError = null
  } catch (error) {
    this.packageError = error
  }
  // the DynamoDB -> stage -> sign chain is asynchronous; wait for the
  // final console.log('Generated ...') marker (or time out)
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const generated = this.state.logs.some(log => String(log.args[0] || '').includes('Generated '))
    if (generated || this.packageError) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
})

Then('the staged p3a manifest came from {string}', function (configPackage) {
  const staged = fs.readFileSync(path.join(this.sandbox, 'build', 'p3a-config', 'default', 'p3a_manifest.json'), 'utf8')
  expect(staged).to.include('staging')
})

Then('the regenerated manifest {string} declares name {string}', function (manifestPath, name) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(manifest.name).to.equal(name)
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
