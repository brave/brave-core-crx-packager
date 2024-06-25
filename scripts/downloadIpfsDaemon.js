/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.29.0'

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
      sha512IPFS = '12d378ad2d6ad04979b205aaefc1607bce28086107d94270d4ae357dc1eee435a9b6624c9c103500220493d76f382edc3b69e0ca889c1ca3af8175265bf2c74c'
      break
    case 'darwin-arm64':
      sha512IPFS = 'c09d7d05cc054ba524d3b458d2beb3bc1ef817b00a4e97b71314e5051eb720cc4e17a2834922672c14cce778442f1810c65d3c52334ce3ff2385183678386dfe'
      break
    case 'linux-amd64':
      sha512IPFS = '8c91736bed5097a09193abe6934d3a2014923cfe7c26b757d5670565d246ad035b089913a891fe004fe1a78befa71ec4863a748d2f0bece08d51db34e7a8337c'
      break
    case 'linux-arm64':
      sha512IPFS = 'e3dd03986ac8881a32282ce1f51a0a262c3077ff659e64e9f7a74f70fc20e2691480301c0f2a3957c75d0e8938f45640dd42d7107075f12eba805f7756d03cd1'
      break
    case 'windows-amd64':
      sha512IPFS = '0fc253d37886c191a9947d3fb94616befcf56baec7545e880efdbd317498a9bb7733a682d5800d7f0c18896329fceeed86d4bbdc9e77e1cd1f79ea83b179ae3c'
      break
    case 'windows-arm64':
      sha512IPFS = 'a6653bd7d86b006099eecf55e29fea8b8e11f2db4e0a8cdcbf895e5e382b67f79efbf49261705177a51e5b9bcd8329039fc092d3f00ca35e4978746b8efa9c13'
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
downloadIpfsDaemon('win32', 'arm64')

export {
  ipfsVersion
}
