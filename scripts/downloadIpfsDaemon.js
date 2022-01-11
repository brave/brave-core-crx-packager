/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.11.0'

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
      sha512IPFS = 'cb603a24729ff2eb6a4e627133b72c7d39ba1c7f60e5b09016e75ce1fce137d88c57f4d2480672e6157bb7ed77bf49b6f9e030ad6496196da2ec3267ec279c87'
      break
    case 'darwin-arm64':
      sha512IPFS = '0c5b9772639e775ff2e6be74edaf811b27c3ce9b972bcc61e2dbab26b2998cd47996017fedfe3f81b665a30ae779f7651993fe99f4d316b2c2188ceeb88bb933'
      break
    case 'linux-amd64':
      sha512IPFS = '9070dee4101bec96d32c8e3762aef7191f41092cd629c4307a84c890661e819de7db6964ade60a7ea03ccf24cbfae75764458337e1d60605b27686c468298654'
      break
    case 'windows-amd64':
      sha512IPFS = '2d82300c6b2084d981da9908c0822b3d37724b0c5f1a4d159a1bc43e04f41a04961dbc5f5091409e7ba7583efd81ec2f09b2f26468ee6d37a2dac42d838de067'
      break
    default:
      throw new Error('Ipfs Daemon download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(ipfsPath)

  const ipfsDaemon = path.join(ipfsPath, ipfsFilename)
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const decompress = `bsdtar xf - -C ${ipfsPath}`
  const copy = `cp ${path.join(ipfsPath, 'go-ipfs', 'ipfs' + exeSuffix)} ${ipfsDaemon}`
  const cmd = `curl -s ${ipfsURL} | ${decompress} && ${copy}`

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
