/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.9.0'
const fsRepoVersion = '1.0.0'

// Downloads the current (platform-specific) fs-repo-migration component
const downloadFsRepoMigration = (platform) => {
  if (platform !== 'darwin')
      return
  const repoPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://dist.ipfs.io/fs-repo-10-to-11/v${fsRepoVersion}/`

  const zipSuffix = '.tar.gz'

  const repoFilename = `fs-repo-10-to-11_v${fsRepoVersion}_${platform}-amd64`
  const targetFilename = `fs-repo-10-to-11`
  const ipfsURL = ipfsDistPrefix + repoFilename + zipSuffix

  let sha512IPFS = ''

  switch (platform) {
    case 'darwin':
      sha512IPFS = '9a8b8b18c7757e5f2a0abd62dc33fc14616195b27776a967d4adff361a2becedebf286eee156af05bdbf1f39b0da5cc33264939a695a7866abe50a06b817d5cd'
      break
    default:
      throw new Error('fs-repo migration tool download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(repoPath)

  const repoTool = path.join(repoPath, targetFilename)
  const decompress = `bsdtar xf - -C ${repoPath}`
  const move = `mv ${path.join(repoPath, 'fs-repo-10-to-11')} ${path.join(repoPath, 'tmp')}`
  const copy = `cp ${path.join(repoPath, 'tmp', 'fs-repo-10-to-11')} ${repoTool}`
  const rm = `rm -r ${path.join(repoPath, 'tmp')}`
  const cmd = `curl -s ${ipfsURL} | ${decompress} && ${move} && ${copy} && ${rm}`
  console.log(cmd)
  // Download and decompress the client
  execSync(cmd)

  // Verify the checksum
  if (!verifyChecksum(repoTool, sha512IPFS)) {
    console.error('Ipfs Daemon checksum verification failed')
    process.exit(1)
  }

  // Make it executable
  fs.chmodSync(repoTool, 0o755)

  return repoTool
}

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
      sha512IPFS = '7c39b6bd59147c87d07222844e43c7a0735f58a17318ca1fdd5a8d49dc79ad6abe724e6f9fa274b6b474a88216696dfbbd2e3ea3e028f4859aabf4b29c4ab627'
      break
    case 'linux':
      sha512IPFS = '386d970bcaa37fb7991cc2fe1e2d55efcc95020d51f479fd707e2b8aec1c01dddf2d88cbe0a5ad1d83e58d34b7897d876d01042244f1baad0302915472c09178'
      break
    case 'win32':
      sha512IPFS = '9865581daa4b0e725ab41e5eeea9f1460b9e26e452b0ac508cfe77031781829d1a7181b4c166f5ac9cf06b29a44d6f00b661d6b06d2d9b42915238aa617d1010'
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
downloadFsRepoMigration('darwin')
downloadIpfsDaemon('linux')
downloadIpfsDaemon('win32')

module.exports = {
  ipfsVersion,
}
