/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.16.0'

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
      sha512IPFS = 'c0afc48554170fcce70361bd696d4174069b8ddaaf5f0e2ed512856122c1b31fe083f4e473505c2a1268eeaf47873f91975efaa9888b48c1e1e7f560e11915fc'
      break
    case 'darwin-arm64':
      sha512IPFS = 'f4aae96c41269966655ae3dc6efeae9abd0b7e8b94df614ec4c366911e94bef79d38e41b27e610fec1fc56e33bc60c8325255c76cd46e38b43d3ca7d794aee95'
      break
    case 'linux-amd64':
      sha512IPFS = '018e889c4e8d155c8ba19a9f4d3ebc1222f4f4c76749abb2bbd9491dd0b199efe6bc9b34401e814d0069ee09d5f2e179912abf537b6e9870764c70d2eda8e94a'
      break
    case 'linux-arm64':
      sha512IPFS = 'bb0acec3a9f49527f73af989d99a93c1352dea47cd96006b2e6fcd609b05c681875ad93e525f6556a4235393248e19bcbb9e0d048388783afb3591a7483a2447'
      break
    case 'windows-amd64':
      sha512IPFS = 'c95a59441a473130e3581697eabf40429df56e27646a8c6c81c55052367b2bc219213468a92780121358861ed31b9998c2ed820727d0c918e016e30fb180e63c'
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
