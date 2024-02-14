/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-ipfs-daemon -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'
const ipfsVersion = '0.24.0'

const getIpfsDaemonPath = (os, arch) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')
  const myplatform = os === 'win32' ? 'windows' : os
  const ipfsFilename = `go-ipfs_v${ipfsVersion}_${myplatform}-${arch}`
  return path.join(ipfsPath, ipfsFilename)
}

const getOriginalManifest = (platform) => {
  return path.join('manifests', 'ipfs-daemon-updater', `ipfs-daemon-updater-${platform}-manifest.json`)
}

class IpfsDaemon {
  constructor (os, arch) {
    this.os = os
    this.arch = arch
    this.platform = `${this.os}-${this.arch}`

    const originalManifest = getOriginalManifest(this.platform)
    const parsedManifest = util.parseManifest(originalManifest)
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)

    this.stagingDir = path.join('build', 'ipfs-daemon-updater', this.platform)
    this.crxFile = path.join('build', 'ipfs-daemon-updater', `ipfs-daemon-updater-${this.platform}.crx`)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `ipfs-daemon-updater-${this.platform}.pem`)
  }

  async stageFiles (version, outputDir) {
    const ipfsDaemon = getIpfsDaemonPath(this.os, this.arch)
    const files = [
      { path: getOriginalManifest(this.platform), outputName: 'manifest.json' },
      { path: ipfsDaemon }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const osArchVariants = [
  ['darwin', 'amd64'],
  ['darwin', 'arm64'],
  ['linux', 'amd64'],
  ['linux', 'arm64'],
  ['win32', 'amd64'],
  ['win32', 'arm64']
]

const args = getPackagingArgs()
Promise.all(osArchVariants.map(([os, arch]) =>
  packageComponent(args, new IpfsDaemon(os, arch))
))
