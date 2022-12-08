/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.17.0'

// Downloads the current (platform-specific) Ipfs Daemon from ipfs.io
const downloadIpfsDaemon = (platform, arch) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://github.com/ipfs/kubo/releases/download/v${ipfsVersion}/`

  const zipSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform
  const build = `${myplatform}-${arch}`
  const ipfsFilename = `kubo_v${ipfsVersion}_${build}`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + zipSuffix

  let sha512IPFS = ''
  switch (build) {
    case 'darwin-amd64':
      sha512IPFS = '8b7f8f188a723b96f34ef3a688e875079c3f58a9bc49d357bbcfbc4ad5f04799201901397ab13acdd3f7c2fed1ea7f268017ce97f66e4178182e3b35ab356103'
      break
    case 'darwin-arm64':
      sha512IPFS = '11182c458f2fbcd79eca415f8a7071ad0d3b48c86104a0ccc10b728b190654370d69dedbcd02fad1fe6ce988473b175336dbaed4d9bb9079141aadd0eeea3f5f'
      break
    case 'linux-amd64':
      sha512IPFS = '380746fbb9761276a956dcea56936237acad9dc11d83f88003f9789bdee9e3dabad9f9e0b97a30c718b0c3b6db73ec9dfe811261b7997a3ec66c23aa592bc76b'
      break
    case 'linux-arm64':
      sha512IPFS = '0200d8aaeed1429553f7e666f773d18dbda9ead3856fca00c17d22dadeb0f308e550386406b923cda60612ba94aaa065b3521764fccc7984019e2c37ec569c1c'
      break
    case 'windows-amd64':
      sha512IPFS = '76ceda8a850063f420f7d9b83cb58993e433629c01c7bf483b2667899b921550b6506cc83baa44db1676fd5f5a5de41ae7758fea61cd69df6b8969967ddea596'
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

module.exports = {
  ipfsVersion
}
