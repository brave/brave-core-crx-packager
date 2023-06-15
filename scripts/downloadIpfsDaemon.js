/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.20.0'

// Downloads the current (platform-specific) Ipfs Daemon from ipfs.io
const downloadIpfsDaemon = (platform, arch) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://dist.ipfs.tech/kubo/v${ipfsVersion}/`

  const zipSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform
  const build = `${myplatform}-${arch}`
  const ipfsFilename = `kubo_v${ipfsVersion}_${build}`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + zipSuffix

  let sha512IPFS = ''
  switch (build) {
    case 'darwin-amd64':
      sha512IPFS = 'a88b08529a2747fcc36313cb247df6013b3ddc9642f565979f9b9391497401f95a5c7fd34283dc6e491e6521e7d1b0fdd52d79e8026bcb8935c49b6f45242b74'
      break
    case 'darwin-arm64':
      sha512IPFS = 'd456ec249c5bd946456da399fb950f67420d568db8a7e7e510f88070c4b5c8ac9ef719a3f7281462f0206b5fd7787254ea002159040ad440d3b231c0dedda1c9'
      break
    case 'linux-amd64':
      sha512IPFS = 'd18cd63ac8bf3dffcb099bf5b87a5a9375ef5ac9676ed5297c88b167c9fa73554b273f8269d414e413a3be1a9dc71c7ac8ae0a92f7515624a82174d95693e886'
      break
    case 'linux-arm64':
      sha512IPFS = '83cac5a311d634d1a8f664e5f944822239cad048a128482794720dd3f55e751f45167bbdf39d6c5d68263a07bc132c4368938c82a2c9ce6bcd3d8d5eef554b86'
      break
    case 'windows-amd64':
      sha512IPFS = 'f14100721f5cefe66c5ca1b721abb005d578e7cfb2e2e86ca527379471f2e7a19128d5fcbbf1aa71971f7b0b609dbb84c92447efa11398bc35011926021beb3f'
      break
    default:
      throw new Error('Ipfs Daemon download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(ipfsPath)

  // Rename kubo executable to go-ipfs
  const goIpfsFilename = `go-ipfs_v${ipfsVersion}_${build}`
  const ipfsDaemon = path.join(ipfsPath, goIpfsFilename)
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const decompress = `bsdtar xf - -C ${ipfsPath}`
  const copy = `cp ${path.join(ipfsPath, 'kubo', 'ipfs' + exeSuffix)} ${ipfsDaemon}`
  const cmd = `curl -sL ${ipfsURL} | ${decompress} && ${copy}`

  // Download and decompress the client
  execSync(cmd)
  // Verify the checksum
  if (!verifyChecksum(ipfsDaemon, sha512IPFS)) {
    console.error('Ipfs Daemon checksum verification failed for ' + ipfsDaemon)
    process.exit(1)
  }

  // Make it executable
  fs.chmodSync(ipfsDaemon, 0o755)

  return ipfsDaemon
}

// Does a hash comparison on a file against a given hash
const verifyChecksum = (file, hash) => {
  const filecontent = fs.readFileSync(file)
  return hash === crypto.createHash('sha512').update(filecontent).digest('hex')
}

util.installErrorHandlers()

downloadIpfsDaemon('darwin', 'amd64')
downloadIpfsDaemon('darwin', 'arm64')
downloadIpfsDaemon('linux', 'amd64')
downloadIpfsDaemon('linux', 'arm64')
downloadIpfsDaemon('win32', 'amd64')

export {
  ipfsVersion
}
