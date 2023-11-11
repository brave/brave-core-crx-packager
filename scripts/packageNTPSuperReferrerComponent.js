/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const stageFiles = (superReferrerName, version, outputDir) => {
  util.stageDir(
    path.join(path.resolve(), 'build', 'ntp-super-referrer', 'resources', superReferrerName, '/'),
    getOriginalManifest(superReferrerName),
    version,
    outputDir)
}

const generateManifestFile = (superReferrerName, publicKey) => {
  const manifestFile = getOriginalManifest(superReferrerName)
  const manifestContent = {
    description: 'Brave NTP Super Referrer component',
    key: publicKey,
    manifest_version: 2,
    name: `Brave NTP Super Referrer (${superReferrerName})`,
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const getOriginalManifest = (superReferrerName) => {
  return path.join(path.resolve(), 'build', 'ntp-super-referrer', `${superReferrerName}-manifest.json`)
}

const generateCRXFile = async (binary, endpoint, region, superReferrerName,
  componentID, privateKeyFile, publisherProofKey) => {
  const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-super-referrer')

  const stagingDir = path.join(rootBuildDir, 'staging', superReferrerName)
  const crxFile = path.join(rootBuildDir, 'output', `ntp-super-referrer-${superReferrerName}.crx`)

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    componentID,
    stageFiles.bind(undefined, superReferrerName),
    stagingDir,
    crxFile,
    privateKeyFile,
    false)
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-n, --super-referrer-name <name>', 'super referrer name for this component')
    .option('-k, --key <file>', 'file containing private key for signing crx file'))
  .parse(process.argv)

let privateKeyFile = ''
if (fs.existsSync(commander.key)) {
  privateKeyFile = commander.key
} else {
  throw new Error('Missing or invalid private key')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
  const [publicKey, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  generateManifestFile(commander.superReferrerName, publicKey)
  await generateCRXFile(commander.binary, commander.endpoint, commander.region,
    commander.superReferrerName, componentID, privateKeyFile,
    commander.publisherProofKey)
})
