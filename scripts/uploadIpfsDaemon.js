/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const path = require('path')
const util = require('../lib/util')

util.installErrorHandlers()

commander
  .option('-v, --vault-updater-path <dir>', 'directory containing the brave/vault-updater/data/')
  .option('-d, --crx-directory <dir>', 'directory containing multiple crx files to upload')
  .option('-f, --crx-file <file>', 'crx file to upload', 'extension.crx')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
  .parse(process.argv)

let crxParam = ''

if (fs.existsSync(commander.crxFile)) {
  crxParam = commander.crxFile
} else if (fs.existsSync(commander.crxDirectory)) {
  crxParam = commander.crxDirectory
} else {
  throw new Error('Missing or invalid crx file/directory')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const outputDir = path.join('build', 'ipfs-daemon-updater')
  if (fs.lstatSync(crxParam).isDirectory()) {
    fs.readdirSync(crxParam).forEach(file => {
      if (path.parse(file).ext === '.crx') {
        util.uploadCRXFile(commander.endpoint, commander.region, commander.vaultUpdaterPath, path.join(crxParam, file), outputDir)
      }
    })
  } else {
    util.uploadCRXFile(commander.endpoint, commander.region, commander.vaultUpdaterPath, crxParam, outputDir)
  }
})
