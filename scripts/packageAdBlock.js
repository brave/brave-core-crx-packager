/* Copyright (c) 2022 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ad-block-updater-regional-component-keys

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import Sentry from '../lib/sentry.js'
import util from '../lib/util.js'
import {
  downloadListsForEntry,
  generatePlaintextListFromLists,
  generateResourcesFile,
  getListCatalog,
  getRegionalLists,
  resourcesComponentId,
  resourcesPubkey,
  regionalCatalogComponentId,
  regionalCatalogPubkey
} from '../lib/adBlockRustUtils.js'

const getOriginalManifest = (componentSubdir) => {
  const manifestsDir = path.join('build', 'ad-block-updater')
  return path.join(manifestsDir, componentSubdir, 'manifest.json')
}

const generateManifestFile = async (name, base64PublicKey, componentSubdir) => {
  const manifest = '{\n' +
                 '  "description": "Brave Ad Block Updater extension",\n' +
                 '  "key": "' + base64PublicKey + '",\n' +
                 '  "manifest_version": 2,\n' +
                 '  "name": "Brave Ad Block Updater (' + name + ')",\n' +
                 '  "version": "0.0.0"\n' +
                 '}\n'

  const filePath = getOriginalManifest(componentSubdir)
  return fs.writeFile(filePath, manifest)
    .catch(e => console.warn('Skipped writing manifest for ' + name + ': ' + e.message))
}

// Serves plaintext filter lists
class AdblockList {
  constructor (catalogEntry) {
    this.catalogEntry = catalogEntry
    this.componentId = catalogEntry.list_text_component.component_id

    this.crxName = `ad-block-updater-${this.componentId}`
    this.stagingDir = path.join('build', 'ad-block-updater', this.componentId)
    this.crxFile = path.join('build', 'ad-block-updater', `${this.crxName}.crx`)
    this.contentHashFile = path.join('build', 'ad-block-updater', `${this.crxName}.contentHash`)
  }

  contentHash () {
    const contentFile = path.join('build', 'ad-block-updater', this.componentId, 'list.txt')
    return util.generateSHA256HashOfFile(contentFile)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${this.crxName}.pem`)
  }

  async stageFiles (version, outputDir) {
    await downloadListsForEntry(this.catalogEntry).then(
      (listBuffers) => {
        generatePlaintextListFromLists(listBuffers, path.join(outputDir, 'list.txt'))
      },
      e => {
        console.error(`Not publishing a new version of ${this.catalogEntry.title} due to failure downloading a source: ${e.message}`)
        if (Sentry) {
          Sentry.captureException(e, { level: 'warning' })
        }
      }
    )

    const title = util.escapeStringForJSON(this.catalogEntry.title)
    if (this.catalogEntry.list_text_component) {
      await generateManifestFile(title + ' (plaintext)', this.catalogEntry.list_text_component.base64_public_key, this.componentId)
    }

    const files = [
      { path: getOriginalManifest(this.componentId) },
      { path: path.join(outputDir, 'list.txt') }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

// Serves the catalog of available filter lists
// Currently there are two files:
// - `regional_catalog.json` is the older version
// - `list_catalog.json` is the newer version, containing additional list metadata
class AdblockCatalog {
  constructor () {
    this.componentId = regionalCatalogComponentId

    this.crxName = `ad-block-updater-${this.componentId}`
    this.stagingDir = path.join('build', 'ad-block-updater', this.componentId)
    this.crxFile = path.join('build', 'ad-block-updater', `${this.crxName}.crx`)
    this.contentHashFile = path.join('build', 'ad-block-updater', `${this.crxName}.contentHash`)
  }

  contentHash () {
    // TODO update to `list_catalog.json` when `regional_catalog.json` is no longer used
    const contentFile = path.join('build', 'ad-block-updater', this.componentId, 'regional_catalog.json')
    return util.generateSHA256HashOfFile(contentFile)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${this.crxName}.pem`)
  }

  async stageFiles (version, outputDir) {
    const regions = await getRegionalLists()
    const regionalCatalogString = JSON.stringify(regions)
    const regionalCatalogPath = path.join(outputDir, 'regional_catalog.json')
    fs.writeFileSync(regionalCatalogPath, regionalCatalogString)

    const listCatalog = await getListCatalog()
    const listCatalogString = JSON.stringify(listCatalog)
    const listCatalogPath = path.join(outputDir, 'list_catalog.json')
    fs.writeFileSync(listCatalogPath, listCatalogString)

    await generateManifestFile('Regional Catalog', regionalCatalogPubkey, regionalCatalogComponentId)

    const files = [
      { path: getOriginalManifest(this.componentId) },
      { path: regionalCatalogPath },
      { path: listCatalogPath }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

// Serves the data for adblock-rust's resource replacements and scriptlets.
class AdblockResources {
  constructor () {
    this.componentId = resourcesComponentId

    this.crxName = `ad-block-updater-${this.componentId}`
    this.stagingDir = path.join('build', 'ad-block-updater', this.componentId)
    this.crxFile = path.join('build', 'ad-block-updater', `${this.crxName}.crx`)
    this.contentHashFile = path.join('build', 'ad-block-updater', `${this.crxName}.contentHash`)
  }

  contentHash () {
    const contentFile = path.join('build', 'ad-block-updater', this.componentId, 'resources.json')
    return util.generateSHA256HashOfFile(contentFile)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${this.crxName}.pem`)
  }

  async stageFiles (version, outputDir) {
    const resourcesPath = path.join(outputDir, 'resources.json')
    await generateResourcesFile(resourcesPath)

    await generateManifestFile('Resources', resourcesPubkey, resourcesComponentId)

    const files = [
      { path: getOriginalManifest(this.componentId) },
      { path: resourcesPath }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const processComponent = async (binary, endpoint, region, keyParam,
  publisherProofKey, localRun, descriptor) => {
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(keyParam).isDirectory() ? keyParam : descriptor.privateKeyFromDir(keyParam)
  }

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    descriptor,
    privateKeyFile,
    localRun)
}

const getAdblockComponentDescriptors = async () => {
  const output = [
    new AdblockCatalog(),
    new AdblockResources()
  ]
  output.push(...(await getListCatalog()).map(entry => new AdblockList(entry)))
  return output
}

const processJob = async (commander, keyDir) => {
  (await getAdblockComponentDescriptors())
    .map(processComponent.bind(null, commander.binary, commander.endpoint,
      commander.region, keyDir,
      commander.publisherProofKey,
      commander.localRun))
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely'))
  .parse(process.argv)

if (!commander.localRun) {
  let keyDir = ''
  if (fs.existsSync(commander.keysDirectory)) {
    keyDir = commander.keysDirectory
  } else {
    throw new Error('Missing or invalid private key file/directory')
  }
  util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
    await processJob(commander, keyDir)
  })
} else {
  processJob(commander, undefined)
}
