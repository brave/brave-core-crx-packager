// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const commander = require('commander')
const util = require('../../lib/util')
const ntpUtil = require('../../lib/ntpUtil')
const allDestinations = require('./all-region-platforms')

// Downloads all current 'active' campaigns from S3 for each region/platform.
// Can include or exclude specific regions, for performance optimization.

function getTargetRegionList (targetRegions, excludedTargetRegions) {
  let targetRegionList = []
  if (targetRegions === '')
    targetRegionList = allDestinations
  else
    targetRegionList = targetRegions.split(',')

  if (excludedTargetRegions !== '')
    targetRegionList = targetRegionList.filter(region => !excludedTargetRegions.includes(region))

  // TODO(petemill): throw error if any entry isn't in allDestinations

  return targetRegionList
}

async function generateNTPSponsoredImages (dataUrl, targetRegions, excludedTargetRegions) {
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources')
  mkdirp.sync(rootResourceDir)

  for (const regionPlatformName of getTargetRegionList(targetRegions, excludedTargetRegions)) {
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

let targetRegions = ""
if (commander.targetRegions) {
  // Stripping unrelated chars.
  // Only upper case, commas and dashes are allowed.
  targetRegions = commander.targetRegions.replace(/[^A-Z,-]/g, "")
}
let excludedTargetRegions = ""
if (commander.excludedTargetRegions) {
  excludedTargetRegions = commander.excludedTargetRegions.replace(/[^A-Z,-]/g, "")
}

generateNTPSponsoredImages(commander.dataUrl, targetRegions, excludedTargetRegions)
