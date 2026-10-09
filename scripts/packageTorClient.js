/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// pnpm package-tor-client -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

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

  const torVersion = '0.4.9.14'
  const braveVersion = '0'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = '36ac4998749655b0910cb591cb57c768ce925fc480def79e2d243dfa22b637ee846472a2dca6645bcbec6af44f6bb98c3e929b7fc754df0b25ecae3e379e3f6e'
      break
    case 'linux':
      sha512Tor = '3db5baca64c3f911e94f56db73e942034955f98490892650127e018d89a03246760cd7c4eb5764a918771b68dd78ecf1240e67aceffda7f369fca64863a943c0'
      break
    case 'linux-arm64':
      sha512Tor = '78c6c32a7237786b805d0ed601fd8e9d1f5115b55be9ce818c4645d5a7f83e87e161eeda92f6246cfcc54f414e131c623282304ccf6b008fcb3ec87fd6a87368'
      break
    case 'win32':
      sha512Tor = '4d684ded4d6be101adbf0ab6977f443f69d6193bb5841059c3e21619a1e3aa89a090fb514a14b381ab51596a292252b6751650c6575adf129cebd8b5c2a9f57d'
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

const packageTorClient = (binary, endpoint, region, platform, key,
  publisherProofKey, publisherProofKeyAlt) => {
  const originalManifest = getOriginalManifest(platform)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  util.getNextVersion(endpoint, region, id).then((version) => {
    const stagingDir = path.join('build', 'tor-client-updater', platform)
    const torClient = downloadTorClient(platform)
    const crxOutputDir = path.join('build', 'tor-client-updater')
    const crxFile = path.join(crxOutputDir, `tor-client-updater-${platform}.crx`)
    const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `tor-client-updater-${platform}.pem`)
    stageFiles(platform, torClient, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
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

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  for (const platform of ['darwin', 'linux', 'linux-arm64', 'win32']) {
    packageTorClient(commander.binary, commander.endpoint, commander.region,
      platform, keyParam, commander.publisherProofKey, commander.publisherProofKeyAlt)
  }
})
