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

function stageFiles (version, outputDir) {
  // ad-block components are already written in the output directory
  // so we don't need to stage anything
  const originalManifest = path.join(outputDir, 'manifest.json')
  // note - in-place manifest replacement, unlike other components
  util.copyManifestWithVersion(originalManifest, outputDir, version)
}

const getOriginalManifest = (componentSubdir) => {
  const manifestsDir = path.join('build', 'ad-block-updater')
  return path.join(manifestsDir, componentSubdir, 'manifest.json')
}

const processComponent = async (binary, endpoint, region, keyDir,
  publisherProofKey, localRun, componentSubdir) => {
  const originalManifest = getOriginalManifest(componentSubdir)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  const crxName = `ad-block-updater-${componentSubdir}`
  const privateKeyFile = localRun ? undefined : path.join(keyDir, `${crxName}.pem`)
  const stagingDir = path.join('build', 'ad-block-updater', componentSubdir)
  const crxFile = path.join('build', 'ad-block-updater', `${crxName}.crx`)
  const contentHashFile = path.join('build', 'ad-block-updater', `${crxName}.contentHash`)

  const contentHashFn = () => {
    let fileToHash
    if (componentSubdir === regionalCatalogComponentId) {
      fileToHash = 'regional_catalog.json'
    } else if (componentSubdir === resourcesComponentId) {
      fileToHash = 'resources.json'
    } else {
      fileToHash = 'list.txt'
    }
    if (fileToHash !== undefined) {
      const contentFile = path.join('build', 'ad-block-updater', componentSubdir, fileToHash)
      return util.generateSHA256HashOfFile(contentFile)
    } else {
      return undefined
    }
  }

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    id,
    stageFiles,
    stagingDir,
    crxFile,
    privateKeyFile,
    localRun,
    contentHashFn,
    contentHashFile)
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
