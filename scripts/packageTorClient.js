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
import { pathToFileURL } from 'url'

// Downloads the current (platform-specific) Tor client from S3
const downloadTorClient = (platform) => {
  const torPath = path.join('build', 'tor-client-updater', 'downloads')
  const torS3Prefix = process.env.S3_DEMO_TOR_PREFIX

  const torVersion = '0.4.9.12'
  const braveVersion = '0'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = '72290bc298e4fb2f5f1371dcf02602b3edfe90f333d8ca7f1d28bfe5341037800c812304d640251c65e4439e7b0c99352ab8561b88d36cd6bc3c7207b4f9edad'
      break
    case 'linux':
      sha512Tor = 'b126647a431e66fb9f8393cd01e4732e9e120f7cb4fbce7a0155b88e7bd07b6b2412db152b3c9bdcd9afc1753c85a6448d2fbce1a437edcb5c517946ff5696dc'
      break
    case 'linux-arm64':
      sha512Tor = '5e98ee7b376c3d65b1977d7e4327fc54b424508bcd28d04e768f6113522a28db07008983fc42eb3be76bd4c0f8369236f8f0c4efb858b7e141a50f54bfeb7028'
      break
    case 'win32':
      sha512Tor = '6b3dda8962772c69b5ec3eb2f1f384d97addc477c788d608dc42384d5800b57bebe1271e059a631e5446b0cad1a8af4124d25218197a7d7aa4e95a47650f33c6'
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
  publisherProofKey, publisherProofKeyAlt) => {
  const originalManifest = getOriginalManifest(platform)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  return util.getNextVersion(endpoint, region, id).then((version) => {
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

export async function main (argv = process.argv) {
  util.installErrorHandlers()

  const command = util.addCommonScriptOptions(
    new commander.Command()
      .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files', 'abc')
      .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem'))
  command.parse(argv)

  let keyParam = ''

  if (fs.existsSync(command.keyFile)) {
    keyParam = command.keyFile
  } else if (fs.existsSync(command.keysDirectory)) {
    keyParam = command.keysDirectory
  } else {
    throw new Error('Missing or invalid private key file/directory')
  }

  await util.createTableIfNotExists(command.endpoint, command.region).then(async () => {
    for (const platform of ['darwin', 'linux', 'linux-arm64', 'win32']) {
      await packageTorClient(command.binary, command.endpoint, command.region,
        platform, keyParam, command.publisherProofKey, command.publisherProofKeyAlt)
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
