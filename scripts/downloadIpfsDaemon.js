/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.24.0'

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
      sha512IPFS = 'cff4f2483c410614a9bf6d8b4f3412c8842575406487de07cbe4ef6f5cf5c4c5540061ab2607b5f8633e271b8dbed1a65729bf26eee99acc2334f5fa02f15f06'
      break
    case 'darwin-arm64':
      sha512IPFS = '35bd909736a6b70f766ca29f959093e75ddc5d43ebf894e9905d935b0a4ef75b4c9e3abb5350a0732a472da5aeb092a7e05a15d2b19bfb38afd736ea8a566753'
      break
    case 'linux-amd64':
      sha512IPFS = '30dded36e281d78a109d26092b618ab9289c47ce9b3bf8b1496b2f485ecc423b5fb638dc889b0cb43b29b48439e2407a9bada7cc4261a1ffad03f8836ebd19bb'
      break
    case 'linux-arm64':
      sha512IPFS = '9314d8f00c642adf6b95ca62354ec600e9a77e7b8559c0161efc5a7f04096595219ef315fa3844118b86b576aa4789d59913c48882e49a81fbef3bac596ae49c'
      break
    case 'windows-amd64':
      sha512IPFS = '6046624be11b92a13f726690c3d4cc02103a2d2ab299cf7020383103e8df194aa6e42b52e17c8be26fc64e5093d738022d41b34bb4bcf7bdf97bacf294fa3954'
      break
    case 'windows-arm64':
      sha512IPFS = '1643b77b6c3e6dbc1fd80559d008f3376210428545a44f7e5826ddd83215e46afe6d1ea1d3e16b76431c400411b68d1b9fdaf016104b6ec45552fecc33affcbb'
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
downloadIpfsDaemon('win32', 'arm64')

export {
  ipfsVersion
}
