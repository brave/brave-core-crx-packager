/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-tor-pluggable-transports -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

import commander from 'commander'
import { execSync } from 'child_process'
import fs from 'fs'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'

const TOR_PLUGGABLE_TRANSPORTS_UPDATER = 'tor-pluggable-transports-updater'

const getTransportUrl = (platform, transport) => {
  if (transport === 'snowflake') {
    return `snowflake/client/${platform}/tor-snowflake-brave`
  }
  if (transport === 'obfs4') {
    return `obfs4/obfs4proxy/${platform}/tor-obfs4-brave`
  }
}

// Downloads one platform-specific tor pluggable transport executable from s3
const downloadTorPluggableTransport = (platform, transport) => {
  const transportPath = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER, 'dowloads', `${platform}`)
  const transportFilename = `tor-${transport}-brave`

  mkdirp.sync(transportPath)

  const transportFile = path.join(transportPath, transportFilename)
  const cmd = 'cp ' + getTransportUrl(platform, transport) + ' ' + transportFile
  // Download the executable
  execSync(cmd)

  // Make it executable
  fs.chmodSync(transportFile, 0o755)

  return transportFile
}

const getOriginalManifest = (platform) => {
  return path.join('manifests', TOR_PLUGGABLE_TRANSPORTS_UPDATER, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}-manifest.json`)
}

class TorPluggableTransports {
  constructor (platform) {
    this.platform = platform

    const originalManifest = getOriginalManifest(this.platform)
    const parsedManifest = util.parseManifest(originalManifest)
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)

    this.stagingDir = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER, this.platform)
    this.crxFile = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${this.platform}.crx`)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${this.platform}.pem`)
  }

  async stageFiles (version, outputDir) {
    const snowflake = downloadTorPluggableTransport(this.platform, 'snowflake')
    const obfs4 = downloadTorPluggableTransport(this.platform, 'obfs4')

    const files = [
      { path: getOriginalManifest(this.platform), outputName: 'manifest.json' },
      { path: snowflake },
      { path: obfs4 }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const packageTorPluggableTransports = async (binary, endpoint, region, platform, key, publisherProofKey) => {
  const descriptor = new TorPluggableTransports(platform)

  const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : descriptor.privateKeyFromDir(key)

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    descriptor,
    privateKeyFile,
    false)
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
  await packageTorPluggableTransports(commander.binary, commander.endpoint, commander.region,
    'darwin', keyParam, commander.publisherProofKey)
  await packageTorPluggableTransports(commander.binary, commander.endpoint, commander.region,
    'linux', keyParam, commander.publisherProofKey)
  await packageTorPluggableTransports(commander.binary, commander.endpoint, commander.region,
    'win32', keyParam, commander.publisherProofKey)
})
