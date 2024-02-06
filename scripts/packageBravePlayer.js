/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// This component is for the Brave Player feature, which supports playback of third-party videos in a controlled environment.
//
// The component ships a test script that can be injected into supported webpages.
// The test script notifies the browser of optimal times to suggest enabling the Brave Player feature.

// Example usage:
//  npm run package-brave-player -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/brave-player.pem

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'

const getOriginalManifest = () => {
  return path.join('component-data', 'brave-player', 'manifest.json')
}

class BravePlayer {
  constructor () {
    const originalManifest = getOriginalManifest()
    const parsedManifest = util.parseManifest(originalManifest)
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)

    this.stagingDir = path.join('build', 'brave-player')
    this.crxFile = path.join('build', 'brave-player.crx')
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, 'brave-player.pem')
  }

  async stageFiles (version, outputDir) {
    util.stageDir(path.join('component-data', 'brave-player'), getOriginalManifest(), version, outputDir)
  }
}

const packageBravePlayer = async (binary, endpoint, region, key, publisherProofKey, localRun) => {
  const descriptor = new BravePlayer()

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
  await packageBravePlayer(commander.binary, commander.endpoint, commander.region,
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
  util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
    await processJob(commander, keyParam)
  })
} else {
  processJob(commander, keyParam)
}
