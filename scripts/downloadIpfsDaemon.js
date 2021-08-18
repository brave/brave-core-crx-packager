/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.9.1'
const fsRepoVersion = '1.0.0'

// Downloads the current (platform-specific) fs-repo-migration component
const downloadFsRepoMigration = (platform) => {
  if (platform !== 'darwin')
      return
  const repoPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://cloudflare-ipfs.com/ipns/dist.ipfs.io/fs-repo-10-to-11/v${fsRepoVersion}/`

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
    console.error('FsRepoMigration tool checksum verification failed')
    process.exit(1)
  }

  // Make it executable
  fs.chmodSync(repoTool, 0o755)

  return repoTool
}

// Downloads the current (platform-specific) Ipfs Daemon from ipfs.io
const downloadIpfsDaemon = (platform) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://cloudflare-ipfs.com/ipns/dist.ipfs.io/go-ipfs/v${ipfsVersion}/`

  const zipSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform

  const ipfsFilename = `go-ipfs_v${ipfsVersion}_${myplatform}-amd64`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + zipSuffix

  let sha512IPFS = ''

  switch (platform) {
    case 'darwin':
      sha512IPFS = '7957a7838f2a19043af149be6df63a1181d80868d1ee10b44527fc93e42ced41d82a765bc435d3c34d52508584999d3ec274a4006c35e2c633b04b8ea7403ed0'
      break
    case 'linux':
      sha512IPFS = 'bae5e2286e6921614282f12ba4c70c5e0ddbc2e613e5e3e66ab0fd1f316f1ca37984d1520b923cea1a678ba25001ffeeb7fe615a6333b6a71ac6473822c1e6e2'
      break
    case 'win32':
      sha512IPFS = '2dbbd3d249bd890f26732f1409abf12c5686d0d810c77599bc936fd7b23b49de370d293e482f47ae3084c5be39a250216df3a1f43d150fc9eb20b4dae0061c5d'
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
