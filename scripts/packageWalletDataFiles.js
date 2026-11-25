/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  GH_TOKEN=... pnpm package-wallet-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files-updater.pem

import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'
import { fetchWalletLists } from '../lib/walletLists.js'

const componentType = 'wallet-data-files-updater'

class WalletDataFilesUpdater {
  constructor (walletListsDir) {
    this.packageDir = walletListsDir
    const parsedManifest = util.parseManifest(path.join(walletListsDir, 'manifest.json'))
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)

    this.stagingDir = path.join('build', componentType)
    this.crxFile = path.join(this.stagingDir, `${componentType}.crx`)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${componentType}.pem`)
  }

  async stageFiles (version, outputDir) {
    util.stageDir(this.packageDir, path.join(this.packageDir, 'manifest.json'), version, outputDir)
    fs.unlinkSync(path.join(outputDir, 'package.json'))
  }
}

// Fetches and verifies the wallet data files in the same run that packages
// them, so nothing unverified can be signed.
const processDATFile = async (packagingArgs) => {
  const walletListsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-lists-'))
  try {
    const { tag, addressCount } = await fetchWalletLists(walletListsDir)
    console.log(`Fetched and verified brave/wallet-lists ${tag} (${addressCount} prohibited addresses)`)
    await packageComponent(packagingArgs, new WalletDataFilesUpdater(walletListsDir))
  } finally {
    fs.rmSync(walletListsDir, { recursive: true, force: true })
  }
}

const args = getPackagingArgs()
processDATFile(args)
