/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const path = require('path')
const util = require('../lib/util')

util.installErrorHandlers()

commander
  .option('-d, --crx-directory <dir>', 'directory containing multiple crx files to upload')
  .option('-f, --crx-file <file>', 'crx file to upload', 'extension.crx')
  .parse(process.argv)

let crxParam = ''

if (fs.existsSync(commander.crxFile)) {
  crxParam = commander.crxFile
} else if (fs.existsSync(commander.crxDirectory)) {
  crxParam = commander.crxDirectory
} else {
  throw new Error('Missing or invalid crx file/directory')
}

const outputDir = path.join('build', 'tor-client-updater')
if (fs.lstatSync(crxParam).isDirectory()) {
  fs.readdirSync(crxParam).forEach(file => {
    if (path.parse(file).ext === '.crx') {
      util.uploadCRXFile(path.join(crxParam, file), outputDir)
    }
  })
} else {
  util.uploadCRXFile(crxParam, outputDir)
}
