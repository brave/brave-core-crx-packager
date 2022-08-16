/* Copyright (c) 2022 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ad-block-updater-regional-component-keys

const commander = require('commander')
const fs = require('fs-extra')
const path = require('path')
const recursive = require('recursive-readdir-sync')
const replace = require('replace-in-file')
const util = require('../lib/util')

async function stageFiles (version, outputDir) {
  // ad-block components are in the correct folder
  // we don't need to stage the crx files
  const resourceFileName = 'resources.json'
  const resourceJsonPath = path.join('build', 'ad-block-updater', 'default', resourceFileName)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputResourceJSON = path.join(outputDir, resourceFileName)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  replace.sync(replaceOptions)
  if (resourceJsonPath !== outputResourceJSON) {
    fs.copyFileSync(resourceJsonPath, outputResourceJSON)
  }
}

const postNextVersionWork = (datFileName, key, publisherProofKey,
  binary, localRun, version) => {
  const stagingDir = path.join('build', 'ad-block-updater', datFileName)
  const crxOutputDir = path.join('build', 'ad-block-updater')
  const crxFile = path.join(crxOutputDir, datFileName ? `ad-block-updater-${datFileName}.crx` : 'ad-block-updater.crx')
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = path.join(key, datFileName ? `ad-block-updater-${datFileName}.pem` : 'ad-block-updater.pem')
  }
  stageFiles(version, stagingDir).then(() => {
    if (!localRun) {
      util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
        stagingDir)
    }
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const getOriginalManifest = (datFileName) => {
  const manifestsDir = path.join('build', 'ad-block-updater')
  return path.join(manifestsDir, datFileName, 'manifest.json')
}

const processDATFile = (binary, endpoint, region, keyDir,
  publisherProofKey, localRun, datFile) => {
  // we need the last (build/ad-block-updater/<uuid>) folder name
  const datFileName = path.dirname(datFile).split(path.sep).pop()

  const originalManifest = getOriginalManifest(datFileName)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  if (!localRun) {
    util.getNextVersion(endpoint, region, id).then((version) => {
      postNextVersionWork(datFileName, keyDir, publisherProofKey,
        binary, localRun, version)
    })
  } else {
    postNextVersionWork(datFileName, undefined, publisherProofKey,
      binary, localRun, '1.0.0')
  }
}

const getDATFileList = () => {
  return recursive(path.join('build', 'ad-block-updater'))
    .filter(file => {
      return (path.extname(file) === '.dat' && !file.includes('test-data'))
    })
    .reduce((acc, val) => {
      acc.push(path.join(val))
      return acc
    }, [])
}

const processJob = (commander, keyDir) => {
  getDATFileList()
    .forEach(processDATFile.bind(null, commander.binary, commander.endpoint,
      commander.region, keyDir,
      commander.publisherProofKey,
      commander.localRun))
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely'))
  .parse(process.argv)

if (!commander.localRun) {
  let keyDir = ''
  if (fs.existsSync(commander.keysDirectory)) {
    keyDir = commander.keysDirectory
  } else {
    throw new Error('Missing or invalid private key file/directory')
  }
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    processJob(commander, keyDir)
  })
} else {
  processJob(commander, undefined)
}
