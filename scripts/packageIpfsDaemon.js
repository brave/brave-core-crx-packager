/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-ipfs-daemon -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir --set-version 1.0.1

const commander = require('commander')
const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')

const {generateCRXFile, installErrorHandlers} = require('../lib/util')

// Downloads the current (platform-specific) Ipfs Daemon from S3
const downloadIpfsDaemon = (platform) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')

  const ipfsDistPrefix = 'https://ipfs.io/ipns/dist.ipfs.io/go-ipfs/v0.4.17/'

  const ipfsVersion = '0.4.17'
  const braveVersion = '5'
  const exeSuffix = platform === 'win32' ? '.zip' : '.tar.gz'
  const myplatform = platform === 'win32' ? 'windows' : platform

  const ipfsFilename = `go-ipfs_v${ipfsVersion}_${myplatform}-amd64`
  const ipfsURL = ipfsDistPrefix + ipfsFilename + exeSuffix

  let sha512IPFS = ''

  switch (platform) {
    case 'darwin':
    sha512IPFS = 'c3d18404f257fcf8674ca0afcd45bf36501624c10a8642d59d52deb850383b7f136f4849919a1a4560eee1af61705cd91dd01b3e219fb38d0582cace2b0b03d7'
      break
    case 'linux':
    sha512IPFS = 'e4131388efe52d0ec0e68fa3c0110c43fc58e2a5c5bb2c72062f5b947c7622dff78cde1181029331144298f15879887c20173d0eada368e7051f4f2b5c6b41ef'
      break
    case 'win32':
    sha512IPFS = 'b9175c6f1b624ee1e5db3076f5f5859c4e5dd9abc050f75c6a4ee5ecb7ab89b8fdec965c88b851775b369bc08a8c2dfc0d84807726a4f24448eacfc0e48cdc6c'
      break
    default:
      throw new Error('Ipfs Daemon download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(ipfsPath)
  const ipfsDaemon = path.join(ipfsPath, ipfsFilename)
  // Build decompression command based on system
  const decompressUnix = ' | tar xf - -C  ' + ipfsPath + ' && cp ' + ipfsPath + '/go-ipfs/ipfs ' + ipfsDaemon 
  const decompressWindows = ' | bsdtar -xf- -C ' + ipfsPath + ' && cp ' + ipfsPath + '/go-ipfs/ipfs.exe ' + ipfsDaemon 
  const decompress = platform === 'win32' ? decompressWindows : decompressUnix
  const cmd = 'curl -s ' + ipfsURL + decompress

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

const packageIpfsDaemon = (binary, platform, key) => {
  const stagingDir = path.join('build', 'ipfs-daemon-updater', platform)
  const ipfsDaemon = downloadIpfsDaemon(platform)
  const crxOutputDir = path.join('build', 'ipfs-daemon-updater')
  const crxFile = path.join(crxOutputDir, `ipfs-daemon-updater-${platform}.crx`)
  const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `ipfs-daemon-updater-${platform}.pem`)
  stageFiles(platform, ipfsDaemon, stagingDir)
  generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
}

const stageFiles = (platform, ipfsDaemon, outputDir) => {
  const originalManifest = path.join('manifests', 'ipfs-daemon-updater', `ipfs-daemon-updater-${platform}-manifest.json`)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputTorClient = path.join(outputDir, path.parse(ipfsDaemon).base)

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: commander.setVersion
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(ipfsDaemon, outputTorClient)

  replace.sync(replaceOptions)
}

// Does a hash comparison on a file against a given hash
const verifyChecksum = (file, hash) => {
  const filecontent = fs.readFileSync(file)
  return hash === crypto.createHash('sha512').update(filecontent).digest('hex')
}

installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files', 'abc')
  .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
  .option('-s, --set-version <x.x.x>', 'component extension version number')
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

if (!commander.setVersion || !commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

packageIpfsDaemon(commander.binary, 'darwin', keyParam)
packageIpfsDaemon(commander.binary, 'linux', keyParam)
packageIpfsDaemon(commander.binary, 'win32', keyParam)
