/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  GH_TOKEN=... pnpm data-files-wallet-lists
//  pnpm package-wallet-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files-updater.pem

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import { WALLET_LISTS_DIR } from '../lib/walletLists.js'

const originalManifest = path.join(WALLET_LISTS_DIR, 'manifest.json')

const postNextVersionWork = (key, publisherProofKey, publisherProofKeyAlt, binary, localRun, version) => {
  const componentType = 'wallet-data-files-updater'
  const stagingDir = path.join('build', componentType)
  const crxFile = path.join(stagingDir, `${componentType}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}.pem`)
  }
  util.stageDir(WALLET_LISTS_DIR, originalManifest, version, stagingDir)
  if (!localRun) {
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
  }
  console.log(`Generated ${crxFile} with version number ${version}`)
}

const processDATFile = (binary, endpoint, region, key, publisherProofKey, publisherProofKeyAlt, localRun) => {
  if (!fs.existsSync(originalManifest)) {
    throw new Error(`${WALLET_LISTS_DIR}/ is missing. Run \`pnpm data-files-wallet-lists\` before packaging`)
  }
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  if (!localRun) {
    util.getNextVersion(endpoint, region, id).then((version) => {
      postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
        binary, localRun, version)
    })
  } else {
    postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
      binary, localRun, '1.0.0')
  }
}

const processJob = (commander, keyParam) => {
  processDATFile(commander.binary, commander.endpoint,
    commander.region, keyParam, commander.publisherProofKey, commander.publisherProofKeyAlt,
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
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    processJob(commander, keyParam)
  })
} else {
  processJob(commander, keyParam)
}
