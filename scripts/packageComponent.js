/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ad-block-updater.pem

const childProcess = require('child_process')
const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const recursive = require("recursive-readdir-sync");
const replace = require('replace-in-file')
const util = require('../lib/util')

const stageFiles = (componentType, datFile, version, outputDir) => {
  let datFileName
  
  // ad-block components are in the correct folder
  // we don't need to stage the crx files
  if(componentType == 'ad-block-updater') {
    const resourceFileName = 'resources.json'
    const resourceJsonPath = path.join('build', componentType, 'default', resourceFileName)
    const outputManifest = path.join(outputDir, 'manifest.json')
    const outputResourceJSON = path.join(outputDir, resourceFileName)
    const replaceOptions = {
      files: outputManifest,
      from: /0\.0\.0/,
      to: version
    }
    replace.sync(replaceOptions)
    if (resourceJsonPath != outputResourceJSON) {
      fs.copyFileSync(resourceJsonPath, outputResourceJSON)
    }
    return;
  }

  if (componentNeedsStraightCopyFromUnpackedDir(componentType)) {
    const originalDir = getManifestsDirByComponentType(componentType)
    console.log('Copy dir:', originalDir, ' to:', outputDir)
    fs.copySync(originalDir, outputDir)
  } else {
    const parsedDatFile = path.parse(datFile)
    const datFileBase = parsedDatFile.base
    datFileName = getNormalizedDATFileName(parsedDatFile.name)
    const datFileVersion = getDATFileVersionByComponentType(componentType)
    let outputDatDir = path.join(outputDir, datFileVersion)
    if (componentType == 'local-data-files-updater') {
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
      return true
    default:
      return false
  }
}

const getDATFileVersionByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
      return '0'
    case 'ad-block-updater':
      return ''
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
          'default-manifest.json')).toString())['data_file_version'];
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const generateManifestFilesByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
      // Provides its own manifest file
      break
    case 'ad-block-updater':
      break
    case 'https-everywhere-updater':
    case 'local-data-files-updater':
      // TODO(emerick): Make these work like ad-block (i.e., update
      // the corresponding repos with a script to generate the
      // manifest and then call that script here)
      break
    case 'speedreader-updater':
      // Provides its own manifest file
      break
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const getManifestsDirByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
      return path.join('node_modules', 'ethereum-remote-client')
    case 'ad-block-updater':
      return path.join('build', 'ad-block-updater')
    case 'https-everywhere-updater':
    case 'local-data-files-updater':
      // TODO(emerick): Make these work like ad-block
      return path.join('manifests', componentType)
    case 'speedreader-updater':
      return path.join('node_modules', 'speedreader', 'data')
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const getNormalizedDATFileName = (datFileName) =>
  datFileName === 'ABPFilterParserData' ||
  datFileName === 'httpse.leveldb' ||
  datFileName === 'ReferrerWhitelist' ||
  datFileName === 'ExtensionWhitelist' ||
  datFileName === 'Greaselion' ||
  datFileName === 'messages' ||
  datFileName === 'AutoplayWhitelist' || 
  datFileName === 'speedreader-updater' || 
  datFileName === 'content-stylesheet' ||
  datFileName.endsWith('.bundle') ? 'default' : datFileName

const getOriginalManifest = (componentType, datFileName) => {
  if (componentType == 'ad-block-updater') {
    return path.join(getManifestsDirByComponentType(componentType), datFileName, 'manifest.json')
  }
  return path.join(getManifestsDirByComponentType(componentType), datFileName ? `${datFileName}-manifest.json` : 'manifest.json')
}

const getDATFileListByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
      return ['']
    case 'ad-block-updater':
      return recursive(path.join('build', 'ad-block-updater'))
        .filter(file => {
          return (path.extname(file) === '.dat' && !file.includes('test-data'))
        })
        .reduce((acc, val) => {
          acc.push(path.join(val))
          return acc
        }, [])
    case 'https-everywhere-updater':
      return path.join('node_modules', 'https-everywhere-builder', 'out', 'httpse.leveldb.zip').split()
    case 'local-data-files-updater':
      return [path.join('node_modules', 'autoplay-whitelist', 'data', 'AutoplayWhitelist.dat'),
	      path.join('node_modules', 'extension-whitelist', 'data', 'ExtensionWhitelist.dat'),
	      path.join('node_modules', 'referrer-whitelist', 'data', 'ReferrerWhitelist.json')].concat(
		recursive(path.join('node_modules', 'brave-site-specific-scripts', 'dist')))
    case 'speedreader-updater':
      return [path.join('node_modules', 'speedreader', 'data', 'speedreader-updater.dat'),
        path.join('node_modules', 'speedreader', 'data', 'content-stylesheet.css')]
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const processDATFile = (binary, endpoint, region, componentType, key, datFile) => {
  var datFileName = getNormalizedDATFileName(path.parse(datFile).name)
  if (componentType == 'ad-block-updater') {
    // we need the last (build/ad-block-updater/<uuid>) folder name for ad-block-updater
    datFileName = path.dirname(datFile).split(path.sep).pop()
  }

  const originalManifest = getOriginalManifest(componentType, datFileName)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  util.getNextVersion(endpoint, region, id).then((version) => {
    const stagingDir = path.join('build', componentType, datFileName)
    const crxOutputDir = path.join('build', componentType)
    const crxFile = path.join(crxOutputDir, datFileName ? `${componentType}-${datFileName}.crx` : `${componentType}.crx`)
    const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, datFileName ? `${componentType}-${datFileName}.pem` : `${componentType}.pem`)
    stageFiles(componentType, datFile, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
  .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|local-data-files-updater|ethereum-remote-client|speedreader-updater)$/i, 'ad-block-updater')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  generateManifestFilesByComponentType(commander.type)
  getDATFileListByComponentType(commander.type)
    .forEach(processDATFile.bind(null, commander.binary, commander.endpoint, commander.region, commander.type, keyParam))
})
