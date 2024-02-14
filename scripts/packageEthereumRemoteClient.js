/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ethereum-remote-client -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ethereum-remote-client.pem

import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const getOriginalManifest = (packageDir) => {
  return path.join(packageDir, 'manifest.json')
}

class EthereumRemoteClient {
  constructor () {
    const originalManifest = getOriginalManifest(this.packageDir)
    const parsedManifest = util.parseManifest(originalManifest)
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)
  }

  packageDir = path.join('node_modules', 'ethereum-remote-client')

  stagingDir = path.join('build', 'ethereum-remote-client')
  crxFile = path.join(this.stagingDir, 'ethereum-remote-client.crx')

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, 'ethereum-remote-client.pem')
  }

  async stageFiles (version, outputDir) {
    util.stageDir(this.packageDir, getOriginalManifest(this.packageDir), version, outputDir)
  }
}

const args = getPackagingArgs()
packageComponent(args, new EthereumRemoteClient())
