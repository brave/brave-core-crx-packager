/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-ipfs-daemon -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

import commander from 'commander'
import fs from 'fs'
import path from 'path'
import util from '../lib/util.js'
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

const packageIpfsDaemon = async (binary, endpoint, region, os, arch, key,
  publisherProofKey) => {
  const descriptor = new IpfsDaemon(os, arch)

  const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : descriptor.privateKeyFromDir(key)

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    descriptor,
    privateKeyFile,
    false)
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files', 'abc')
    .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem'))
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
  await packageIpfsDaemon(commander.binary, commander.endpoint, commander.region,
    'darwin', 'amd64', keyParam, commander.publisherProofKey)
  await packageIpfsDaemon(commander.binary, commander.endpoint, commander.region,
    'darwin', 'arm64', keyParam, commander.publisherProofKey)
  await packageIpfsDaemon(commander.binary, commander.endpoint, commander.region,
    'linux', 'amd64', keyParam, commander.publisherProofKey)
  await packageIpfsDaemon(commander.binary, commander.endpoint, commander.region,
    'linux', 'arm64', keyParam, commander.publisherProofKey)
  await packageIpfsDaemon(commander.binary, commander.endpoint, commander.region,
    'win32', 'amd64', keyParam, commander.publisherProofKey)
  await packageIpfsDaemon(commander.binary, commander.endpoint, commander.region,
    'win32', 'arm64', keyParam, commander.publisherProofKey)
})
