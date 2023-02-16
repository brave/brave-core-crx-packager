/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-tor-client -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

const commander = require('commander')
const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

// Downloads the current (platform-specific) Tor client from S3
const downloadTorClient = (platform) => {
  const torPath = path.join('build', 'tor-client-updater', 'downloads')
  const torS3Prefix = process.env.S3_DEMO_TOR_PREFIX

  const torVersion = '0.4.7.10'
  const braveVersion = '2'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = '96d4683f059027fc63467cb0719553ac1dcb2be7a4303735d34cad736b34e06daece261cb41f823bf0daf27c3cd5ad7d74563a5c520f8844c202da40bd5c57a0'
      break
    case 'linux':
      sha512Tor = '4d2ef4b4b578d6127bd730d6dafb4c32e235d19bb80ae34bcda806fb4809f3a2e3c8e8ce4af30d94ab0f3e93cdb39799a0f7edfb953523591f3ca9253eec9f7d'
      break
    case 'linux-arm64':
      sha512Tor = 'ed1d999d07f971251c191bb3adae6cd119309d78d874d5741a7f889d6e6c1b02f7866b87b9eb3a3d09f4068ebf2e285e47d492d77d62a5435d536d90ff8e65b6'
      break
    case 'win32':
      sha512Tor = '7d3acfdbdb5f6d4c79c60b2a8450a0515be3f3eb7da34d0e1b5d4ebe434e388537f1888746a3c6807d4c9165757593d71c982c0bc90527483e863b79d1000b16'
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
  publisherProofKey) => {
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
      stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const stageFiles = (platform, torClient, version, outputDir) => {
  const originalManifest = getOriginalManifest(platform)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputTorClient = path.join(outputDir, path.parse(torClient).base)
  const outputTorrc = path.join(outputDir, 'tor-torrc')
  const inputTorrc = path.join('resources', 'tor', 'torrc')

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(torClient, outputTorClient)
  fs.copyFileSync(inputTorrc, outputTorrc)

  replace.sync(replaceOptions)
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
  packageTorClient(commander.binary, commander.endpoint, commander.region,
    'darwin', keyParam, commander.publisherProofKey)
  packageTorClient(commander.binary, commander.endpoint, commander.region,
    'linux', keyParam, commander.publisherProofKey)
  packageTorClient(commander.binary, commander.endpoint, commander.region,
    'linux-arm64', keyParam, commander.publisherProofKey)
  packageTorClient(commander.binary, commander.endpoint, commander.region,
    'win32', keyParam, commander.publisherProofKey)
})
