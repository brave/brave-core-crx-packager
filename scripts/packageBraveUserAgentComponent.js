/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-brave-user-agent -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/brave-user-agent.pem

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { pathToFileURL } from 'url'

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'manifests', 'brave-user-agent', 'default-manifest.json')
}

const stageFiles = (version, outputDir) => {
  const files = [
    { path: getOriginalManifest(), outputName: 'manifest.json' },
    { path: path.join('brave-user-agent', 'brave-checks.txt'), outputName: 'brave-checks.txt' }
  ]
  util.stageFiles(files, version, outputDir)
}

const generateManifestFile = (publicKey) => {
  const manifestFile = getOriginalManifest()
  const manifestContent = {
    description: 'Brave User Agent component',
    key: publicKey,
    manifest_version: 2,
    name: 'Brave User Agent',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey, publisherProofKeyAlt) => {
  const stagingDir = path.join('build', 'brave-user-agent')
  const crxFile = path.join(stagingDir, 'brave-user-agent.crx')
  mkdirp.sync(stagingDir)
  return util.getNextVersion(endpoint, region, componentID).then((version) => {
    stageFiles(version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

export async function main (argv = process.argv) {
  util.installErrorHandlers()

  const command = util.addCommonScriptOptions(
    new commander.Command()
      .option('-k, --key-file <file>', 'file containing private key for signing crx file'))
  command.parse(argv)

  let privateKeyFile = ''
  if (fs.existsSync(command.keyFile)) {
    privateKeyFile = command.keyFile
  } else {
    throw new Error('Missing or invalid private key')
  }

  await util.createTableIfNotExists(command.endpoint, command.region).then(() => {
    const [publicKey, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    generateManifestFile(publicKey)
    return generateCRXFile(command.binary, command.endpoint, command.region,
      componentID, privateKeyFile, command.publisherProofKey, command.publisherProofKeyAlt)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('Caught exception:', err)
    process.exit(1)
  })
}
