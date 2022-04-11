/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.12.2'

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
      sha512IPFS = '449eeac07008d07cfdd18166c1c0bb59a62165af5847beffa2e33639f560687b99a50e8ed983f207377fcc8aaae3e2171129a57c2fc7cd3af6e1e3c1f488cbe3'
      break
    case 'darwin-arm64':
      sha512IPFS = 'd1ac5b6c058b2d68bf5e9601b29407e874aa42294e6195cf169d30f8e5174e67c6d7a57579468ecc9fd736876c983366c24e6a96ed86d5c8363ea1839375d952'
      break
    case 'linux-amd64':
      sha512IPFS = '69f0df7484f493e6a7510d504a02531d4952b86a79f34692957f40c00dc488d7abd6e729e049f042ea2207e61c00e40ae04de2b018be32c5ce129f7c51bdb78f'
      break
    case 'windows-amd64':
      sha512IPFS = '4362574f276b27e2a995ade3020b3e3d87214b88e03d33c3ac2fba1f33456017b8044bdd61b5b3ea782e95fca26b136c706d9932b5a1d81f1ef6c25d74720039'
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
