/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const rootBuildDir = path.join(path.resolve(), 'build', 'playlist')

class Playlist {
  constructor (privateKeyFile) {
    const [, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.componentId = componentId
  }

  stagingDir = path.join(rootBuildDir, 'staging')
  crxFile = path.join(rootBuildDir, 'output', 'playlist.crx')

  async stageFiles (version, outputDir) {
    const originalManifest = path.join(path.resolve(), 'node_modules', 'playlist-component', 'manifest.json')
    util.stageDir(
      path.join(path.resolve(), 'node_modules', 'playlist-component'),
      originalManifest,
      version,
      outputDir)
  }
}

const args = getPackagingArgs()
if (args.keyFile === undefined) {
  throw new Error('--key-file is required')
}
packageComponent(args, new Playlist(args.keyFile))
