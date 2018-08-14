/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const path = require('path')
const util = require('../lib/util')

util.installErrorHandlers()

commander
  .option('-c, --crx-directory <dir>', 'crx directory')
  .parse(process.argv)

if (!commander.crxDirectory || !fs.lstatSync(commander.crxDirectory).isDirectory()) {
  throw new Error('Missing or invalid option: --crx-directory')
}

const outputDir = path.join('build', 'themes')
fs.readdirSync(commander.crxDirectory).forEach(file => {
  if (path.extname(file) === '.crx') {
    util.uploadCRXFile(path.join(outputDir, file), outputDir)
  }
})
