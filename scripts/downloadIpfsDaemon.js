/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')
const ipfsVersion = '0.6.0'

// Downloads the current (platform-specific) Ipfs Daemon from ipfs.io
const downloadIpfsDaemon = (platform) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = `https://ipfs.io/ipns/dist.ipfs.io/go-ipfs/v${ipfsVersion}/`

  const zipSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform

  const ipfsFilename = `go-ipfs_v${ipfsVersion}_${myplatform}-amd64`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + zipSuffix

  let sha512IPFS = ''

  switch (platform) {
    case 'darwin':
      sha512IPFS = '9ed1ef6453c5a3548851b6390e543492f962d04a49c2a141faeb1696b9591facdb7265fa62a65146178483953a1532d666beb50097e3dd3f6b11a409385c7336'
      break
    case 'linux':
      sha512IPFS = '1b2ed446a2a3559b4e1116ee4ac5a2692090ac65ad89fff91af462834b5987b845903ce0c8ccde8d51f428499cd02f204f39238860baded8777d1d3078250ead'
      break
    case 'win32':
      sha512IPFS = 'f458693726482db839b64da8d3e4c8f2339d7e31c5c8686bffcd30d6c68166db5ff0e4c173db341a88cf14f07ee01199aa322ce29ecf2e47c2cfe8ea95c49f58'
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
