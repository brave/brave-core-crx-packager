/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-speedreader -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/speedreader-updater.pem

const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const recursive = require('recursive-readdir-sync')
const replace = require('replace-in-file')
const util = require('../lib/util')

async function stageFiles (componentType, datFile, version, outputDir) {
  let datFileName

  if (componentNeedsStraightCopyFromUnpackedDir(componentType)) {
    const originalDir = getManifestsDirByComponentType(componentType)
    console.log('Copy dir:', originalDir, ' to:', outputDir)
    fs.copySync(originalDir, outputDir)
    if (componentType === 'wallet-data-files-updater') {
      fs.unlinkSync(path.join(outputDir, 'package.json'))
    }
  } else {
    const parsedDatFile = path.parse(datFile)
    const datFileBase = parsedDatFile.base
    datFileName = getNormalizedDATFileName(parsedDatFile.name)
    const datFileVersion = getDATFileVersionByComponentType(componentType)
    let outputDatDir = path.join(outputDir, datFileVersion)
    if (componentType === 'local-data-files-updater') {
      const index = datFile.indexOf('/dist/')
      if (index !== -1) {
        let baseDir = datFile.substring(index + '/dist/'.length)
        baseDir = baseDir.substring(0, baseDir.lastIndexOf('/'))
        outputDatDir = path.join(outputDatDir, baseDir)
      }
    }
    const outputDatFile = path.join(outputDatDir, datFileBase)
    mkdirp.sync(outputDatDir)
    console.log('copy dat file: ', datFile, ' to: ', outputDatFile)
    fs.copyFileSync(datFile, outputDatFile)
  }

  // Fix up the manifest version
  const originalManifest = getOriginalManifest(componentType, datFileName)
  const outputManifest = path.join(outputDir, 'manifest.json')
  console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)
}

const componentNeedsStraightCopyFromUnpackedDir = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
    case 'wallet-data-files-updater':
      return true
    default:
      return false
  }
}

const getDATFileVersionByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
    case 'wallet-data-files-updater':
      return '0'
    case 'https-everywhere-updater':
      return '6.0'
    case 'local-data-files-updater':
      return '1'
    case 'speedreader-updater':
      return JSON.parse(fs.readFileSync(
        path.join(
          'node_modules',
          'speedreader',
          'data',
          'default-manifest.json')).toString()).data_file_version
    default:
      // shouldn't be possible to get here
      return null
  }
}

const validComponentTypes = [
  'ethereum-remote-client',
  'wallet-data-files-updater',
  'https-everywhere-updater',
  'local-data-files-updater',
  'speedreader-updater'
]

const getManifestsDirByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
      return path.join('node_modules', 'ethereum-remote-client')
    case 'wallet-data-files-updater':
      return path.join('node_modules', 'brave-wallet-lists')
    case 'https-everywhere-updater':
    case 'local-data-files-updater':
      // TODO(emerick): Make these work like ad-block (i.e., update
      // the corresponding repos with a script to generate the
      // manifest and then call that script here)
      return path.join('manifests', componentType)
    case 'speedreader-updater':
      return path.join('node_modules', 'speedreader', 'data')
    default:
      // shouldn't be possible to get here
      return null
  }
}

const getNormalizedDATFileName = (datFileName) =>
  datFileName === 'httpse.leveldb' ||
  datFileName === 'ExtensionWhitelist' ||
  datFileName === 'Greaselion' ||
  datFileName === 'debounce' ||
  datFileName === 'messages' ||
  datFileName === 'speedreader-updater' ||
  datFileName === 'content-stylesheet' ||
  datFileName.endsWith('.bundle')
    ? 'default'
    : datFileName

const getOriginalManifest = (componentType, datFileName) => {
  return path.join(getManifestsDirByComponentType(componentType), datFileName ? `${datFileName}-manifest.json` : 'manifest.json')
}

const getDATFileListByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
    case 'wallet-data-files-updater':
      return ['']
    case 'https-everywhere-updater':
      return path.join('node_modules', 'https-everywhere-builder', 'out', 'httpse.leveldb.zip').split()
    case 'local-data-files-updater':
      return [path.join('node_modules', 'extension-whitelist', 'data', 'ExtensionWhitelist.dat'),
        path.join('node_modules', 'adblock-lists', 'brave-lists', 'debounce.json')].concat(
        recursive(path.join('node_modules', 'brave-site-specific-scripts', 'dist')))
    case 'speedreader-updater':
      return [path.join('node_modules', 'speedreader', 'data', 'speedreader-updater.dat'),
        path.join('node_modules', 'speedreader', 'data', 'content-stylesheet.css')]
    default:
      // shouldn't be possible to get here
      return null
  }
}

const postNextVersionWork = (componentType, datFileName, key, publisherProofKey,
  binary, localRun, datFile, version) => {
  const stagingDir = path.join('build', componentType, datFileName)
  const crxOutputDir = path.join('build', componentType)
  const crxFile = path.join(crxOutputDir, datFileName ? `${componentType}-${datFileName}.crx` : `${componentType}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, datFileName ? `${componentType}-${datFileName}.pem` : `${componentType}.pem`)
  }
  stageFiles(componentType, datFile, version, stagingDir).then(() => {
    if (!localRun) {
      util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
        stagingDir)
    }
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const processDATFile = (binary, endpoint, region, componentType, key,
  publisherProofKey, localRun, datFile) => {
  const datFileName = getNormalizedDATFileName(path.parse(datFile).name)

  const originalManifest = getOriginalManifest(componentType, datFileName)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  if (!localRun) {
    util.getNextVersion(endpoint, region, id).then((version) => {
      postNextVersionWork(componentType, datFileName, key, publisherProofKey,
        binary, localRun, datFile, version)
    })
  } else {
    postNextVersionWork(componentType, datFileName, key, publisherProofKey,
      binary, localRun, datFile, '1.0.0')
  }
}

const processJob = (commander, keyParam) => {
  if (!validComponentTypes.includes(commander.type)) {
    throw new Error('Unrecognized component extension type: ' + commander.type)
  }
  getDATFileListByComponentType(commander.type)
    .forEach(processDATFile.bind(null, commander.binary, commander.endpoint,
      commander.region, commander.type, keyParam,
      commander.publisherProofKey,
      commander.localRun))
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
    .option('-t, --type <type>', 'component extension type', /^(https-everywhere-updater|local-data-files-updater|ethereum-remote-client|wallet-data-files-updater|speedreader-updater)$/i)
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely'))
  .parse(process.argv)

let keyParam = ''

if (!commander.localRun) {
  if (fs.existsSync(commander.keyFile)) {
    keyParam = commander.keyFile
  } else if (fs.existsSync(commander.keysDirectory)) {
    keyParam = commander.keysDirectory
  } else {
    throw new Error('Missing or invalid private key file/directory')
  }
}

if (!commander.localRun) {
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    processJob(commander, keyParam)
  })
} else {
  processJob(commander, keyParam)
}
