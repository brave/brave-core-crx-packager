/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-local-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/local-data-files-updater.pem

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import recursive from 'recursive-readdir-sync'
import util from '../lib/util.js'

async function stageFiles (componentType, datFile, version, outputDir) {
  if (componentNeedsStraightCopyFromUnpackedDir(componentType)) {
    util.stageDir(getManifestsDirByComponentType(componentType), getOriginalManifest(componentType), version, outputDir)
  } else {
    const datFileVersion = getDATFileVersionByComponentType(componentType)
    let outputDatDir = datFileVersion
    if (componentType === 'local-data-files-updater') {
      const index = datFile.indexOf('/dist/')
      if (index !== -1) {
        let baseDir = datFile.substring(index + '/dist/'.length)
        baseDir = baseDir.substring(0, baseDir.lastIndexOf('/'))
        outputDatDir = path.join(outputDatDir, baseDir)
      }
    }
    const parsedDatFile = path.parse(datFile)
    const datFileBase = parsedDatFile.base
    mkdirp.sync(path.join(outputDir, outputDatDir))
    const datFileName = getNormalizedDATFileName(parsedDatFile.name)
    const files = [
      { path: getOriginalManifest(componentType, datFileName), outputName: 'manifest.json' },
      { path: datFile, outputName: path.join(outputDatDir, datFileBase) }
    ]
    util.stageFiles(files, version, outputDir)
  }

  if (componentType === 'wallet-data-files-updater') {
    fs.unlinkSync(path.join(outputDir, 'package.json'))
  }
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
    case 'local-data-files-updater':
      return '1'
    default:
      // shouldn't be possible to get here
      return null
  }
}

const validComponentTypes = [
  'ethereum-remote-client',
  'wallet-data-files-updater',
  'local-data-files-updater'
]

const getManifestsDirByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
      return path.join('node_modules', 'ethereum-remote-client')
    case 'wallet-data-files-updater':
      return path.join('node_modules', 'brave-wallet-lists')
    case 'local-data-files-updater':
      // TODO(emerick): Make these work like ad-block (i.e., update
      // the corresponding repos with a script to generate the
      // manifest and then call that script here)
      return path.join('manifests', componentType)
    default:
      // shouldn't be possible to get here
      return null
  }
}

const getNormalizedDATFileName = (datFileName) =>
  datFileName === 'Greaselion' ||
  datFileName === 'debounce' ||
  datFileName === 'request-otr' ||
  datFileName === 'clean-urls' ||
  datFileName === 'https-upgrade-exceptions-list' ||
  datFileName === 'localhost-permission-allow-list' ||
  datFileName === 'messages' ||
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
    case 'local-data-files-updater':
      return [path.join('brave-lists', 'debounce.json'),
        path.join('brave-lists', 'request-otr.json'),
        path.join('brave-lists', 'clean-urls.json'),
        path.join('brave-lists', 'https-upgrade-exceptions-list.txt'),
        path.join('brave-lists', 'localhost-permission-allow-list.txt')
      ].concat(
        recursive(path.join('node_modules', 'brave-site-specific-scripts', 'dist')))
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
    .option('-t, --type <type>', 'component extension type', /^(local-data-files-updater|ethereum-remote-client|wallet-data-files-updater)$/i)
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
