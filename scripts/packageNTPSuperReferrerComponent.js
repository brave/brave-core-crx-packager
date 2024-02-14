/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-super-referrer')

const generateManifestFile = (superReferrerName, publicKey) => {
  const manifestFile = getOriginalManifest(superReferrerName)
  const manifestContent = {
    description: 'Brave NTP Super Referrer component',
    key: publicKey,
    manifest_version: 2,
    name: `Brave NTP Super Referrer (${superReferrerName})`,
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const getOriginalManifest = (superReferrerName) => {
  return path.join(path.resolve(), 'build', 'ntp-super-referrer', `${superReferrerName}-manifest.json`)
}

class NTPSuperReferrerComponent {
  constructor (superReferrerName, privateKeyFile) {
    const [publicKey, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.publicKey = publicKey
    this.componentId = componentId
    this.superReferrerName = superReferrerName
    this.stagingDir = path.join(rootBuildDir, 'staging', this.superReferrerName)
    this.crxFile = path.join(rootBuildDir, 'output', `ntp-super-referrer-${this.superReferrerName}.crx`)
  }

  async stageFiles (version, outputDir) {
    generateManifestFile(this.superReferrerName, this.publicKey)
    util.stageDir(
      path.join(path.resolve(), 'build', 'ntp-super-referrer', 'resources', this.superReferrerName, '/'),
      getOriginalManifest(this.superReferrerName),
      version,
      outputDir)
  }
}

const args = getPackagingArgs([
  ['-n, --super-referrer-name <name>', 'super referrer name for this component']
])
if (args.keyFile === undefined) {
  throw new Error('--key-file is required')
}
packageComponent(args, new NTPSuperReferrerComponent(args.superReferrerName, args.keyFile))
