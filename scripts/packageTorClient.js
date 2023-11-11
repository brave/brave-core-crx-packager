/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-tor-client -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

import commander from 'commander'
import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'

// Downloads the current (platform-specific) Tor client from S3
const downloadTorClient = (platform) => {
  const torPath = path.join('build', 'tor-client-updater', 'downloads')
  const torS3Prefix = process.env.S3_DEMO_TOR_PREFIX

  const torVersion = '0.4.8.9'
  const braveVersion = '0'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = '340eb7c0ebcdaaf821be6a6978b41b4a9a35e616c65d23cb37368a8827d901d8fdd5b040aae065931788c37dd8e0442ad164bb818c7cd2be0be5a63df03d07a4'
      break
    case 'linux':
      sha512Tor = '573fcc3c3532c6530ef1e5310f95d99434eb023af5ddab5872db5d05dd0370b725aa2f4dc053f119dce8c9ae2007e7997443ab7cde66591046f2fb0aec166e80'
      break
    case 'linux-arm64':
      sha512Tor = '4166c22821b8aad932fae434bb22c4b0bac6951bdf9fdef8d1ac5c5b9f1a22f931af950890ff4e2efcb89f97928e3029a40681a742269b4ecd8ba641c3c6ed09'
      break
    case 'win32':
      sha512Tor = '1ba9ed642fdf965ff9d3fd41120259c33d3840605254a599d8f52713e0d7057590f71aaadc554596f7547dce075af8c1c583a5a52429db7756fbba30e86d0e18'
      break
    default:
      throw new Error('Tor client download failed; unrecognized platform: ' + platform)
  }

  mkdirp.sync(torPath)

  const torClient = path.join(torPath, torFilename)
  const cmd = 'aws s3 cp ' + torURL + ' ' + torClient

  // Download the client
  execSync(cmd)

  // Verify the checksum
  if (!verifyChecksum(torClient, sha512Tor)) {
    console.error(`Tor client checksum verification failed on ${platform}`)
    process.exit(1)
  }

  // Make it executable
  fs.chmodSync(torClient, 0o755)

  return torClient
}

const getOriginalManifest = (platform) => {
  return path.join('manifests', 'tor-client-updater', `tor-client-updater-${platform}-manifest.json`)
}

const packageTorClient = async (binary, endpoint, region, platform, key,
  publisherProofKey) => {
  const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `tor-client-updater-${platform}.pem`)
  const originalManifest = getOriginalManifest(platform)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)
  const torClient = downloadTorClient(platform)

  const stagingDir = path.join('build', 'tor-client-updater', platform)
  const crxFile = path.join('build', 'tor-client-updater', `tor-client-updater-${platform}.crx`)

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    id,
    stageFiles.bind(undefined, platform, torClient),
    stagingDir,
    crxFile,
    privateKeyFile,
    false)
}

const stageFiles = (platform, torClient, version, outputDir) => {
  const files = [
    { path: getOriginalManifest(platform), outputName: 'manifest.json' },
    { path: torClient },
    { path: path.join('resources', 'tor', 'torrc'), outputName: 'tor-torrc' }
  ]
  util.stageFiles(files, version, outputDir)
}

// Does a hash comparison on a file against a given hash
const verifyChecksum = (file, hash) => {
  const filecontent = fs.readFileSync(file)
  const computedHash = crypto.createHash('sha512').update(filecontent).digest('hex')
  console.log(`${file} has hash ${computedHash}`)
  return hash === computedHash
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files', 'abc')
    .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem'))
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
  await packageTorClient(commander.binary, commander.endpoint, commander.region,
    'darwin', keyParam, commander.publisherProofKey)
  await packageTorClient(commander.binary, commander.endpoint, commander.region,
    'linux', keyParam, commander.publisherProofKey)
  await packageTorClient(commander.binary, commander.endpoint, commander.region,
    'linux-arm64', keyParam, commander.publisherProofKey)
  await packageTorClient(commander.binary, commander.endpoint, commander.region,
    'win32', keyParam, commander.publisherProofKey)
})
