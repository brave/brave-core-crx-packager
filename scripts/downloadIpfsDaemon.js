/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.10.0'

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
      sha512IPFS = '5a010789a0b91c859fd131abb51118b5ff1fe865ebee9ba3bc9283685abbc673f0a95ea4113a4bb16c6c4b4627bbae062d0a1fc00d2c1f82371913e9dc43a8a7'
      break
    case 'linux':
      sha512IPFS = 'bb0fe78a3142489fd6b7f608053b2e20cd9a4788febbeb4a0413783ac00306842451678f0953a917c459dfa69e4308f381ca0b6385f221dd70f7e01190bce2d1'
      break
    case 'win32':
      sha512IPFS = '7b0c17696330652af1c8709aaea8bee460e51cd3091e8128e4603b6f5c5d774344500e139f0aba1e98e7cabe6ee56f2b2958bad5dea1df7e773d747fbec9058b'
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
