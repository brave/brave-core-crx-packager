/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'node_modules', 'playlist-component', 'manifest.json')
}

const stageFiles = util.stageDir.bind(
  undefined,
  path.join(path.resolve(), 'node_modules', 'playlist-component'),
  getOriginalManifest())

const generateCRXFile = async (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey) => {
  const rootBuildDir = path.join(path.resolve(), 'build', 'playlist')

  const stagingDir = path.join(rootBuildDir, 'staging')
  const crxFile = path.join(rootBuildDir, 'output', 'playlist.crx')

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
  const [, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  await generateCRXFile(commander.binary, commander.endpoint, commander.region,
    componentID, privateKeyFile, commander.publisherProofKey)
})
