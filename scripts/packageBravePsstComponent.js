/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-brave-psst -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/brave-psst.pem

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const psstSubmoduleDir = path.join(path.resolve(), 'submodules', 'psst')
const psstOutputDir = path.join(psstSubmoduleDir, 'out')

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'manifests', 'psst', 'default-manifest.json')
}

const stageFiles = util.stageDir.bind(
  undefined,
  path.join(psstOutputDir),
  getOriginalManifest())

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey, publisherProofKeyAlt) => {
  const stagingDir = path.join('build', 'psst')
  const crxFile = path.join(stagingDir, 'psst.crx')
  mkdirp.sync(stagingDir)
  util.getNextVersion(endpoint, region, componentID).then((version) => {
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
if (commander.keyFile && fs.existsSync(commander.keyFile)) {
  privateKeyFile = commander.keyFile
} else {
  throw new Error('Missing or invalid private key')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const [, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  generateCRXFile(commander.binary, commander.endpoint, commander.region,
    componentID, privateKeyFile, commander.publisherProofKey, commander.publisherProofKeyAlt)
})
