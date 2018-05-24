/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const path = require('path')
const util = require('./lib/util.js')

function parseManifest (manifestFile) {
  return JSON.parse(fs.readFileSync(manifestFile))
}

function uploadCRXFile (crxFile) {
  const outputDir = path.join('build', commander.type)

  const manifest = path.join('manifests', commander.type + '-manifest.json')
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
  .option('-c, --crx <crx-file>', 'crx file', 'extension.crx')
  .option('-s, --set-version <x.x.x>', 'component extension version number')
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|tracking-protection-updater)$/i, 'ad-block-updater')
  .parse(process.argv)

if (!fs.existsSync(commander.crx)) {
  throw new Error('Missing CRX file: ' + commander.crx)
}

if (!commander.setVersion || !commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

uploadCRXFile(commander.crx)
