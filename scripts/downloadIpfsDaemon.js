/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.27.0'

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
      sha512IPFS = 'aee927085da7615af78203b8dd6e07b39b37bac03d61a44aa27a26fbee5bb742c67a587bc27b95712ad6f92122c24024086ef9e37b294a6d2c4645732ff6fbcf'
      break
    case 'darwin-arm64':
      sha512IPFS = '567ab29f018ad91e00b8cf222b05665c6357d1cf0a9bc68711f14b65355b0716892eb50a1a84e3d89074aff2214af95f52b879e4276dc51d8b7d387191562d70'
      break
    case 'linux-amd64':
      sha512IPFS = '86e99a4aed0eb410833b6084c1c2d8486e6406b6ae2d8c992a72592a5534f1b58d7e73e3d51777df358de20ebe51a691258a6851c1ddb385f5cafdd2fc7caaea'
      break
    case 'linux-arm64':
      sha512IPFS = '946129ac49b5aca0b950d898f128c20cefadaffc3a3e0f09fdde0fbd18642747eb0282a12227a49ef365aa39292dddd89db6cb9d2408050a61120a709609a4a5'
      break
    case 'windows-amd64':
      sha512IPFS = 'bcd5f024dc8ab2c3f400d42a282b675f81da26b3457d396e1fc15775715ce69d47514bd6180ab5fa692dd06754b24c5d5efc37a4100c4ab80cf0dbdf15f6dd42'
      break
    case 'windows-arm64':
      sha512IPFS = 'a94eb0ff17a1f9561f7dbe9c735aa0be662294541dd1ea62f347ab20c266674df98084bb9d525c71aad2985d1efe1bc7a010e1e1c51fa483fd8daa48568ff888'
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
