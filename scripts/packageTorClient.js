/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-tor-client -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir --set-version 1.0.1

const commander = require('commander')
const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')

const {generateCRXFile, installErrorHandlers} = require('../lib/util')

// Downloads the current (platform-specific) Tor client from S3
const downloadTorClient = (platform) => {
  const torPath = path.join('build', 'tor-client-updater', 'downloads')
  const torS3Prefix = 'https://s3.us-east-2.amazonaws.com/demo-tor-binaries/'

  const torVersion = '0.3.3.8'
  const braveVersion = '5'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = '1a578a544ba259a9de11a63ef24f867bb7efbf7df4cd45dd08b9fff775f3b7f39eacd699c25fab22d69d4bee25bc03e9977a5cc66416792281276d584c101a5f'
      break
    case 'linux':
      sha512Tor = '193f01b75123debf90b3e35d0bc731f9e59cc06cd4e2869123f133f3a5f5c1796150b536c3cca50a9579c03f90084e5052d3ca385f807eac191f46348a57dce1'
      break
    case 'win32':
      sha512Tor = '7ba514fdd5f184015d65bbb65c82475dc256d23078dd3f7d115b4e2b93bf73ceedfbca89eed1baf501bddcdb7f5c81f384e02836588d067c01c3f469b0664885'
      break
    default:
      throw new Error('Tor client download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(torPath)

  const torClient = path.join(torPath, torFilename)
  const cmd = 'curl -o ' + torClient + ' ' + torURL

  // Download the client
  execSync(cmd)

  // Verify the checksum
  if (!verifyChecksum(torClient, sha512Tor)) {
    console.error('Tor client checksum verification failed')
    process.exit(1)
  }

  // Make it executable
  fs.chmodSync(torClient, 0o755)

  return torClient
}

const packageTorClient = (binary, platform, key) => {
  const stagingDir = path.join('build', 'tor-client-updater', platform)
  const torClient = downloadTorClient(platform)
  const crxOutputDir = path.join('build', 'tor-client-updater')
  const crxFile = path.join(crxOutputDir, `tor-client-updater-${platform}.crx`)
  const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `tor-client-updater-${platform}.pem`)
  stageFiles(platform, torClient, stagingDir)
  generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
}

const stageFiles = (platform, torClient, outputDir) => {
  const originalManifest = path.join('manifests', 'tor-client-updater', `tor-client-updater-${platform}-manifest.json`)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputTorClient = path.join(outputDir, path.parse(torClient).base)

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: commander.setVersion
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(torClient, outputTorClient)

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

packageTorClient(commander.binary, 'darwin', keyParam)
packageTorClient(commander.binary, 'linux', keyParam)
packageTorClient(commander.binary, 'win32', keyParam)
