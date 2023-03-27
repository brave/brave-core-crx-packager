/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import util from '../lib/util.js'

util.installErrorHandlers()

commander
  .option('-k, --key <file>', 'file containing private key for signing crx file')
  .parse(process.argv)

console.log(`DEPRECATE: youtubedown.js is no longer supported.
Remove this script when jenkins removes use of this.`)
