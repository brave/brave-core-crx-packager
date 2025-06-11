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

  const torVersion = '0.4.8.14'
  const braveVersion = '0'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor =
        'ba9d2321ff9004d064cfa8f01789761bca4e92068fa50ed3125dccd5ba13ebd6dd385e83254f50879a4217b98a2e6b16dfc98a8432d146d62c71a312b5a5f6a7'
      break
    case 'linux':
      sha512Tor =
        '6968d8f8211aa643539e9cecadbb4d6f2ba53beda7814b984a76785babbc66987813a4e8d2dd9953422051972c8cdc34ae07ce405570149b927876200f9cfb95'
      break
    case 'linux-arm64':
      sha512Tor =
        '63aab8871d82114788701b3771172dddeebff6f36011a5d22040dbadd7e66c0f93f0a11905987dd7166156303610824bad01fe9ea8dba3021e7a86ad13ea7939'
      break
    case 'win32':
      sha512Tor =
        '97dac1de3bcf2f99ba618df997e8d2f0a33b3bd50e70321acb409a59345ffd9826907bceaf1e2c0ae23b0e3c0b35d2dc9d34e3eff1c20089c9087bb61d441833'
      break
    default:
      throw new Error(
        'Tor client download failed; unrecognized platform: ' + platform
      )
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
  return path.join(
    'manifests',
    'tor-client-updater',
    `tor-client-updater-${platform}-manifest.json`
  )
}

const packageTorClient = (
  binary,
  endpoint,
  region,
  platform,
  key,
  publisherProofKey,
  publisherProofKeyAlt
) => {
  const originalManifest = getOriginalManifest(platform)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  util.getNextVersion(endpoint, region, id).then((version) => {
    const stagingDir = path.join('build', 'tor-client-updater', platform)
    const torClient = downloadTorClient(platform)
    const crxOutputDir = path.join('build', 'tor-client-updater')
    const crxFile = path.join(
      crxOutputDir,
      `tor-client-updater-${platform}.crx`
    )
    const privateKeyFile = !fs.lstatSync(key).isDirectory()
      ? key
      : path.join(key, `tor-client-updater-${platform}.pem`)
    stageFiles(platform, torClient, version, stagingDir)
    util.generateCRXFile(
      binary,
      crxFile,
      privateKeyFile,
      publisherProofKey,
      publisherProofKeyAlt,
      stagingDir
    )
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
  const computedHash = crypto
    .createHash('sha512')
    .update(filecontent)
    .digest('hex')
  console.log(`${file} has hash ${computedHash}`)
  return hash === computedHash
}

util.installErrorHandlers()

util
  .addCommonScriptOptions(
    commander
      .option(
        '-d, --keys-directory <dir>',
        'directory containing private keys for signing crx files',
        'abc'
      )
      .option(
        '-f, --key-file <file>',
        'private key file for signing crx',
        'key.pem'
      )
  )
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
    packageTorClient(
      commander.binary,
      commander.endpoint,
      commander.region,
      platform,
      keyParam,
      commander.publisherProofKey,
      commander.publisherProofKeyAlt
    )
  }
})
