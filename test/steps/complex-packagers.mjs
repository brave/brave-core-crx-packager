import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import JSZip from 'jszip'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

let util

const REGIONAL_CATALOG_ID = 'gkboaolpopklhgplhaaiboijnklogmbc'
const RESOURCES_ID = 'mfddibmblmbccpadfndgakiopmmhebop'
const CATALOG_IDS = ['bbbbbbbbbbbbbbbbbbbbbbbbbbbbaaaad', 'rrrrrrrrrrrrrrrrrrrrrrrrrrrraaar']
const EXTENSIONS_V2 = ['no-script-v2', 'adguard-v2', 'umatrix-v2', 'ublock-v2']

const LOCALES = [
  'iso_3166_1_gb', 'iso_3166_1_jp', 'iso_3166_1_us', 'iso_3166_1_ca', 'iso_3166_1_de',
  'iso_3166_1_at', 'iso_3166_1_ch', 'iso_3166_1_be', 'iso_3166_1_au', 'iso_3166_1_nz',
  'iso_3166_1_pt', 'iso_3166_1_fr', 'iso_3166_1_nl', 'iso_3166_1_dk', 'iso_3166_1_es',
  'iso_3166_1_fi', 'iso_3166_1_hk', 'iso_3166_1_hu', 'iso_3166_1_ie', 'iso_3166_1_in',
  'iso_3166_1_it', 'iso_3166_1_kr', 'iso_3166_1_no', 'iso_3166_1_se', 'iso_3166_1_sg',
  'iso_3166_1_tw', 'iso_3166_1_cz', 'iso_3166_1_ee', 'iso_3166_1_lt', 'iso_3166_1_pk',
  'iso_3166_1_pl', 'iso_3166_1_sk', 'iso_3166_1_ro', 'iso_3166_1_ua', 'iso_3166_1_ar',
  'iso_3166_1_br', 'iso_3166_1_id', 'iso_3166_1_my', 'iso_3166_1_mx', 'iso_3166_1_ph',
  'iso_3166_1_th', 'iso_3166_1_tr', 'iso_3166_1_ru', 'iso_3166_1_vn', 'iso_639_1_de',
  'iso_639_1_en', 'iso_639_1_fr', 'iso_639_1_ja', 'iso_639_1_pt', 'iso_639_1_es',
  'iso_639_1_ar', 'iso_639_1_zh', 'iso_639_1_nl', 'iso_639_1_fi', 'iso_639_1_el',
  'iso_639_1_he', 'iso_639_1_it', 'iso_639_1_ko', 'iso_639_1_pl', 'iso_639_1_ro',
  'iso_639_1_ru', 'iso_639_1_sv', 'iso_639_1_tr'
]

async function loadUtil () {
  if (!util) {
    util = (await import('../../lib/util.js')).default
  }
}

function createSandbox (world) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'complex-packagers-'))
  world.tmpDirs = world.tmpDirs || []
  world.tmpDirs.push(dir)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  fs.writeFileSync(path.join(dir, 'key.pem'), privateKey)
  fs.writeFileSync(path.join(dir, 'vc.pem'), privateKey)
  world.publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  world.recordPath = path.join(dir, 'shim-record.jsonl')
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
  if (!world.sandbox) createSandbox(world)
}

Given('the ad-block updater outputs and catalog are staged', function () {
  ensureSandbox(this)
  const catalog = [
    { title: 'List One', list_text_component: { component_id: CATALOG_IDS[0] } },
    { title: 'List Two', list_text_component: { component_id: CATALOG_IDS[1] } }
  ]
  mockState().fetchRoutes.push({
    match: 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/list_catalog.json',
    status: 200,
    body: JSON.stringify(catalog)
  })
  const ids = [REGIONAL_CATALOG_ID, RESOURCES_ID, ...CATALOG_IDS]
  for (const id of ids) {
    const dir = path.join(this.sandbox, 'build', 'ad-block-updater', id)
    fs.mkdirpSync(dir)
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ name: 'Brave Ad Block Updater', version: '0.0.0', key: this.publicKeyBase64 }))
    const fileToHash = id === REGIONAL_CATALOG_ID ? 'list_catalog.json' : id === RESOURCES_ID ? 'resources.json' : 'list.txt'
    fs.writeFileSync(path.join(dir, fileToHash), `content-for-${id}`)
  }
})

Given('a keys directory with per-component pem files', function () {
  const ids = [REGIONAL_CATALOG_ID, RESOURCES_ID, ...CATALOG_IDS]
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 512, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  fs.mkdirpSync(path.join(this.sandbox, 'keys'))
  for (const id of ids) {
    fs.writeFileSync(path.join(this.sandbox, 'keys', `ad-block-updater-${id}.pem`), privateKey)
  }
})

