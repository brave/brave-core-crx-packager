/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-playlist-exclusions -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/playlist-exclusions.pem

import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const componentType = 'playlist-exclusions'
const resourceDir = path.join(path.resolve(), 'playlist-exclusions')

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'manifests', 'playlist-exclusions', 'default-manifest.json')
}

class PlaylistExclusions {
  constructor (privateKeyFile) {
    const [, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.componentId = componentId

    this.stagingDir = path.join('build', componentType)
    this.crxFile = path.join(this.stagingDir, `${componentType}.crx`)
  }

  async stageFiles (version, outputDir) {
    util.stageDir(resourceDir, getOriginalManifest(), version, outputDir)
  }
}

const args = getPackagingArgs()
if (args.keyFile === undefined) {
  throw new Error('--key-file is required')
}
packageComponent(args, new PlaylistExclusions(args.keyFile))
