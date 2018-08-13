/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const path = require('path')
const util = require('./lib/util.js')

const parseManifest = (manifestFile) => {
  return JSON.parse(fs.readFileSync(manifestFile))
}

const uploadCRXFile = (crxFile) => {
  const outputDir = path.join('build', 'tor-client-updater')

  const crxFileName = path.parse(crxFile).name
  const manifest = path.join('manifests', 'tor-client-updater', `${crxFileName}-manifest.json`)
  const data = parseManifest(manifest)

  const id = util.getIDFromBase64PublicKey(data.key)
  const version = commander.setVersion
  const hash = util.generateSHA256HashOfFile(crxFile)
  const name = data.name

  const result = util.uploadExtension(id, version, hash, name, crxFile, outputDir)
  if (result) {
    console.log(result)
  }

  console.log(`Uploaded ${crxFile}`)
}

util.installErrorHandlers()

commander
  .option('-d, --crx-directory <dir>', 'directory containing multiple crx files to upload')
  .option('-f, --crx-file <file>', 'crx file to upload', 'extension.crx')
  .option('-s, --set-version <x.x.x>', 'component extension version number')
  .parse(process.argv)

let crxParam = ''

if (fs.existsSync(commander.crxFile)) {
  crxParam = commander.crxFile
} else if (fs.existsSync(commander.crxDirectory)) {
  crxParam = commander.crxDirectory
} else {
  throw new Error('Missing or invalid crx file/directory')
}

if (!commander.setVersion || !commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

if (fs.lstatSync(crxParam).isDirectory()) {
  fs.readdirSync(crxParam).forEach(file => {
    if (path.parse(file).ext === '.crx') {
      uploadCRXFile(path.join(crxParam, file))
    }
  })
} else {
  uploadCRXFile(crxParam)
}
