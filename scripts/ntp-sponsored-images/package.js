// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/.

import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../../lib/util.js'
import params from './params.js'
import { getPackagingArgs, packageComponent } from './packageComponent'

const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images')

const generateManifestFile = (regionPlatform, publicKey) => {
  const manifestPath = getManifestPath(regionPlatform)
  const manifestContent = {
    description: `Brave NTP sponsored images component (${regionPlatform})`,
    key: publicKey,
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

class NtpSponsoredImages {
  constructor (platformRegion, componentData) {
    this.platformRegion = platformRegion
    this.locale = componentData.locale
    this.publicKey = componentData.key
    this.componentId = componentData.id

    this.stagingDir = path.join(rootBuildDir, 'staging', this.platformRegion)
    this.crxFile = path.join(rootBuildDir, 'output', `ntp-sponsored-images-${this.platformRegion}.crx`)
  }

  privateKeyFromDir (keyDir) {
    // Desktop private key file names do not have the -desktop suffix, but android has -android
    return path.join(keyDir, `ntp-sponsored-images-${this.platformRegion.replace('-desktop', '')}.pem`)
  }

  async stageFiles (version, outputDir) {
    generateManifestFile(this.platformRegion, this.publicKey)
    util.stageDir(
      path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources', this.locale, '/'),
      getManifestPath(this.locale),
      version,
      outputDir)
  }
}

const args = getPackagingArgs([
  ['-t, --target-regions <regions>', 'Comma separated list of regions that should generate SI component. For example: "AU-android,US-desktop,GB-ios"', ''],
  ['-u, --excluded-target-regions <regions>', 'Comma separated list of regions that should not generate SI component. For example: "AU-android,US-desktop,GB-ios"', '']
])

const targetComponents = params.getTargetComponents(args.targetRegions, args.excludedTargetRegions)

for (const platformRegion of Object.keys(targetComponents)) {
  const componentData = targetComponents[platformRegion]
  packageComponent(args, new NtpSponsoredImages(platformRegion, componentData))
}
