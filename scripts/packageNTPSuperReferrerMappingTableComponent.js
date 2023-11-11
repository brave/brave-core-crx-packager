/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const stageFiles = (version, outputDir) => {
  const files = [
    { path: getOriginalManifest(), outputName: 'manifest.json' },
    { path: path.join(path.resolve(), 'build', 'ntp-super-referrer', 'resources', 'mapping-table', 'mapping-table.json') }
  ]
  util.stageFiles(files, version, outputDir)
}

const generateManifestFile = async (publicKey) => {
  const manifestFile = getOriginalManifest()
  const manifestContent = {
    description: 'Brave NTP Super Referrer mapping table component',
    key: publicKey,
    manifest_version: 2,
    name: 'Brave NTP Super Referrer mapping table',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'build', 'ntp-super-referrer', 'mapping-table-manifest.json')
}

const generateCRXFile = async (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey) => {
  const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-super-referrer', 'mapping-table')

  const stagingDir = path.join(rootBuildDir, 'staging')
  const crxFile = path.join(rootBuildDir, 'output', 'ntp-super-referrer-mapping-table.crx')

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    componentID,
    stageFiles,
    stagingDir,
    crxFile,
    privateKeyFile,
    false)
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
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
  generateManifestFile(publicKey)
  await generateCRXFile(commander.binary, commander.endpoint, commander.region,
    componentID, privateKeyFile, commander.publisherProofKey)
})
