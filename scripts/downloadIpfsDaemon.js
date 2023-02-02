/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.18.1'

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
      sha512IPFS = 'b66810afba9cd939e59640a1137b7db1eba316a090f3be494f08913a8cf0da97dbd29d6f227375ded10d4091b88b226bdb0c63526072cb84ba89baf36c010a6c'
      break
    case 'darwin-arm64':
      sha512IPFS = '859c7e36ed3aadae36df18fc44f9dd3cba6aeb2b7b93e0aae8b91a801a40cd78effcc28b4b9b76a7cd3414336706b2cbcb488cd3dd5e622eecd2fd9503d56fbf'
      break
    case 'linux-amd64':
      sha512IPFS = '7770c03dc2219eaa638e82f75df428b0576eb439d877eaaecc0960dcd2cdaa6f8802be734a50c534f0e4d4bc3aa9d61c9caff3078450228555793040b30ad08a'
      break
    case 'linux-arm64':
      sha512IPFS = '284fdc8bbed8d1384ed94dd5fa87352c037c1b2c99dafc1a992678e2e4a20e7c440a633919499edafdeeaff9c3559827bbdc5a15f5b1809690e32a2f5c337250'
      break
    case 'windows-amd64':
      sha512IPFS = '52239ac052fdb044b2b402b452954f8c22f6126c942a653d987c92506cf96f7d0de98422f73337c042ee5bd3822794b53dcaabdbe51285dc1ca4459b1ad7fb5c'
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
