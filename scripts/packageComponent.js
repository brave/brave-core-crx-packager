/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const commander = require('commander')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')

const {generateCRXFile, installErrorHandlers} = require('./lib/util')

function stageFiles (componentType, datFile, outputDir) {
  const parsedDatFile = path.parse(datFile)

  const datFileBase = parsedDatFile.base
  const datFileName = getNormalizedDATFileName(parsedDatFile.name)
  const datFileVersion = getDATFileVersionByComponentType(componentType)

  const outputDatDir = path.join(outputDir, datFileVersion)
  const outputDatFile = path.join(outputDatDir, datFileBase)

  const originalManifest = path.join(getManifestsDirByComponentType(componentType), `${datFileName}-manifest.json`)
  const outputManifest = path.join(outputDir, 'manifest.json')

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: commander.setVersion
  }

  mkdirp.sync(outputDatDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(datFile, outputDatFile)

  replace.sync(replaceOptions)
}

function getDATFileVersionByComponentType (componentType) {
  switch (componentType) {
    case 'ad-block-updater':
      return fs.readFileSync(path.join('node_modules', 'ad-block', 'data_file_version.h')).toString()
        .match(/DATA_FILE_VERSION\s*=\s*(\d+)/)[1]
    case 'https-everywhere-updater':
      return '1'
    case 'tracking-protection-updater':
      return '1'
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

function generateManifestFilesByComponentType (componentType) {
  switch (componentType) {
    case 'ad-block-updater':
      childProcess.execSync(`npm run --prefix ${path.join('node_modules', 'ad-block')} manifest-files`)
      break
    case 'tracking-protection-updater':
      // TODO(emerick): Make this work like ad-block (i.e., update the
      // tracking-protection repo with a script to generate the
      // manifest and then call that script here)
      break
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

function getManifestsDirByComponentType (componentType) {
  switch (componentType) {
    case 'ad-block-updater':
      return path.join('node_modules', 'ad-block', 'out')
    case 'tracking-protection-updater':
      // TODO(emerick): Make this work like ad-block
      return path.join('manifests')
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const getNormalizedDATFileName = (datFileName) => datFileName === 'ABPFilterParserData' || datFileName === 'TrackingProtection' ? 'default' : datFileName

function getDATFileListByComponentType (componentType) {
  switch (componentType) {
    case 'ad-block-updater':
      return fs.readdirSync(path.join('node_modules', 'ad-block', 'out'))
        .filter(file => {
          return (path.extname(file) === '.dat' && file !== 'SafeBrowsingData.dat')
        })
        .reduce((acc, val) => {
          acc.push(path.join('node_modules', 'ad-block', 'out', val))
          return acc
        }, [])
    case 'tracking-protection-updater':
      return path.join('node_modules', 'tracking-protection', 'data', 'TrackingProtection.dat').split()
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

function processDATFile (componentType, key, datFile) {
  const datFileName = getNormalizedDATFileName(path.parse(datFile).name)
  const stagingDir = path.join('build', componentType, datFileName)
  const crxOutputDir = path.join('build', componentType)
  const crxFile = path.join(crxOutputDir, `${componentType}-${datFileName}.crx`)
  const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}-${datFileName}.pem`)

  stageFiles(componentType, datFile, stagingDir)
  generateCRXFile(crxFile, privateKeyFile, stagingDir, crxOutputDir)
}

installErrorHandlers()

commander
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
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

generateManifestFilesByComponentType(commander.type)
getDATFileListByComponentType(commander.type).forEach(processDATFile.bind(null, commander.type, keyParam))
