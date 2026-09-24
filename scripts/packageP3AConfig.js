/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-p3a-config -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/p3a-config.pem

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import { pathToFileURL } from 'url'

const getOriginalManifest = () => {
  return path.join('manifests', 'p3a-config', 'default-manifest.json')
}

const postNextVersionWork = (key, publisherProofKey, publisherProofKeyAlt, binary, localRun, version, staging) => {
  const componentType = 'p3a-config'
  const datFileName = 'default'
  const stagingDir = path.join('build', componentType, datFileName)
  const crxOutputDir = path.join('build', componentType)
  const crxFile = path.join(crxOutputDir, `${componentType}-${datFileName}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}-${datFileName}.pem`)
  }
  const manifestFilename = 'p3a_manifest.json'
  const configPath = staging ? 'p3a-config-staging' : 'p3a-config'
  util.stageFiles([
    { path: getOriginalManifest(), outputName: 'manifest.json' },
    { path: path.join('node_modules', configPath, 'dist', manifestFilename), outputName: manifestFilename }
  ], version, stagingDir)
  if (!localRun) {
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
  }
  console.log(`Generated ${crxFile} with version number ${version}`)
}

const processDATFile = (binary, endpoint, region, key, publisherProofKey, publisherProofKeyAlt, localRun, staging) => {
  const originalManifest = getOriginalManifest()
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  if (!localRun) {
    return util.getNextVersion(endpoint, region, id).then((version) => {
      postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
        binary, localRun, version, staging)
    })
  }
  postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
    binary, localRun, '1.0.0', staging)
  return Promise.resolve()
}

export async function main (argv = process.argv) {
  util.installErrorHandlers()

  const command = util.addCommonScriptOptions(
    new commander.Command()
      .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
      .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
      .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely')
      .option('-s, --staging', 'Use staging P3A config'))
  command.parse(argv)

  let keyParam = ''

  if (!command.localRun) {
    if (fs.existsSync(command.keyFile)) {
      keyParam = command.keyFile
    } else if (fs.existsSync(command.keysDirectory)) {
      keyParam = command.keysDirectory
    } else {
      throw new Error('Missing or invalid private key file/directory')
    }
  }

  const processJob = (key, staging) => {
    return processDATFile(command.binary, command.endpoint, command.region,
      key, command.publisherProofKey, command.publisherProofKeyAlt, command.localRun, staging)
  }

  if (!command.localRun) {
    return util.createTableIfNotExists(command.endpoint, command.region).then(() => processJob(keyParam, command.staging))
  }
  return processJob(keyParam, command.staging)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('Caught exception:', err)
    process.exit(1)
  })
}
