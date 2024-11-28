/* Copyright (c) 2022 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ad-block-updater-regional-component-keys

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import { getListCatalog, regionalCatalogComponentId, resourcesComponentId } from '../lib/adBlockRustUtils.js'

async function stageFiles (version, outputDir) {
  // ad-block components are already written in the output directory
  // so we don't need to stage anything
  const originalManifest = path.join(outputDir, 'manifest.json')
  // note - in-place manifest replacement, unlike other components
  util.copyManifestWithVersion(originalManifest, outputDir, version)
}

const generateVerifiedContents = (stagingDir, signingKey) => {
  util.generateVerifiedContents(
    stagingDir,
    ['resources.json', 'list.txt', 'list_catalog.json'],
    signingKey
  )
}

const postNextVersionWork = (componentSubdir, key, publisherProofKey,
  publisherProofKeyAlt, binary, localRun, version, contentHash, verifiedContentsKey) => {
  const stagingDir = path.join('build', 'ad-block-updater', componentSubdir)
  const crxOutputDir = path.join('build', 'ad-block-updater')
  const crxFile = path.join(crxOutputDir, `ad-block-updater-${componentSubdir}.crx`)
  const contentHashFile = path.join(crxOutputDir, `ad-block-updater-${componentSubdir}.contentHash`)
  stageFiles(version, stagingDir).then(() => {
    // Remove any existing `.contentHash` file for determinism
    if (fs.existsSync(contentHashFile)) {
      fs.unlinkSync(contentHashFile)
    }
    if (!localRun) {
      generateVerifiedContents(stagingDir, verifiedContentsKey)
      const privateKeyFile = path.join(key, `ad-block-updater-${componentSubdir}.pem`)
      util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
        publisherProofKeyAlt, stagingDir)
    }
    if (contentHash !== undefined) {
      fs.writeFileSync(contentHashFile, contentHash)
    }
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const getOriginalManifest = (componentSubdir) => {
  const manifestsDir = path.join('build', 'ad-block-updater')
  return path.join(manifestsDir, componentSubdir, 'manifest.json')
}

const processComponent = (
  binary,
  endpoint,
  region,
  keyDir,
  publisherProofKey,
  publisherProofKeyAlt,
  localRun,
  verifiedContentsKey,
  componentSubdir) => {
  const originalManifest = getOriginalManifest(componentSubdir)

  // TODO - previous download failures should prevent the attempt to package the component.
  if (!fs.existsSync(originalManifest)) {
    console.warn(`Missing manifest for ${componentSubdir}. Skipping.`)
    return
  }

  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  let fileToHash
  if (componentSubdir === regionalCatalogComponentId) {
    fileToHash = 'list_catalog.json'
  } else if (componentSubdir === resourcesComponentId) {
    fileToHash = 'resources.json'
  } else {
    fileToHash = 'list.txt'
  }

  let contentHash
  if (fileToHash !== undefined) {
    const contentFile = path.join('build', 'ad-block-updater', componentSubdir, fileToHash)
    contentHash = util.generateSHA256HashOfFile(contentFile)
  }

  if (!localRun) {
    util.getNextVersion(endpoint, region, id, contentHash).then((version) => {
      if (version !== undefined) {
        postNextVersionWork(componentSubdir, keyDir, publisherProofKey,
          publisherProofKeyAlt, binary, localRun, version, contentHash, verifiedContentsKey)
      } else {
        console.log('content for ' + id + ' was not updated, skipping!')
      }
    })
  } else {
    postNextVersionWork(componentSubdir, undefined, publisherProofKey,
      publisherProofKeyAlt, binary, localRun, '1.0.0', contentHash, verifiedContentsKey)
  }
}

const getComponentList = async () => {
  const output = [
    regionalCatalogComponentId,
    resourcesComponentId
  ]
  const catalog = await getListCatalog()
  catalog.forEach(entry => {
    output.push(entry.list_text_component.component_id)
  })
  return output
}

const processJob = async (commander, keyDir) => {
  (await getComponentList())
    .forEach(processComponent.bind(null, commander.binary, commander.endpoint,
      commander.region, keyDir,
      commander.publisherProofKey,
      commander.publisherProofKeyAlt,
      commander.localRun,
      commander.verifiedContentsKey))
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
