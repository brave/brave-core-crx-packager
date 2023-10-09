/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.23.0'

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
      sha512IPFS = '02f862b7aefad13b4bbcad0aa6bf0200b3eaaff959aaca0c77a14a26b64cc6ebcbd3f4d68504b32e4747cb188b300154c507cba7a5666d10305fb92a2cee90bf'
      break
    case 'darwin-arm64':
      sha512IPFS = '341caa363c5409d48a6dd467ecbb083213702a919ba2e4a55428cad92c935d763dd1f3b97962ee696a37969cfa1e694076cdcef559d85a3fa92568b97d804197'
      break
    case 'linux-amd64':
      sha512IPFS = 'c1a6a7238098cbb4a7de22efc3871a7236092693062098096e0be26e69ac7864e59a14f9885a1af00ac124384b40789ee2bf3139ee886f978db3d2a15f52c5fe'
      break
    case 'linux-arm64':
      sha512IPFS = '9fb44db944093c8373f00168a2e5ed86911c4c238d91cab87ee76c1ccb9d137172ec3478e0d2afef3b4f1f5cbb2eb973b12d68091d29e97f0c31676854f5923a'
      break
    case 'windows-amd64':
      sha512IPFS = 'b328bb3fd88258348ae012a75fd2f16a5298e90b5af35a73b4c9c81d334fbb1e9b1743a5a5ce585badc4f59de692010eba0a522112e13675ab33046717056e8d'
      break
    case 'windows-arm64':
      sha512IPFS = '7319b5a64d06ca4ea610c184d8f5161218fc76f449b546ef31005bfd4d10577c5e1f7833161fd4abe94079aadd6aad3b0be7b71059e19cfacb7838fcced93594'
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
