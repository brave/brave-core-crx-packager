/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const rootBuildDir = path.join(path.resolve(), 'build', 'playlist')

class Playlist {
  constructor (privateKeyFile) {
    const [, componentId] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    this.componentId = componentId
  }

  stagingDir = path.join(rootBuildDir, 'staging')
  crxFile = path.join(rootBuildDir, 'output', 'playlist.crx')

  async stageFiles (version, outputDir) {
    const originalManifest = path.join(path.resolve(), 'node_modules', 'playlist-component', 'manifest.json')
    util.stageDir(
      path.join(path.resolve(), 'node_modules', 'playlist-component'),
      originalManifest,
      version,
      outputDir)
  }
}

const generateCRXFile = async (binary, endpoint, region, privateKeyFile, publisherProofKey) => {
  const descriptor = new Playlist(privateKeyFile)

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
