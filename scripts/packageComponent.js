/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')

const {generateCRXFile, installErrorHandlers} = require('./lib/util')

function stageFiles (commander, outputDir, datFile) {
  const baseDatFile = path.parse(datFile).base

  const originalManifest = path.join('manifests', commander.type + '-manifest.json')
  const updatedManifest = path.join(outputDir, 'manifest.json')

  const replaceOptions = {
    files: updatedManifest,
    from: /0\.0\.0/g,
    to: commander.setVersion
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, updatedManifest)
  fs.copyFileSync(datFile, path.join(outputDir, baseDatFile))

  replace.sync(replaceOptions)
}

function getDATFileFromComponentType (componentType) {
  switch (componentType) {
    case 'ad-block-updater':
      return path.join('node_modules', 'ad-block', 'out', 'ABPFilterParserData.dat')
    case 'tracking-protection-updater':
      return path.join('node_modules', 'tracking-protection', 'data', 'TrackingProtection.dat')
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

installErrorHandlers()

commander
  .option('-k, --key <key>', 'private key file path', 'key.pem')
  .option('-s, --set-version <x.x.x>', 'component extension version number')
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|tracking-protection-updater)$/i, 'ad-block-updater')
  .parse(process.argv)

if (!fs.existsSync(commander.key)) {
  throw new Error('Missing private key file: ' + commander.key)
}

if (!commander.setVersion) {
  throw new Error('Missing required option: --set-version')
}

if (!commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

const outputDir = path.join('build', commander.type)
const inputDir = path.join('build', commander.type)
const datFile = getDATFileFromComponentType(commander.type)
const crxFile = path.join(outputDir, commander.type + '.crx')
const privateKeyFile = commander.key

stageFiles(commander, outputDir, datFile)
generateCRXFile(crxFile, privateKeyFile, inputDir, outputDir)
