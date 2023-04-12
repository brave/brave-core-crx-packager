/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
const ipfsVersion = '0.19.1'

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
      sha512IPFS = '2289126c287de605090c4b1bb9b33f198c64343c756ae5844430ce4253e4b427d446e20953130373350ea43e782d7c1b83b7bd206bdb5d10cad3c54f1d51bae5'
      break
    case 'darwin-arm64':
      sha512IPFS = '70e9ea41de54c66dc8906458b3af6377d0a51fc456e3e1a906b9e77d3ecf858f0ce2af56eec6e9a1408ed127829084268e18c6638fb6eb09878976a533371297'
      break
    case 'linux-amd64':
      sha512IPFS = 'ff5110d7cac3fd3da49c0fbfc78b79cd17777636ce67bfe40186202a77d13c320f5061fbcc2d5fe7f08d573d3e4f5bda588d5879e59e6a1dec97770f0c2dba1b'
      break
    case 'linux-arm64':
      sha512IPFS = 'ca01c592e81ab39b5763c9ff8b3782a6afa034917877bca1d245441531c67ba01252dd4e5cc6e7cc84ae264b5ca59ddddd368336e58b178b982a68c572cec27f'
      break
    case 'windows-amd64':
      sha512IPFS = 'f6b9d9dabbb94de81918ad3d1ef67d9dfdb13b8d1d6526119caee620c58bab26a91c3320232fdfd43221fc691a28a48bd86b706757c2e3ec58d05871c92fac19'
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
