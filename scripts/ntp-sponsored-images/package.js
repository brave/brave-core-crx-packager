// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/.

import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../../lib/util.js'
import { getPackagingArgs, packageComponent } from '../packageComponent.js'
import params from './params.js'

const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images')

const stageFiles = (locale, version, outputDir) => {
  util.stageDir(
    path.join(rootBuildDir, 'resources', locale, '/'),
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
  const targetResourceDir = path.join(rootBuildDir, 'manifiest-files')
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

class SponsoredImagesComponent {
  constructor (platformRegion, componentData) {
    this.platformRegion = platformRegion
    this.componentId = componentData.id

    this.stagingDir = path.join(rootBuildDir, 'staging', platformRegion)
    this.crxFile = path.join(rootBuildDir, 'output', `ntp-sponsored-images-${platformRegion}.crx`)
    this.verifiedContentsPatterns = ['**']
  }

  privateKeyFromDir (keyDir) {
    // Desktop private key file names do not have the -desktop suffix, but android has -android
    return path.join(keyDir, `ntp-sponsored-images-${this.platformRegion.replace('-desktop', '')}.pem`)
  }

  async stageFiles (version, outputDir) {
    stageFiles(this.platformRegion, version, outputDir)
  }
}

const args = getPackagingArgs([
  ['-t, --target-regions <regions>', 'Comma separated list of regions that should generate SI component. For example: "AU-android,US-desktop,GB-ios"', ''],
  ['-u, --excluded-target-regions <regions>', 'Comma separated list of regions that should not generate SI component. For example: "AU-android,US-desktop,GB-ios"', '']
])

if (!fs.existsSync(args.keysDirectory)) {
  throw new Error('Missing or invalid private key directory')
}

const targetComponents = params.getTargetComponents(args.targetRegions, args.excludedTargetRegions)

Promise.all(Object.keys(targetComponents).map(platformRegion => {
  const componentData = targetComponents[platformRegion]
  generateManifestFile(platformRegion, componentData)
  return packageComponent(args, new SponsoredImagesComponent(platformRegion, componentData))
}))
