/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ad-block-updater.pem

const childProcess = require('child_process')
const commander = require('commander')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const stageFiles = (componentType, datFile, version, outputDir) => {
  const parsedDatFile = path.parse(datFile)

  const datFileBase = parsedDatFile.base
  const datFileName = getNormalizedDATFileName(parsedDatFile.name)
  const datFileVersion = getDATFileVersionByComponentType(componentType)

  const outputDatDir = path.join(outputDir, datFileVersion)
  const outputDatFile = path.join(outputDatDir, datFileBase)

  const originalManifest = getOriginalManifest(componentType, datFileName)
  const outputManifest = path.join(outputDir, 'manifest.json')

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }

  mkdirp.sync(outputDatDir)

  fs.copyFileSync(originalManifest, outputManifest)
  console.log('copy dat file: ', datFile, ' to: ', outputDatFile)
  fs.copyFileSync(datFile, outputDatFile)

  replace.sync(replaceOptions)
}

const getDATFileVersionByComponentType = (componentType) => {
  switch (componentType) {
    case 'ad-block-updater':
      return fs.readFileSync(path.join('node_modules', 'ad-block', 'data_file_version.h')).toString()
        .match(/DATA_FILE_VERSION\s*=\s*(\d+)/)[1]
    case 'https-everywhere-updater':
      return '6.0'
    case 'local-data-files-updater':
      return '1'
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const generateManifestFilesByComponentType = (componentType) => {
  switch (componentType) {
    case 'ad-block-updater':
      childProcess.execSync(`npm run --prefix ${path.join('node_modules', 'ad-block')} manifest-files`)
      break
    case 'https-everywhere-updater':
    case 'local-data-files-updater':
      // TODO(emerick): Make these work like ad-block (i.e., update
      // the corresponding repos with a script to generate the
      // manifest and then call that script here)
      break
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const getManifestsDirByComponentType = (componentType) => {
  switch (componentType) {
    case 'ad-block-updater':
      return path.join('node_modules', 'ad-block', 'out')
    case 'https-everywhere-updater':
    case 'local-data-files-updater':
      // TODO(emerick): Make these work like ad-block
      return path.join('manifests', componentType)
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const getNormalizedDATFileName = (datFileName) =>
  datFileName === 'ABPFilterParserData' ||
  datFileName === 'httpse.leveldb' ||
  datFileName === 'TrackingProtection' ||
  datFileName === 'StorageTrackingProtection' ||
  datFileName === 'ReferrerWhitelist' ||
  datFileName === 'ExtensionWhitelist' ||
  datFileName === 'AutoplayWhitelist' ? 'default' : datFileName

const getOriginalManifest = (componentType, datFileName) => {
  return path.join(getManifestsDirByComponentType(componentType), `${datFileName}-manifest.json`)
}

const getDATFileListByComponentType = (componentType) => {
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
    case 'https-everywhere-updater':
      return path.join('node_modules', 'https-everywhere-builder', 'out', 'httpse.leveldb.zip').split()
    case 'local-data-files-updater':
      return [path.join('node_modules', 'autoplay-whitelist', 'data', 'AutoplayWhitelist.dat'),
        path.join('node_modules', 'extension-whitelist', 'data', 'ExtensionWhitelist.dat'),
        path.join('node_modules', 'referrer-whitelist', 'data', 'ReferrerWhitelist.json'),
        path.join('node_modules', 'tracking-protection', 'data', 'TrackingProtection.dat'),
        path.join('node_modules', 'tracking-protection', 'data', 'StorageTrackingProtection.dat')]
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
}

const processDATFile = (binary, endpoint, region, componentType, key, datFile) => {
  const datFileName = getNormalizedDATFileName(path.parse(datFile).name)
  const originalManifest = getOriginalManifest(componentType, datFileName)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  util.getNextVersion(endpoint, region, id).then((version) => {
    const stagingDir = path.join('build', componentType, datFileName)
    const crxOutputDir = path.join('build', componentType)
    const crxFile = path.join(crxOutputDir, `${componentType}-${datFileName}.crx`)
    const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}-${datFileName}.pem`)
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
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|local-data-files-updater)$/i, 'ad-block-updater')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
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
