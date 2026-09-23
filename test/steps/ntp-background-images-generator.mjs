import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

let ntpBackgroundImages
let adsResources

Given('a sandbox for network generators', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'generators-'))
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(dir)
  this.savedCwd = process.cwd()
  process.chdir(dir)
})

Given('a photo.json served at {string} for image {string} with content {string}', function (manifestUrl, imagePath, content) {
  serveAssetsAt(manifestUrl, {
    schemaVersion: 1,
    images: [{
      name: 'bg', source: imagePath, author: 'a', link: 'l', originalUrl: 'o', license: 'l'
    }]
  }, { [imagePath]: content })
})

Given('a photo.json served at {string} with schema version {int}', function (manifestUrl, version) {
  serveAssetsAt(manifestUrl, { schemaVersion: version, images: [] })
})

Given('a photo.json served at {string} missing required image properties', function (manifestUrl) {
  serveAssetsAt(manifestUrl, {
    schemaVersion: 1,
    images: [{ name: 'bg', source: 'images/bg.jpg' }]
  })
})

function serveAssetsAt (manifestUrl, photoData, imageBodies = {}) {
  mockState().fetchRoutes.push({ match: manifestUrl, status: 200, body: JSON.stringify(photoData) })
  for (const [imagePath, content] of Object.entries(imageBodies)) {
    mockState().fetchRoutes.push({ match: new URL(imagePath, manifestUrl).href, status: 200, body: content })
  }
}

function serveAdsManifests (dataUrl, withSchemaVersion) {
  mockState().fetchRoutes.push({
    match: url => url.includes(dataUrl) && url.endsWith('/resources.json'),
    response: url => ({
      status: 200,
      body: JSON.stringify(withSchemaVersion
        ? { schemaVersion: 1, resources: [{ filename: 'data.bin' }] }
        : { resources: [{ filename: 'data.bin' }] })
    })
  })
  mockState().fetchRoutes.push({
    match: url => url.includes(dataUrl) && url.endsWith('/data.bin'),
    status: 200,
    body: 'data-bytes'
  })
}

Given('ads resources manifests served under {string}', function (dataUrl) {
  serveAdsManifests(dataUrl, true)
})

Given('ads resources manifests served under {string} without schema versions', function (dataUrl) {
  serveAdsManifests(dataUrl, false)
})

When('the NTP background images are generated from {string}', async function (dataUrl) {
  ntpBackgroundImages = await import('../../scripts/generateNTPBackgroundImages.js')
  await ntpBackgroundImages.main(dataUrl)
})

When('the ads component input files are generated from {string}', async function (dataUrl) {
  adsResources = await import('../../scripts/generateBraveAdsResourcesComponentInputFiles.js')
  try {
    await adsResources.main(dataUrl)
    this.adsError = null
  } catch (error) {
    this.adsError = error
  }
})

Then('the staged {string} declares schema version {int}', function (file, version) {
  const staged = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(staged.schemaVersion).to.equal(version)
})

Then('the generation rejects with {string}', function (fragment) {
  expect(this.adsError).to.be.an('error')
  expect(this.adsError.message).to.include(fragment)
})

After(function () {
  if (this.savedCwd) {
    process.chdir(this.savedCwd)
    this.savedCwd = null
  }
})
