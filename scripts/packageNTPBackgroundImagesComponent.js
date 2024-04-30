/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'build', 'ntp-background-images', 'ntp-background-images-manifest.json')
}

const stageFiles = util.stageDir.bind(
  undefined,
  path.join(path.resolve(), 'build', 'ntp-background-images', 'resources'),
  getOriginalManifest())

const generateManifestFile = (publicKey) => {
  const manifestFile = getOriginalManifest()
  const manifestContent = {
    description: 'Brave NTP background images component',
    key: publicKey,
    manifest_version: 2,
    name: 'Brave NTP background images',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey, publisherProofKeyAlt) => {
  const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-background-images')
  const stagingDir = path.join(rootBuildDir, 'staging')
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentID).then((version) => {
    const crxFile = path.join(crxOutputDir, 'ntp-background-images.crx')
    stageFiles(version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-k, --key-file <file>', 'file containing private key for signing crx file'))
  .parse(process.argv)

let privateKeyFile = ''
if (fs.existsSync(commander.keyFile)) {
  privateKeyFile = commander.keyFile
} else {
  throw new Error('Missing or invalid private key')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const [publicKey, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  generateManifestFile(publicKey)
  generateCRXFile(commander.binary, commander.endpoint, commander.region,
    componentID, privateKeyFile, commander.publisherProofKey, commander.publisherProofKeyAlt)
})
