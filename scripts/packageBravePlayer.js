/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// This component is for the Brave Player feature, which supports playback of third-party videos in a controlled environment.
//
// The component ships a test script that can be injected into supported webpages.
// The test script notifies the browser of optimal times to suggest enabling the Brave Player feature.

// Example usage:
//  npm run package-brave-player -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/brave-player.pem

import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

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

const args = getPackagingArgs()
packageComponent(args, new BravePlayer())
