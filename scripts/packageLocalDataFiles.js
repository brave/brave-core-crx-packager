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

const getOriginalManifest = () => {
  return path.join('manifests', 'local-data-files-updater', 'default-manifest.json')
}

const stageFiles = (version, outputDir) => {
  const datFileVersion = '1'
  const fileList = [
    path.join('brave-lists', 'debounce.json'),
    path.join('brave-lists', 'request-otr.json'),
    path.join('brave-lists', 'clean-urls.json'),
    path.join('brave-lists', 'https-upgrade-exceptions-list.txt'),
    path.join('brave-lists', 'localhost-permission-allow-list.txt')
  ].concat(
    recursive(path.join('node_modules', 'brave-site-specific-scripts', 'dist')))
  fileList.forEach(datFile => {
    let outputDatDir = datFileVersion
    const index = datFile.indexOf('/dist/')
    if (index !== -1) {
      let baseDir = datFile.substring(index + '/dist/'.length)
      baseDir = baseDir.substring(0, baseDir.lastIndexOf('/'))
      outputDatDir = path.join(outputDatDir, baseDir)
    }
    const parsedDatFile = path.parse(datFile)
    const datFileBase = parsedDatFile.base
    mkdirp.sync(path.join(outputDir, outputDatDir))
    const files = [
      { path: getOriginalManifest(), outputName: 'manifest.json' },
      { path: datFile, outputName: path.join(outputDatDir, datFileBase) }
    ]
    util.stageFiles(files, version, outputDir)
  })
}

const postNextVersionWork = (key, publisherProofKey, binary, localRun, version) => {
  const componentType = 'local-data-files-updater'
  const datFileName = 'default'
  const stagingDir = path.join('build', componentType, datFileName)
  const crxOutputDir = path.join('build', componentType)
  const crxFile = path.join(crxOutputDir, `${componentType}-${datFileName}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}-${datFileName}.pem`)
  }
  stageFiles(version, stagingDir)
  if (!localRun) {
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      stagingDir)
  }
  console.log(`Generated ${crxFile} with version number ${version}`)
}

const processDATFile = (binary, endpoint, region, key, publisherProofKey, localRun) => {
  const originalManifest = getOriginalManifest()
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  if (!localRun) {
    util.getNextVersion(endpoint, region, id).then((version) => {
      postNextVersionWork(key, publisherProofKey,
        binary, localRun, version)
    })
  } else {
    postNextVersionWork(key, publisherProofKey,
      binary, localRun, '1.0.0')
  }
}

const processJob = (commander, keyParam) => {
  processDATFile(commander.binary, commander.endpoint, commander.region,
    keyParam, commander.publisherProofKey, commander.localRun)
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
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
