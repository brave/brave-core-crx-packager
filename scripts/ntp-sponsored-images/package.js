// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/.

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../../lib/util.js'
import params from './params.js'

const stageFiles = (locale, version, outputDir) => {
  util.stageDir(
    path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources', locale, '/'),
    getManifestPath(locale),
    version,
    outputDir)
}

const generateManifestFile = (regionPlatform, componentData) => {
  const manifestPath = getManifestPath(regionPlatform)
  const manifestContent = {
    description: `Brave NTP sponsored images component (${regionPlatform})`,
    key: componentData.key,
    manifest_version: 2,
    name: 'Brave NTP sponsored images',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent))
}

const getManifestsDir = () => {
  const targetResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'manifiest-files')
  mkdirp.sync(targetResourceDir)
  return targetResourceDir
}

/**
 *
 *
 * @param {string} regionPlatform
 * @returns
 */
function getManifestPath (regionPlatform) {
  return path.join(getManifestsDir(), `${regionPlatform}-manifest.json`)
}

const generateCRXFile = (binary, endpoint, region, keyDir, platformRegion,
  componentData, publisherProofKey) => {
  // Desktop private key file names do not have the -desktop suffix, but android has -android
  const privateKeyFile = path.join(keyDir, `ntp-sponsored-images-${platformRegion.replace('-desktop', '')}.pem`)
  const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images')

  const stagingDir = path.join(rootBuildDir, 'staging', platformRegion)
  const crxFile = path.join(rootBuildDir, 'output', `ntp-sponsored-images-${platformRegion}.crx`)
  util.getNextVersion(endpoint, region, componentData.id).then((version) => {
    stageFiles(platformRegion, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-t, --target-regions <regions>', 'Comma separated list of regions that should generate SI component. For example: "AU-android,US-desktop,GB-ios"', '')
    .option('-u, --excluded-target-regions <regions>', 'Comma separated list of regions that should not generate SI component. For example: "AU-android,US-desktop,GB-ios"', ''))
  .parse(process.argv)

let keyDir = ''
if (fs.existsSync(commander.keysDirectory)) {
  keyDir = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key directory')
}

const targetComponents = params.getTargetComponents(commander.targetRegions, commander.excludedTargetRegions)

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  for (const platformRegion of Object.keys(targetComponents)) {
    const componentData = targetComponents[platformRegion]
    generateManifestFile(platformRegion, componentData)
    generateCRXFile(commander.binary, commander.endpoint, commander.region,
      keyDir, platformRegion, componentData,
      commander.publisherProofKey)
  }
})
