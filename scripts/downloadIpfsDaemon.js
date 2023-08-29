/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.21.0'

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
      sha512IPFS = 'b9282a78179dad64685068178af5d5e73d18dba99bf94af274a174824a36d5fdc5ad7357592c928bbc65d91b1df4d5d3dbef507c0371ed13bf562f90fd0f0d20'
      break
    case 'darwin-arm64':
      sha512IPFS = 'd53087188bbbb0b48e2201fdc7f0984a2d8259440bae5ab55654263239e9d40a7da2f62445e2533895af17b642e6aacc0a1a69fa093b4955ac554cc58fdb46dd'
      break
    case 'linux-amd64':
      sha512IPFS = 'c289162807fd2e743a1099a3f62321dc30f68ac4665bbe6afe62bb9700e379f2ea6359feb715b7aa0e99bd95f8f6b0cda326eba574ce87d53fb62f0d38f37fa1'
      break
    case 'linux-arm64':
      sha512IPFS = '1c7398128403fa098bbe57b56fad3122601154399f7d2d382fee223e48d2f6c1ea58cb198147810c8806387547b047d989d934c76aec584977c58dc7b722f223'
      break
    case 'windows-amd64':
      sha512IPFS = '28955a5289dc6ed6ce26ae77476afe2fd05cd5a8c4a71e34827775b2a43860d968517ff3891fbfb53975e006282387829b20d75917015545a57ac9e4229762a8'
      break
    case 'windows-arm64':
      sha512IPFS = '5f3a610c4deeb799e5063895f85fddfbd4afd422e9800ad83b86574f53ef29e9809012d7624ce4711fa2edb45f8db20605c9688b640ac174b3dc113d1defed1c'
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

export {
  ipfsVersion
}
