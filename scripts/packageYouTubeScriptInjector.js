/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-youtube-script-injector -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/key.pem

import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const componentType = 'youtube-script-injector'
const resourceDir = path.join(path.resolve(), 'component-data', 'youtube-script-injector')

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'component-data', 'youtube-script-injector', 'manifest.json')
}

class YouTubeScriptInjector {
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
packageComponent(args, new YouTubeScriptInjector(args.keyFile))
