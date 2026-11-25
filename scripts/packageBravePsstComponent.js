/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-brave-psst -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/brave-psst.pem

import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const componentType = 'psst'
const psstOutputDir = path.join(path.resolve(), 'psst-component', 'out')

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'manifests', 'psst', 'default-manifest.json')
}

class BravePsst {
  constructor (privateKeyFile) {
    const [, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.componentId = componentId

    this.stagingDir = path.join('build', componentType)
    this.crxFile = path.join(this.stagingDir, `${componentType}.crx`)
  }

  async stageFiles (version, outputDir) {
    util.stageDir(psstOutputDir, getOriginalManifest(), version, outputDir)
  }
}

const args = getPackagingArgs()
if (args.keyFile === undefined) {
  throw new Error('--key-file is required')
}
packageComponent(args, new BravePsst(args.keyFile))
