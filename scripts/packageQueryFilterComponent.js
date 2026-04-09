/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-query-filter -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/query-filter.pem

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'manifests', 'query-filter', 'default-manifest.json')
}

const stageFiles = (version, outputDir) => {
  const files = [
    { path: getOriginalManifest(), outputName: 'manifest.json' },
    { path: path.join('query-filter', 'query-filter.json'), outputName: 'query-filter.json' }
  ]
  util.stageFiles(files, version, outputDir)
}

const generateManifestFile = (publicKey) => {
  const manifestFile = getOriginalManifest()
  const manifestContent = {
    description: 'Query filter component',
    key: publicKey,
    manifest_version: 2,
    name: 'Query Filter',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey, publisherProofKeyAlt) => {
  const stagingDir = path.join('build', 'query-filter')
  const crxFile = path.join(stagingDir, 'query-filter.crx')
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
