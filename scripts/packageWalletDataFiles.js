/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run wallet-data-files-updater -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files-updater.pem

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'

const stageFiles = (version, outputDir) => {
  util.stageDir(getPackageDir(), getOriginalManifest(), version, outputDir)

  fs.unlinkSync(path.join(outputDir, 'package.json'))
}

const getPackageDir = () => {
  return path.join('node_modules', 'brave-wallet-lists')
}

const getOriginalManifest = () => {
  return path.join(getPackageDir(), 'manifest.json')
}

const postNextVersionWork = (
  key,
  publisherProofKey,
  publisherProofKeyAlt,
  binary,
  localRun,
  version
) => {
  const componentType = 'wallet-data-files-updater'
  const stagingDir = path.join('build', componentType)
  const crxFile = path.join(stagingDir, `${componentType}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory()
      ? key
      : path.join(key, `${componentType}.pem`)
  }
  stageFiles(version, stagingDir)
  if (!localRun) {
    util.generateCRXFile(
      binary,
      crxFile,
      privateKeyFile,
      publisherProofKey,
      publisherProofKeyAlt,
      stagingDir
    )
  }
  console.log(`Generated ${crxFile} with version number ${version}`)
}

const processDATFile = (
  binary,
  endpoint,
  region,
  key,
  publisherProofKey,
  publisherProofKeyAlt,
  localRun
) => {
  const originalManifest = getOriginalManifest()
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  if (!localRun) {
    util.getNextVersion(endpoint, region, id).then((version) => {
      postNextVersionWork(
        key,
        publisherProofKey,
        publisherProofKeyAlt,
        binary,
        localRun,
        version
      )
    })
  } else {
    postNextVersionWork(
      key,
      publisherProofKey,
      publisherProofKeyAlt,
      binary,
      localRun,
      '1.0.0'
    )
  }
}

const processJob = (commander, keyParam) => {
  processDATFile(
    commander.binary,
    commander.endpoint,
    commander.region,
    keyParam,
    commander.publisherProofKey,
    commander.publisherProofKeyAlt,
    commander.localRun
  )
}

util.installErrorHandlers()

util
  .addCommonScriptOptions(
    commander
      .option(
        '-d, --keys-directory <dir>',
        'directory containing private keys for signing crx files'
      )
      .option(
        '-f, --key-file <file>',
        'private key file for signing crx',
        'key.pem'
      )
      .option(
        '-l, --local-run',
        'Runs updater job without connecting anywhere remotely'
      )
  )
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
