/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')

const {generateCRXFile, installErrorHandlers} = require('./lib/util')

function stageFiles (datFile, outputDir) {
  const parsedDatFile = path.parse(datFile)

  const datFileBase = parsedDatFile.base
  const datFileName = getNormalizedDATFileName(parsedDatFile.name)

  const originalManifest = path.join('manifests', `${commander.type}-${datFileName}-manifest.json`)
  const outputManifest = path.join(outputDir, 'manifest.json')

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: commander.setVersion
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(datFile, path.join(outputDir, datFileBase))

  replace.sync(replaceOptions)
}

function getNormalizedDATFileName (datFileName) {
  if (datFileName === 'ABPFilterParserData' || datFileName === 'TrackingProtection') {
    return 'default'
  }
  return datFileName
}

function getDATFileListByComponentType (componentType) {
  let list = []

  switch (componentType) {
    case 'ad-block-updater':
      fs.readdirSync(path.join('node_modules', 'ad-block', 'out')).forEach(file => {
        if (file === 'SafeBrowsingData.dat') { return }
        list.push(path.join('node_modules', 'ad-block', 'out', file))
      })
      break
    case 'tracking-protection-updater':
      list.push(path.join('node_modules', 'tracking-protection', 'data', 'TrackingProtection.dat'))
      break
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }

  return list
}

function processDATFile (componentType, key, datFile) {
  const datFileName = getNormalizedDATFileName(path.parse(datFile).name)
  const stagingDir = path.join('build', componentType, datFileName)
  const crxOutputDir = path.join('build', componentType)
  const crxFile = path.join(crxOutputDir, `${componentType}-${datFileName}.crx`)

  let privateKeyFile = ''

  if (fs.lstatSync(key).isDirectory()) {
    privateKeyFile = path.join(key, `${componentType}-${datFileName}.pem`)
  } else {
    privateKeyFile = key
  }

  stageFiles(datFile, stagingDir)
  generateCRXFile(crxFile, privateKeyFile, stagingDir, crxOutputDir)
}

installErrorHandlers()

commander
  .option('-d, --keys-directory <dir>', 'directory containing multiple private keys for signing crx files')
  .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
  .option('-s, --set-version <x.x.x>', 'component extension version number')
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|tracking-protection-updater)$/i, 'ad-block-updater')
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

if (!commander.setVersion || !commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

getDATFileListByComponentType(commander.type).forEach(datFile => {
  processDATFile(commander.type, keyParam, datFile)
})
