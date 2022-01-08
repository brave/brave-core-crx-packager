// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const commander = require('commander')
const util = require('../../lib/util')
const ntpUtil = require('../../lib/ntpUtil')
const params = require('./params')

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
    const sourceJsonFileUrl = `${dataUrl}${regionPlatformPath}/photo.json`
    await ntpUtil.prepareAssets(sourceJsonFileUrl, targetResourceDir)
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
