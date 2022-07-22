/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.14.0'

// Downloads the current (platform-specific) Ipfs Daemon from ipfs.io
const downloadIpfsDaemon = (platform, arch) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://dist.ipfs.io/kubo/v${ipfsVersion}/`

  const zipSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform
  const build = `${myplatform}-${arch}`
  const ipfsFilename = `kubo_v${ipfsVersion}_${build}`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + zipSuffix

  let sha512IPFS = ''
  switch (build) {
    case 'darwin-amd64':
      sha512IPFS = '21c5a208b979798ee820f38a1f9a702a849314f3154b9a006a0868c2765c0a5ac40afda7aa8e877fc96e598e3ccef80ecfae8f862387517f34f96d6f707893f4'
      break
    case 'darwin-arm64':
      sha512IPFS = '9d4fed1f0bc5f219945721fbac1deb2573be6aafcc6dbd81e911e044e4cb5255e07f8080b228f4ab28dcb1d9072c91bebbefc286b104d027c424b3c8ba28ec43'
      break
    case 'linux-amd64':
      sha512IPFS = 'e5d1b305cb323af469bf1a820a48d97d3cb53709ab641d5ed126baad1e969714a058ff652b435c9b148e88841de9e025860a1a1999123e39d309a5184e6a200a'
      break
    case 'windows-amd64':
      sha512IPFS = 'e0aef3b2d417ae63c90b0aef0d8b6d61fc804da49b9c7f73d6584a063f3a56daa2b0894476fed4d87c672af88896f1fe0e75557c16fac7946e8cc7bc3863143f'
      break
    default:
      throw new Error('Ipfs Daemon download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(ipfsPath)

  const ipfsDaemon = path.join(ipfsPath, ipfsFilename)
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const decompress = `bsdtar xf - -C ${ipfsPath}`
  const copy = `cp ${path.join(ipfsPath, 'kubo', 'ipfs' + exeSuffix)} ${ipfsDaemon}`
  const cmd = `curl -sL ${ipfsURL} | ${decompress} && ${copy}`

  // Download and decompress the client
  execSync(cmd)
  // Verify the checksum
  if (!verifyChecksum(ipfsDaemon, sha512IPFS)) {
    console.error('Ipfs Daemon checksum verification failed for')
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
downloadIpfsDaemon('win32', 'amd64')

module.exports = {
  ipfsVersion
}
