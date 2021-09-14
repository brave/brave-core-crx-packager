/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs-extra')
const commander = require('commander')
const util = require('../lib/util')
const ntpUtil = require('../../lib/ntpUtil')
const allDestinations = require('./all-region-platforms')

function getTargetRegionList(targetRegions, excludedTargetRegions) {
  let targetRegionList = []
  if (targetRegions === '')
    targetRegionList = allDestinations
  else
    targetRegionList = targetRegions.split(',')

  if (excludedTargetRegions === '')
    return targetRegionList

  return targetRegionList.filter(region => !excludedTargetRegions.includes(region))
}

async function generateNTPSponsoredImages (dataUrl, targetRegions, excludedTargetRegions) {
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources')
  mkdirp.sync(rootResourceDir)

  for (const region of getTargetRegionList(targetRegions, excludedTargetRegions)) {
    console.log(`Downloading ${region}...`)
    const targetResourceDir = path.join(rootResourceDir, region)
    mkdirp.sync(targetResourceDir)
    const sourceJsonFileUrl = `${dataUrl}${region}/photo.json`
    await ntpUtil.prepareAssets(sourceJsonFileUrl, targetResourceDir)
  }
}

util.installErrorHandlers()

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp sponsored images')
  .option('-t, --target-regions <regions>', 'Comma separated list of regions that should generate SI component. For example: "AU,US,GB"', '')
  .option('-u, --excluded-target-regions <regions>', 'Comma separated list of regions that should not generate SI component. For example: "AU,US,GB"', '')
  .parse(process.argv)

let targetRegions = ""
if (commander.targetRegions) {
  // Stripping unrelated chars.
  // Only upper case and commas are allowed.
  targetRegions = commander.targetRegions.replace(/[^A-Z,]/g, "")
}
let excludedTargetRegions = ""
if (commander.excludedTargetRegions) {
  excludedTargetRegions = commander.excludedTargetRegions.replace(/[^A-Z,]/g, "")
}

generateNTPSponsoredImages(commander.dataUrl, targetRegions, excludedTargetRegions)
