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
  const files = [
    { path: getOriginalManifest(), outputName: 'manifest.json' },
    { path: path.join('brave-lists', 'debounce.json'), outputName: path.join(datFileVersion, 'debounce.json') },
    { path: path.join('brave-lists', 'request-otr.json'), outputName: path.join(datFileVersion, 'request-otr.json') },
    { path: path.join('brave-lists', 'clean-urls.json'), outputName: path.join(datFileVersion, 'clean-urls.json') },
    { path: path.join('brave-lists', 'https-upgrade-exceptions-list.txt'), outputName: path.join(datFileVersion, 'https-upgrade-exceptions-list.txt') },
    { path: path.join('brave-lists', 'localhost-permission-allow-list.txt'), outputName: path.join(datFileVersion, 'localhost-permission-allow-list.txt') }
  ].concat(
    recursive(path.join('node_modules', 'brave-site-specific-scripts', 'dist')).map(f => {
      let outputDatDir = datFileVersion
      const index = f.indexOf('/dist/')
      let baseDir = f.substring(index + '/dist/'.length)
      baseDir = baseDir.substring(0, baseDir.lastIndexOf('/'))
      outputDatDir = path.join(outputDatDir, baseDir)
      mkdirp.sync(path.join(outputDir, outputDatDir))
      return {
        path: f,
        outputName: path.join(outputDatDir, path.parse(f).base)
      }
    }))
  util.stageFiles(files, version, outputDir)
}

const postNextVersionWork = (key, publisherProofKey, binary, localRun, version) => {
  const componentType = 'local-data-files-updater'
  const datFileName = 'default'
  const stagingDir = path.join('build', componentType, datFileName)
  const crxFile = path.join('build', componentType, `${componentType}-${datFileName}.crx`)
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
