/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.12.0'

// Downloads the current (platform-specific) Ipfs Daemon from ipfs.io
const downloadIpfsDaemon = (platform, arch) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://github.com/ipfs/go-ipfs/releases/download/v${ipfsVersion}/`

  const zipSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform
  const build = `${myplatform}-${arch}`
  const ipfsFilename = `go-ipfs_v${ipfsVersion}_${build}`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + zipSuffix

  let sha512IPFS = ''
  switch (build) {
    case 'darwin-amd64':
      sha512IPFS = '6b9aae97dc9c54476092ebb84644980e9c353a97187ee0e22e3b7c9c30cdd5676993cc4dc9786ac732ff1f91bc6475abffdefce1a58cfdd1336125d7787e4c94'
      break
    case 'darwin-arm64':
      sha512IPFS = 'a1f7e1d3afb03c83336abc6c7c48f7716fa87d989835e4b678a338198413930104322b6183492f94937a6db01a25b80350affa2e7cd543fb7b2cc81abce88833'
      break
    case 'linux-amd64':
      sha512IPFS = 'd08d254013af81dd7b0f78a6e1d659007aa484e59c6f0c5a0b1cbdd12a5a27df0e99ced90dc50a4687469b35893e3bad499fd1b4af9711b4204618eb62f5d091'
      break
    case 'windows-amd64':
      sha512IPFS = 'a0f606e16200eabfcf5f1fea17a659ad970081f6a5f234bdf6208ac9bfa322927511075ea8459333ee106fcce21bfff7c45ec07554b7240d8105ff7de60415cb'
      break
    default:
      throw new Error('Ipfs Daemon download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(ipfsPath)

  const ipfsDaemon = path.join(ipfsPath, ipfsFilename)
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const decompress = `bsdtar xf - -C ${ipfsPath}`
  const copy = `cp ${path.join(ipfsPath, 'go-ipfs', 'ipfs' + exeSuffix)} ${ipfsDaemon}`
  const cmd = `curl -sL ${ipfsURL} | ${decompress} && ${copy}`

  // Download and decompress the client
  execSync(cmd)
  // Verify the checksum
  if (!verifyChecksum(ipfsDaemon, sha512IPFS)) {
    console.error('Ipfs Daemon checksum verification failed')
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
  ipfsVersion,
}
