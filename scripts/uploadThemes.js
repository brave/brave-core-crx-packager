/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const path = require('path')
const util = require('./lib/util.js')

function parseManifest (manifestFile) {
  // Strip comments from manifest.json before parsing
  const json = fs.readFileSync(manifestFile).toString('utf-8').replace(/\/\/#.*/g, '')
  return JSON.parse(json)
}

function uploadCRXFile (crxFile) {
  const outputDir = path.join('build', 'themes')
  const themeName = path.parse(crxFile).name

  const manifest = path.join('node_modules', 'brave-chromium-themes', themeName, 'manifest.json')
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
  .option('-c, --crx-directory <dir>', 'crx directory')
  .option('-s, --set-version <x.x.x>', 'extension version number')
  .parse(process.argv)

if (!commander.crxDirectory || !fs.lstatSync(commander.crxDirectory).isDirectory()) {
  throw new Error('Missing or invalid option: --crx-directory')
}

if (!commander.setVersion || !commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

const outputDir = path.join('build', 'themes')
fs.readdirSync(commander.crxDirectory).forEach(file => {
  if (path.extname(file) === '.crx') {
    uploadCRXFile(path.join(outputDir, file))
  }
})
