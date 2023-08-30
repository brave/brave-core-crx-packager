/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.22.0'

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
      sha512IPFS = 'c6474d9cde39836fcfcdfa8c93694dbd06a6a4990bb3feab24c32669a93e4b5496ffa5ed19057d51d2be80ceb903720d82a66e993cb76a84244da5a60ba8cc54'
      break
    case 'darwin-arm64':
      sha512IPFS = 'df61305d31ff6aaa69f03fedae22c74415304bc398e3ceaff3a999051cefc7b665620129f6d04592d78e56ea051945f371076b165d06dd992501f7d8a97e75b9'
      break
    case 'linux-amd64':
      sha512IPFS = '036138ac4631912fd5de96341043030efbf12c418704f460b7c119ec7c42037a622788834a01b39be21aab675bd3ef952d035a5a386c9eed7d175498ae9e934e'
      break
    case 'linux-arm64':
      sha512IPFS = '5a7e35a9fadd384ef84351a08fd8ca97df1d2233cc4713e57dd50b6c59dac88c9f87a17523fc36c5c4f6c876fab9a65d43e198fd288eb4fbc396f35342689604'
      break
    case 'windows-amd64':
      sha512IPFS = 'f19c779c04454ff2a2af96faaff7eb60bafc0251d72418e50fe2ce44393e08bf6b1c01c84ca4e4535bc25fced684a394d8dba97116a78aeaa9f5bc706e9a628d'
      break
    case 'windows-arm64':
      sha512IPFS = 'd82a217cf9a24301839f5e9a1534a64ac5a209ba4c259a23f99375c3df51deaf11d3019c1382b1fe5a32de104233792416068588d560c1ac9048c8c1eee0cab0'
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
