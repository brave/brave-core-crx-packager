/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const commander = require('commander')
const util = require('../lib/util')
const ntpUtil = require('../lib/ntpUtil')

async function generateNTPSuperReferrer (dataUrl, referrerName) {
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-super-referrer', 'resources')
  mkdirp.sync(rootResourceDir)

  console.log(`Downloading for ${referrerName}...`)
  const targetResourceDir = path.join(rootResourceDir, referrerName)
  mkdirp.sync(targetResourceDir)
  const jsonFileUrl = `${dataUrl}superreferrer/${referrerName}/data.json`
  await ntpUtil.prepareAssets(jsonFileUrl, targetResourceDir)
}

util.installErrorHandlers()

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp super referrer')
  .option('-n, --super-referrer-name <name>', 'super referrer name for this component')
  .parse(process.argv)

generateNTPSuperReferrer(commander.dataUrl, commander.superReferrerName)