Given('the DynamoDB stored the current content hash for the ad-block components', async function () {
  await loadUtil()
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  const ids = [REGIONAL_CATALOG_ID, RESOURCES_ID, ...CATALOG_IDS]
  const itemHashes = ids.map(id => {
    const fileToHash = id === REGIONAL_CATALOG_ID ? 'list_catalog.json' : id === RESOURCES_ID ? 'resources.json' : 'list.txt'
    const contentFile = path.join(this.sandbox, 'build', 'ad-block-updater', id, fileToHash)
    return util.generateVersionedSHA256HashOfFile(contentFile, 1)
  })
  let index = 0
  mockState().dynamodb.replies.QueryCommand = {
    value: () => ({ Items: [{ Version: { S: '2.0.0' }, ContentHash: { S: itemHashes[index++] } }] })
  }
})

Given('the manifest for {string} is removed', function (componentId) {
  fs.rmSync(path.join(this.sandbox, 'build', 'ad-block-updater', componentId, 'manifest.json'))
})

Given('tor client manifests and a sha512 mismatching tor binary from the aws shim', function () {
  ensureSandbox(this)
  fs.mkdirpSync(path.join(this.sandbox, 'resources', 'tor'))
  fs.writeFileSync(path.join(this.sandbox, 'resources', 'tor', 'torrc'), 'torrc-content')
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  mockState().dynamodb.replies.QueryCommand = { value: { Items: [{ Version: { S: '2.0.0' } }] } }
  process.env.S3_DEMO_TOR_PREFIX = 'https://s3.invalid/tor/'
  fs.mkdirpSync(path.join(this.sandbox, 'manifests', 'tor-client-updater'))
  for (const platform of ['darwin', 'linux', 'linux-arm64', 'win32']) {
    fs.writeFileSync(
      path.join(this.sandbox, 'manifests', 'tor-client-updater', `tor-client-updater-${platform}-manifest.json`),
      JSON.stringify({ name: 'Tor Client', version: '0.0.0', key: this.publicKeyBase64 })
    )
  }
})

Given('pluggable transport sources for all platforms', function () {
  ensureSandbox(this)
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  mockState().dynamodb.replies.QueryCommand = { value: { Items: [{ Version: { S: '2.0.0' } }] } }
  fs.mkdirpSync(path.join(this.sandbox, 'manifests', 'tor-pluggable-transports-updater'))
  for (const platform of ['darwin', 'linux', 'win32']) {
    fs.writeFileSync(
      path.join(this.sandbox, 'manifests', 'tor-pluggable-transports-updater', `tor-pluggable-transports-updater-${platform}-manifest.json`),
      JSON.stringify({ name: 'Tor PT', version: '0.0.0', key: this.publicKeyBase64 })
    )
    fs.mkdirpSync(path.join(this.sandbox, 'snowflake', 'client', platform))
    fs.writeFileSync(path.join(this.sandbox, 'snowflake', 'client', platform, 'tor-snowflake-brave'), 'snowflake-bytes')
    fs.mkdirpSync(path.join(this.sandbox, 'obfs4', 'obfs4proxy', platform))
    fs.writeFileSync(path.join(this.sandbox, 'obfs4', 'obfs4proxy', platform, 'tor-obfs4-brave'), 'obfs4-bytes')
  }
})

Given('a wallet-lists package dir with manifest and data', function () {
  ensureSandbox(this)
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  mockState().dynamodb.replies.QueryCommand = { value: { Items: [{ Version: { S: '2.0.0' } }] } }
  const pkgDir = path.join(this.sandbox, 'node_modules', '@brave', 'wallet-lists')
  fs.mkdirpSync(pkgDir)
  fs.writeFileSync(path.join(pkgDir, 'manifest.json'), JSON.stringify({ name: 'Wallet Data Files', version: '0.0.0', key: this.publicKeyBase64 }))
  fs.writeFileSync(path.join(pkgDir, 'package.json'), '{}')
  fs.writeFileSync(path.join(pkgDir, 'data.json'), '[]')
})

