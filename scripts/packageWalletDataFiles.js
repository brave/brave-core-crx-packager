/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  GH_TOKEN=... pnpm package-wallet-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files-updater.pem

import commander from 'commander'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import util from '../lib/util.js'
import { fetchWalletLists } from '../lib/walletLists.js'

const postNextVersionWork = (key, publisherProofKey, publisherProofKeyAlt, binary, localRun, version, walletListsDir) => {
  const componentType = 'wallet-data-files-updater'
  const stagingDir = path.join('build', componentType)
  const crxFile = path.join(stagingDir, `${componentType}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}.pem`)
  }
  util.stageDir(walletListsDir, path.join(walletListsDir, 'manifest.json'), version, stagingDir)
  if (!localRun) {
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
  }
  console.log(`Generated ${crxFile} with version number ${version}`)
}

// Fetches and verifies the wallet data files in the same run that packages
// them, so nothing unverified can be signed.
const processDATFile = async (binary, endpoint, region, key, publisherProofKey, publisherProofKeyAlt, localRun) => {
  const walletListsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-lists-'))
  try {
    const { tag, addressCount } = await fetchWalletLists(walletListsDir)
    console.log(`Fetched and verified brave/wallet-lists ${tag} (${addressCount} prohibited addresses)`)

    const parsedManifest = util.parseManifest(path.join(walletListsDir, 'manifest.json'))
    const id = util.getIDFromBase64PublicKey(parsedManifest.key)
    const version = localRun ? '1.0.0' : await util.getNextVersion(endpoint, region, id)
    postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
      binary, localRun, version, walletListsDir)
  } finally {
    fs.rmSync(walletListsDir, { recursive: true, force: true })
  }
}

const processJob = (commander, keyParam) => {
  return processDATFile(commander.binary, commander.endpoint,
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
    return processJob(commander, keyParam)
  })
} else {
  processJob(commander, keyParam)
}
