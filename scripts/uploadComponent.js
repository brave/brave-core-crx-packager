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
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|local-data-files-updater|ethereum-remote-client|ntp-sponsored-images|ntp-super-referrer|tor-client-updater)$/i, 'ad-block-updater')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
  .parse(process.argv)

let crxParam = ''

if (fs.existsSync(commander.crxFile)) {
  crxParam = commander.crxFile
} else if (fs.existsSync(commander.crxDirectory)) {
  crxParam = commander.crxDirectory
} else {
  throw new Error('Missing or invalid crx file/directory', commander.crxFile, commander.crxDirectory)
}

let uploadJobs = []
if (fs.lstatSync(crxParam).isDirectory()) {
  fs.readdirSync(crxParam).forEach(file => {
    if (path.parse(file).ext === '.crx') {
      uploadJobs.push(util.uploadCRXFile(commander.endpoint, commander.region, path.join(crxParam, file)))
    }
  })
} else {
  uploadJobs.push(util.uploadCRXFile(commander.endpoint, commander.region, crxParam))
}

Promise.all(uploadJobs).then(() => {
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    if (fs.lstatSync(crxParam).isDirectory()) {
      fs.readdirSync(crxParam).forEach(file => {
        if (path.parse(file).ext === '.crx') {
          util.updateDBForCRXFile(commander.endpoint, commander.region, path.join(crxParam, file))
        }
      })
    } else {
      util.updateDBForCRXFile(commander.endpoint, commander.region, crxParam)
    }
  })
}).catch((err) => {
  console.error('Caught exception:', err)
})
