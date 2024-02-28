/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.26.0'

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
      sha512IPFS = '30e25d1067c6454722b203432980504df51b7dc4d83326d1819256a3460b686942cf41547fbf40ee3577f1a28890e97e86b51ce7a447ff9037465a67f0fb3bc8'
      break
    case 'darwin-arm64':
      sha512IPFS = 'd9affadf087eb57127b14564ac62da20dcce4f5ded7236d2186d90d215bf9c9e6584ea65c84b2e692cb7fc3dd023aaf4b4a427a652c0b9411accd12958676e29'
      break
    case 'linux-amd64':
      sha512IPFS = '1fef20ec24d9c0915a2878298e9468275ad286593b3c4b43356566416724a169275a8732e16764f0f56b8747302aadfe2126e34c8021713b7b4b6142ba99ac02'
      break
    case 'linux-arm64':
      sha512IPFS = '9d225a73656590dcdb4af445a6a782c0b07e43be71e1ae1f8107174ea88d08fa725acabc7662efd892b9152e11be334aeb7469d304262c01deacb3674a1d801c'
      break
    case 'windows-amd64':
      sha512IPFS = 'cdde0eb28d0d13d52e85eb973899c26b38f6d3f38731ba61f2beec19a40cc2e6646fc536505afe2798e1973e29b2d7ca9c5c8b312bb710d07dae4a5e5eab4bf0'
      break
    case 'windows-arm64':
      sha512IPFS = '5f06aca8afa8a77adff5355105010e65effe78035c05761cac07c5e2757841bed27e6736259135842d513fb4381860c462b42b7c2557f27dac7a3c5548b1d348'
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
