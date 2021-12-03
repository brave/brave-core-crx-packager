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

  const torVersion = '0.4.5.11'
  const braveVersion = '0'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = '94559e666cf8a689b791c887147a3354d923109603ebb2f187041e59f20bd15170815b4b2743919aaf44f0e9d54456d01034025b1f2c63291b8e3a162dc828c5'
      break
    case 'linux':
      sha512Tor = '6eb556cdcf49d9f5bad5f7ac6ef918313bd8fe3165071757498d2f8f1dd2a5cdbeed39754bc3e7776b1e349dc4b81dbe4b6a5d699c2b0de14f09bb65d0b670a9'
      break
    case 'win32':
      sha512Tor = '1bc4fff5216a800c5cb0bae3e05d82e444ed3e62933da0e8c0d36021ac021594d91da45156307fd8b10fbba2ba2f7f034f3402d13471689c918507fc0d71b0a3'
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
    console.error('Tor client checksum verification failed')
    process.exit(1)
  }

  // Make it executable
  fs.chmodSync(torClient, 0o755)

  return torClient
}

const getOriginalManifest = (platform) => {
  return path.join('manifests', 'tor-client-updater', `tor-client-updater-${platform}-manifest.json`)
}

const packageTorClient = (binary, endpoint, region, platform, key) => {
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
    util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
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
  return hash === crypto.createHash('sha512').update(filecontent).digest('hex')
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files', 'abc')
  .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  packageTorClient(commander.binary, commander.endpoint, commander.region, 'darwin', keyParam)
  packageTorClient(commander.binary, commander.endpoint, commander.region, 'linux', keyParam)
  packageTorClient(commander.binary, commander.endpoint, commander.region, 'win32', keyParam)
})
