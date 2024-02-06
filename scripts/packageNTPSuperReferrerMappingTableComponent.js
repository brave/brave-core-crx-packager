/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-super-referrer', 'mapping-table')

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'build', 'ntp-super-referrer', 'mapping-table-manifest.json')
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

class NTPSuperReferrerMappingTableComponent {
  constructor (privateKeyFile) {
    const [publicKey, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.publicKey = publicKey
    this.componentId = componentId
  }

  stagingDir = path.join(rootBuildDir, 'staging')
  crxFile = path.join(rootBuildDir, 'output', 'ntp-super-referrer-mapping-table.crx')

  async stageFiles (version, outputDir) {
    generateManifestFile(this.publicKey)
    const files = [
      { path: getOriginalManifest(), outputName: 'manifest.json' },
      { path: path.join(path.resolve(), 'build', 'ntp-super-referrer', 'resources', 'mapping-table', 'mapping-table.json') }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const generateCRXFile = async (binary, endpoint, region, privateKeyFile,
  publisherProofKey) => {
  const descriptor = new NTPSuperReferrerMappingTableComponent(privateKeyFile)

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
    .option('-k, --key <file>', 'file containing private key for signing crx file'))
  .parse(process.argv)

let privateKeyFile = ''
if (fs.existsSync(commander.key)) {
  privateKeyFile = commander.key
} else {
  throw new Error('Missing or invalid private key')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
  await generateCRXFile(commander.binary, commander.endpoint, commander.region,
    privateKeyFile, commander.publisherProofKey)
})
