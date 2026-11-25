/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// pnpm package-tor-client -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

// Downloads the current (platform-specific) Tor client from S3
const downloadTorClient = (platform) => {
  const torPath = path.join('build', 'tor-client-updater', 'downloads')
  const torS3Prefix = process.env.S3_DEMO_TOR_PREFIX

  const torVersion = '0.4.9.16'
  const braveVersion = '0'
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const torFilename = `tor-${torVersion}-${platform}-brave-${braveVersion}`
  const torURL = torS3Prefix + torFilename + exeSuffix

  let sha512Tor = ''

  switch (platform) {
    case 'darwin':
      sha512Tor = 'b280a44a197db4769f80f5c52799e1f9c85f1d817e2fbeb36d5a273bdde891fff858362d7de9725f806ba12a5d394de2972199077b6748c3707e2a436876ad13'
      break
    case 'linux':
      sha512Tor = 'c9f5bd5fc53300365017a64075b3f16fc6d73686a8b61c44c3cde52365915de7ef85bb9fedeeb992b7cf8013497a914035332e7a950c841073804c3eba93a5d8'
      break
    case 'linux-arm64':
      sha512Tor = '5fde524a44ea84af84bd0cb2b12110883b1c73137ccd151dc4eff94a1c6e07cc1b7adf3c5029c3ae98c6bde2d91802b7b6c732ee4f6c276169b142d281462722'
      break
    case 'win32':
      sha512Tor = '7d40268c7c66775f2ff1189303ae533f0a6cd71420621b8f914fa4762beb5cf2166c9d38f5bb656d33d66612ec158524f4ced739a0a79c146e2220e0efa35b14'
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

// Does a hash comparison on a file against a given hash
const verifyChecksum = (file, hash) => {
  const filecontent = fs.readFileSync(file)
  const computedHash = crypto.createHash('sha512').update(filecontent).digest('hex')
  console.log(`${file} has hash ${computedHash}`)
  return hash === computedHash
}

const getOriginalManifest = (platform) => {
  return path.join('manifests', 'tor-client-updater', `tor-client-updater-${platform}-manifest.json`)
}

class TorClient {
  constructor (platform) {
    this.platform = platform
    const originalManifest = getOriginalManifest(this.platform)
    const parsedManifest = util.parseManifest(originalManifest)
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)

    this.stagingDir = path.join('build', 'tor-client-updater', this.platform)
    this.crxFile = path.join('build', 'tor-client-updater', `tor-client-updater-${this.platform}.crx`)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `tor-client-updater-${this.platform}.pem`)
  }

  async stageFiles (version, outputDir) {
    const torClient = downloadTorClient(this.platform)
    const files = [
      { path: getOriginalManifest(this.platform), outputName: 'manifest.json' },
      { path: torClient },
      { path: path.join('resources', 'tor', 'torrc'), outputName: 'tor-torrc' }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const platforms = ['darwin', 'linux', 'linux-arm64', 'win32']

const args = getPackagingArgs()
Promise.all(platforms.map(platform => packageComponent(args, new TorClient(platform))))
