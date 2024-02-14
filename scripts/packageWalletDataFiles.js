/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-wallet-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files-updater.pem

import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

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

const args = getPackagingArgs()
packageComponent(args, new WalletDataFilesUpdater())
