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

const packageTorPluggableTransports = (binary, endpoint, region, platform, key, publisherProofKey, publisherProofKeyAlt) => {
  const originalManifest = getOriginalManifest(platform)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  util.getNextVersion(endpoint, region, id).then((version) => {
    const snowflake = downloadTorPluggableTransport(platform, 'snowflake')
    const obfs4 = downloadTorPluggableTransport(platform, 'obfs4')

    const stagingDir = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER, platform)
    const crxOutputDir = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER)
    const crxFile = path.join(crxOutputDir, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}.crx`)
    const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}.pem`)
    stageFiles(platform, snowflake, obfs4, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey, publisherProofKeyAlt, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const stageFiles = (platform, snowflake, obfs4, version, outputDir) => {
  const files = [
    { path: getOriginalManifest(platform), outputName: 'manifest.json' },
    { path: snowflake },
    { path: obfs4 }
  ]
  util.stageFiles(files, version, outputDir)
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
  for (const platform of ['darwin', 'linux', 'win32']) {
    packageTorPluggableTransports(commander.binary, commander.endpoint, commander.region,
      platform, keyParam, commander.publisherProofKey, commander.publisherProofKeyAlt)
  }
})
