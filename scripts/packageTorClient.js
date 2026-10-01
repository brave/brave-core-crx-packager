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

  const torVersion = '0.4.9.13'
  const braveVersion = '0'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = 'c1c30b7115105e1ccbf33f0790e3d9d043bcaa3b79c0d951a5cd96485792a891f7732811bf3d0ca493174ce4649263c6d60048c5a52deab98b5d135edfb70d03'
      break
    case 'linux':
      sha512Tor = '22e019a9401986e4cd74913f0b202e9e6b2297419fb489136d5bb94a783010b84825514362d379705318edb1668571b29caa5835ebbf022f4ba5519ca578e1fd'
      break
    case 'linux-arm64':
      sha512Tor = '549ec3c6f5f57b3c62e0d4371fcb47fe03f596e7a5fa568259bf9ce60adee24819a60ff2db9d58c9ad95a51b8e5dac7407ac0860478db92d0dc11c16f5388983'
      break
    case 'win32':
      sha512Tor = '1cfea1822d386cf8edf442c5f84c25d40ffa600bb31372630256cad08bdc7ead795d9e6b652b5b60c61c2dfc78a5defd91d09f86c96f42cbb83aac78c14d8b0d'
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
    await Promise.all(['darwin', 'linux', 'linux-arm64', 'win32'].map(platform =>
      packageTorClient(command.binary, command.endpoint, command.region,
        platform, keyParam, command.publisherProofKey, command.publisherProofKeyAlt)))
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('Caught exception:', err)
    process.exit(1)
  })
}
