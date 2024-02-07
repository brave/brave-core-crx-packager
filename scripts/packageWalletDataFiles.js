/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-wallet-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files-updater.pem

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'

const getOriginalManifest = (packageDir) => {
  return path.join(packageDir, 'manifest.json')
}

class WalletDataFilesUpdater {
  constructor () {
    const originalManifest = getOriginalManifest(this.packageDir)
    const parsedManifest = util.parseManifest(originalManifest)
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)
  }

  packageDir = path.join('node_modules', 'brave-wallet-lists')

  stagingDir = path.join('build', 'wallet-data-files-updater')
  crxFile = path.join(this.stagingDir, 'wallet-data-files-updater.crx')

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, 'wallet-data-files-updater.pem')
  }

  async stageFiles (version, outputDir) {
    util.stageDir(this.packageDir, getOriginalManifest(this.packageDir), version, outputDir)
    fs.unlinkSync(path.join(outputDir, 'package.json'))
  }
}

const generateCRXFile = async (binary, endpoint, region, key,
  publisherProofKey, localRun) => {
  const descriptor = new WalletDataFilesUpdater()

  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : descriptor.privateKeyFromDir(key)
  }

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    descriptor,
    privateKeyFile,
    localRun)
}

const processJob = async (commander, keyParam) => {
  await generateCRXFile(commander.binary, commander.endpoint,
    commander.region, keyParam,
    commander.publisherProofKey,
    commander.localRun)
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
  util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
    await processJob(commander, keyParam)
  })
} else {
  processJob(commander, keyParam)
}
