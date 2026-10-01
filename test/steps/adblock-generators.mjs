import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

const CATALOG_URL = 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/list_catalog.json'
const BRAVE_RESOURCES_URL = 'https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json'
const LAMBDA_URL = 'https://2sq625b43mykl2tqumoue7j4k40vkupj.lambda-url.us-west-2.on.aws'
const REGIONAL_CATALOG_ID = 'gkboaolpopklhgplhaaiboijnklogmbc'
const RESOURCES_ID = 'mfddibmblmbccpadfndgakiopmmhebop'
const DEFAULT_LIST_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbaaaad'
const REGIONAL_LIST_ID = 'rrrrrrrrrrrrrrrrrrrrrrrrrrrraaar'

const CATALOG = [
  {
    title: 'Brave Default',
    default_enabled: true,
    hidden: true,
    langs: ['en'],
    sources: [{ url: 'https://example.invalid/default-list.txt', format: 'Standard' }],
    list_text_component: { component_id: DEFAULT_LIST_ID, base64_public_key: 'defaultkey' }
  },
  {
    title: 'Regional List',
    default_enabled: false,
    hidden: false,
    langs: ['de'],
    sources: [{ url: 'https://example.invalid/regional-list.txt', format: 'Standard' }],
    list_text_component: { component_id: REGIONAL_LIST_ID, base64_public_key: 'regionkey' }
  }
]

let adBlockDataFiles
let adBlockManifests
const state = {}

function md5 (value) {
  return crypto.createHash('md5').update(value).digest('hex')
}

function mirrorUrlFor (sourceUrl, commitHash) {
  const commitRef = commitHash === undefined ? 'refs/heads/lists' : `${commitHash}`
  return `https://raw.githubusercontent.com/brave/adblock-lists-mirror/${commitRef}/lists/${md5(sourceUrl)}.txt`
}

function serveCatalogRoutes () {
  mockState().fetchRoutes.push({ match: CATALOG_URL, status: 200, body: JSON.stringify(CATALOG) })
  mockState().fetchRoutes.push({
    match: BRAVE_RESOURCES_URL,
    status: 200,
    body: JSON.stringify([{ name: 'brave-extra', kind: { mime: 'application/javascript' }, content: 'Y29uc29sZS5sb2coJ2hpJyk=' }])
  })
  mockState().fetchRoutes.push({ match: LAMBDA_URL, status: 200, body: 'OK' })
  serveMirrorList('https://example.invalid/default-list.txt', 'brave-default-rule\n+js(brave-shield)\n', state.commitHash)
  serveMirrorList('https://example.invalid/regional-list.txt', 'regional-rule\n+js(brave-hide)\n', state.commitHash)
}

function serveMirrorList (sourceUrl, body, commitHash) {
  mockState().fetchRoutes.push({ match: mirrorUrlFor(sourceUrl, commitHash), status: 200, body })
}

When('the ad block data files are generated', async function () {
  if (!state.catalogServed) {
    serveCatalogRoutes()
    state.catalogServed = true
  }
  adBlockDataFiles = await import('../../scripts/generateAdBlockRustDataFiles.js')
  await adBlockDataFiles.main(undefined)
})

When('the ad block data files are generated with commit hash {string}', async function (commitHash) {
  state.commitHash = commitHash
  if (!state.catalogServed) {
    serveCatalogRoutes()
    state.catalogServed = true
  }
  adBlockDataFiles = await import('../../scripts/generateAdBlockRustDataFiles.js')
  await adBlockDataFiles.main(commitHash)
})

Given('the mirrored list for {string} fails with status {int}', function (sourceUrl, status) {
  state.failedSource = sourceUrl
  if (!state.catalogServed) {
    serveCatalogRoutes()
    state.catalogServed = true
  }
  mockState().fetchRoutes.push({
    match: mirrorUrlFor(sourceUrl, state.commitHash),
    status,
    body: ''
  })
})

When('the ad block manifests are generated', async function () {
  if (!state.catalogServed) {
    serveCatalogRoutes()
    state.catalogServed = true
  }
  // In CI the manifest generator runs after the data files have created
  // the component directories; replicate that precondition.
  fs.mkdirpSync(path.join('build', 'ad-block-updater', REGIONAL_CATALOG_ID))
  fs.mkdirpSync(path.join('build', 'ad-block-updater', RESOURCES_ID))
  for (const entry of CATALOG) {
    fs.mkdirpSync(path.join('build', 'ad-block-updater', entry.list_text_component.component_id))
  }
  adBlockManifests = await import('../../scripts/generateManifestForRustAdblock.js')
  await adBlockManifests.main()
})

Then('the default list file contains {string} and keeps {string}', function (rule, directive) {
  const list = fs.readFileSync(path.join('build', 'ad-block-updater', DEFAULT_LIST_ID, 'list.txt'), 'utf8')
  expect(list).to.include(rule)
  expect(list).to.include(directive)
})

Then('the regional list file contains {string} but drops {string}', function (rule, directive) {
  const list = fs.readFileSync(path.join('build', 'ad-block-updater', REGIONAL_LIST_ID, 'list.txt'), 'utf8')
  expect(list).to.include(rule)
  expect(list).to.not.include(directive)
})

Then('the regional catalog file lists {string}', function (title) {
  const catalog = JSON.parse(fs.readFileSync(path.join('build', 'ad-block-updater', REGIONAL_CATALOG_ID, 'regional_catalog.json'), 'utf8'))
  expect(catalog.some(entry => entry.title === title)).to.equal(true)
})

Then('the list catalog file lists {string}', function (title) {
  const catalog = JSON.parse(fs.readFileSync(path.join('build', 'ad-block-updater', REGIONAL_CATALOG_ID, 'list_catalog.json'), 'utf8'))
  expect(catalog.some(entry => entry.title === title)).to.equal(true)
})

Then('the resources file exists in the resources component dir', function () {
  expect(fs.existsSync(path.join('build', 'ad-block-updater', RESOURCES_ID, 'resources.json'))).to.equal(true)
})

Then('no list.txt was written for {string}', function (componentId) {
  expect(fs.existsSync(path.join('build', 'ad-block-updater', componentId, 'list.txt'))).to.equal(false)
})

Then('the run logged {string}', function (fragment) {
  expect(this.state.logs.some(log => log.args.some(arg => String(arg).includes(fragment)))).to.equal(true)
})

Then('every mirror request used commit {string}', function (commitHash) {
  const mirrorCalls = mockState().fetchCalls.filter(call => call.url.includes('adblock-lists-mirror'))
  expect(mirrorCalls.length).to.be.at.least(2)
  for (const call of mirrorCalls) {
    expect(call.url).to.include(`/${commitHash}/lists/`)
  }
})

Then('the regional catalog manifest declares the name {string}', function (name) {
  const manifest = JSON.parse(fs.readFileSync(path.join('build', 'ad-block-updater', REGIONAL_CATALOG_ID, 'manifest.json'), 'utf8'))
  expect(manifest.name).to.equal(name)
  expect(manifest.version).to.equal('0.0.0')
})

Then('the regional list manifest declares the name {string}', function (name) {
  const manifest = JSON.parse(fs.readFileSync(path.join('build', 'ad-block-updater', REGIONAL_LIST_ID, 'manifest.json'), 'utf8'))
  expect(manifest.name).to.equal(name)
})
