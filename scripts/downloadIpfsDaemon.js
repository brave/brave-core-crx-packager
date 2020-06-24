/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.4.17'

// Downloads the current (platform-specific) Ipfs Daemon from ipfs.io
const downloadIpfsDaemon = (platform) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://ipfs.io/ipns/dist.ipfs.io/go-ipfs/v${ipfsVersion}/`

  const zipSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform

  const ipfsFilename = `go-ipfs_v${ipfsVersion}_${myplatform}-amd64`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + zipSuffix

  let sha512IPFS = ''

  switch (platform) {
    case 'darwin':
      sha512IPFS = 'c3d18404f257fcf8674ca0afcd45bf36501624c10a8642d59d52deb850383b7f136f4849919a1a4560eee1af61705cd91dd01b3e219fb38d0582cace2b0b03d7'
      break
    case 'linux':
      sha512IPFS = 'e4131388efe52d0ec0e68fa3c0110c43fc58e2a5c5bb2c72062f5b947c7622dff78cde1181029331144298f15879887c20173d0eada368e7051f4f2b5c6b41ef'
      break
    case 'win32':
      sha512IPFS = 'b9175c6f1b624ee1e5db3076f5f5859c4e5dd9abc050f75c6a4ee5ecb7ab89b8fdec965c88b851775b369bc08a8c2dfc0d84807726a4f24448eacfc0e48cdc6c'
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

downloadIpfsDaemon('darwin')
downloadIpfsDaemon('linux')
downloadIpfsDaemon('win32')

module.exports = {
  ipfsVersion,
}
