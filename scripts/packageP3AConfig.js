/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-p3a-config -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/p3a-config.pem

import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const componentType = 'p3a-config'
const datFileName = 'default'
const manifestFilename = 'p3a_manifest.json'

const getOriginalManifest = () => {
  return path.join('manifests', 'p3a-config', 'default-manifest.json')
}

class P3AConfig {
  constructor (staging) {
    const parsedManifest = util.parseManifest(getOriginalManifest())
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)
    this.configPath = staging ? 'p3a-config-staging' : 'p3a-config'

    this.stagingDir = path.join('build', componentType, datFileName)
    this.crxFile = path.join('build', componentType, `${componentType}-${datFileName}.crx`)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${componentType}-${datFileName}.pem`)
  }

  async stageFiles (version, outputDir) {
    const files = [
      { path: getOriginalManifest(), outputName: 'manifest.json' },
      { path: path.join('node_modules', this.configPath, 'dist', manifestFilename), outputName: manifestFilename }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const args = getPackagingArgs([
  ['-s, --staging', 'Use staging P3A config']
])
packageComponent(args, new P3AConfig(args.staging))
