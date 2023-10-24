/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import path from 'path'
import { mkdirp } from 'mkdirp'
import commander from 'commander'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

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
