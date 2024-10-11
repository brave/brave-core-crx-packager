// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/. */

import path from 'path'
import { mkdirp } from 'mkdirp'
import commander from 'commander'
import util from '../../lib/util.js'
import ntpUtil from '../../lib/ntpUtil.js'
import params from './params.js'

// Downloads all current 'active' campaigns from S3 for each region/platform.
// Can include or exclude specific regions, for performance optimization.

/**
 *
 * @param {string} dataUrl
 * @param {import('./region-platform-component-metadata.js').RegionPlatformComponentMetadata} targetComponents
 */
async function generateNTPSponsoredImages (dataUrl, targetComponents) {
  // Normalize url for joining
  if (!dataUrl.endsWith('/')) {
    dataUrl += '/'
  }
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources')
  mkdirp.sync(rootResourceDir)

  for (const regionPlatformName of Object.keys(targetComponents)) {
    console.log(`Downloading ${regionPlatformName}...`)
    const targetResourceDir = path.join(rootResourceDir, regionPlatformName)
    mkdirp.sync(targetResourceDir)
    const regionPlatformPath = regionPlatformName.replace('-', '/')
    const baseJsonFileUrl = `${dataUrl}${regionPlatformPath}`

    await Promise.all([
      ntpUtil.prepareAssets(`${baseJsonFileUrl}/photo.json`, targetResourceDir),
      ntpUtil.prepareAssets(`${baseJsonFileUrl}/si-photo.json`, targetResourceDir, 'si-photo.json')
    ])
  }
}

util.installErrorHandlers()

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp sponsored images')
  .option('-t, --target-regions <regions>', 'Comma separated list of regions that should generate SI component. For example: "AU-android,US-desktop,GB-ios"', '')
  .option('-u, --excluded-target-regions <regions>', 'Comma separated list of regions that should not generate SI component. For example: "AU-android,US-desktop,GB-ios"', '')
  .parse(process.argv)

const targetComponents = params.getTargetComponents(commander.targetRegions, commander.excludedTargetRegions)

if (!commander.dataUrl) {
  throw new Error('--data-url is required!')
}

generateNTPSponsoredImages(commander.dataUrl, targetComponents)