Given('manifest v2 extension configs with served sources archives', async function () {
  ensureSandbox(this)
  await loadUtil()
  // the pure-JS CRX packager reads publisher proof keys from disk, and
  // rewrites the manifest with the signing key — so config.key must be
  // the public half of each extension's signing key
  const { privateKey: publisherPrivateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 512, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  fs.writeFileSync(path.join(this.sandbox, 'proof.pem'), publisherPrivateKey)
  const extensionKeyPublic = crypto.createPublicKey(publisherPrivateKey).export({ type: 'spki', format: 'der' }).toString('base64')
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  mockState().dynamodb.replies.QueryCommand = { value: { Items: [{ Version: { S: '2.0.0' } }] } }
  fs.mkdirpSync(path.join(this.sandbox, 'keys'))
  for (const name of EXTENSIONS_V2) {
    const config = { name, key: extensionKeyPublic, url: `https://ext.invalid/${name}/sources.zip` }
    fs.mkdirpSync(path.join(this.sandbox, 'manifests', name))
    fs.writeFileSync(path.join(this.sandbox, 'manifests', name, 'config.json'), JSON.stringify(config))
    fs.writeFileSync(path.join(this.sandbox, 'keys', `${name}-key.pem`), publisherPrivateKey)
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ name: `Ext ${name}`, version: '1.0.0', manifest_version: 2, key: extensionKeyPublic }))
    zip.file('content.js', 'extension-script')
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    mockState().fetchRoutes.push({ match: `https://ext.invalid/${name}/sources.zip`, status: 200, body: buffer })
  }
})

Given('brave ads resources for every locale', function () {
  ensureSandbox(this)
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
  mockState().dynamodb.replies.QueryCommand = { value: { Items: [{ Version: { S: '2.0.0' } }] } }
  for (const locale of LOCALES) {
    fs.mkdirpSync(path.join(this.sandbox, 'build', 'user-model-installer', 'resources', locale))
    fs.writeFileSync(path.join(this.sandbox, 'build', 'user-model-installer', 'resources', locale, 'data.json'), '[]')
  }
})

Given('a keys directory without per-locale pem files', function () {
  ensureSandbox(this)
  fs.mkdirpSync(path.join(this.sandbox, 'keys'))
})

When('the complex packager {string} runs with {string}', async function (script, flags) {
  const commanderInstance = (await import('commander')).default
  for (const flag of ['localRun', 'staging', 'keyFile', 'keysDirectory', 'binary', 'publisherProofKey', 'publisherProofKeyAlt', 'verifiedContentsKey', 'endpoint', 'region']) {
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
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const generated = this.state.logs.some(log => String(log.args[0] || '').includes('Generated '))
    if (generated || this.packageError || mockState().scripts.exitCalls.length > 0) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
})

Then('a contentHash file exists for each ad-block component', function () {
  const ids = [REGIONAL_CATALOG_ID, RESOURCES_ID, ...CATALOG_IDS]
  for (const id of ids) {
    expect(fs.existsSync(path.join(this.sandbox, 'build', 'ad-block-updater', `ad-block-updater-${id}.contentHash`)), id).to.equal(true)
  }
})

Then('no contentHash files were written', function () {
  const ids = [REGIONAL_CATALOG_ID, RESOURCES_ID, ...CATALOG_IDS]
  for (const id of ids) {
    expect(fs.existsSync(path.join(this.sandbox, 'build', 'ad-block-updater', `ad-block-updater-${id}.contentHash`)), id).to.equal(false)
  }
})

Then('each ad-block staging dir contains {string}', function (metadataPath) {
  const ids = [REGIONAL_CATALOG_ID, RESOURCES_ID, ...CATALOG_IDS]
  for (const id of ids) {
    expect(fs.existsSync(path.join(this.sandbox, 'build', 'ad-block-updater', id, metadataPath)), `${id}/${metadataPath}`).to.equal(true)
  }
})

Then('the staged wallet manifest declares version {string}', function (version) {
  const staged = JSON.parse(fs.readFileSync(path.join(this.sandbox, 'build', 'wallet-data-files-updater', 'manifest.json'), 'utf8'))
  expect(staged.version).to.equal(version)
})

Then('the staged wallet dir has no {string}', function (file) {
  expect(fs.existsSync(path.join(this.sandbox, 'build', 'wallet-data-files-updater', file))).to.equal(false)
})

Then('the run exited with code {int}', function (code) {
  expect(mockState().scripts.exitCalls, JSON.stringify(mockState().scripts.exitCalls)).to.include(code)
})

Then('every manifest v2 extension output exists', async function () {
  const util = (await import('../../lib/util.js')).default
  for (const name of EXTENSIONS_V2) {
    const config = JSON.parse(fs.readFileSync(path.join(this.sandbox, 'manifests', name, 'config.json'), 'utf8'))
    const id = util.getIDFromBase64PublicKey(config.key)
    expect(fs.existsSync(path.join(this.sandbox, 'build', 'extensions-v2', `${id}.crx`)), name).to.equal(true)
    expect(fs.existsSync(path.join(this.sandbox, 'build', 'extensions-v2', `${id}.zip`)), name).to.equal(true)
  }
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
  delete process.env.S3_DEMO_TOR_PREFIX
  delete process.env.CRX_PACKAGER_AWS_CONTENT
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
