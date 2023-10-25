/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const stageFiles = (superReferrerName, version, outputDir) => {
  util.stageDir(
    undefined,
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

const generateCRXFile = (binary, endpoint, region, superReferrerName,
  componentID, privateKeyFile, publisherProofKey) => {
  const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-super-referrer')
  const stagingDir = path.join(rootBuildDir, 'staging', superReferrerName)
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentID).then((version) => {
    const crxFile = path.join(crxOutputDir, `ntp-super-referrer-${superReferrerName}.crx`)
    stageFiles(superReferrerName, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
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

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const [publicKey, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  generateManifestFile(commander.superReferrerName, publicKey)
  generateCRXFile(commander.binary, commander.endpoint, commander.region,
    commander.superReferrerName, componentID, privateKeyFile,
    commander.publisherProofKey)
})
