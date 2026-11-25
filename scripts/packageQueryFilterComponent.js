/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-query-filter -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/query-filter.pem

import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const componentType = 'query-filter'

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'manifests', 'query-filter', 'default-manifest.json')
}

const generateManifestFile = (publicKey) => {
  const manifestFile = getOriginalManifest()
  const manifestContent = {
    description: 'Query filter component',
    key: publicKey,
    manifest_version: 2,
    name: 'Query Filter',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

class QueryFilter {
  constructor (privateKeyFile) {
    const [publicKey, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.publicKey = publicKey
    this.componentId = componentId

    this.stagingDir = path.join('build', componentType)
    this.crxFile = path.join(this.stagingDir, `${componentType}.crx`)
  }

  async stageFiles (version, outputDir) {
    generateManifestFile(this.publicKey)
    const files = [
      { path: getOriginalManifest(), outputName: 'manifest.json' },
      { path: path.join('query-filter', 'query-filter.json'), outputName: 'query-filter.json' }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const args = getPackagingArgs()
if (args.keyFile === undefined) {
  throw new Error('--key-file is required')
}
packageComponent(args, new QueryFilter(args.keyFile))
