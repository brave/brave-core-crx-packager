/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-background-images')

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'build', 'ntp-background-images', 'ntp-background-images-manifest.json')
}

const generateManifestFile = (publicKey) => {
  const manifestFile = getOriginalManifest()
  const manifestContent = {
    description: 'Brave NTP background images component',
    key: publicKey,
    manifest_version: 2,
    name: 'Brave NTP background images',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

class NTPBackgroundImagesComponent {
  constructor (privateKeyFile) {
    const [publicKey, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.publicKey = publicKey
    this.componentId = componentId
  }

  stagingDir = path.join(rootBuildDir, 'staging')
  crxFile = path.join(rootBuildDir, 'output', 'ntp-background-images.crx')

  async stageFiles (version, outputDir) {
    generateManifestFile(this.publicKey)
    util.stageDir(
      path.join(path.resolve(), 'build', 'ntp-background-images', 'resources'),
      getOriginalManifest(),
      version,
      outputDir)
  }
}

const args = getPackagingArgs()
if (args.keyFile === undefined) {
  throw new Error('--key-file is required')
}
packageComponent(args, new NTPBackgroundImagesComponent(args.keyFile))
