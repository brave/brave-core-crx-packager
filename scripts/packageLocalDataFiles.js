/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-local-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/local-data-files-updater.pem

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import { pathToFileURL } from 'url'

const getOriginalManifest = () => {
  return path.join('manifests', 'local-data-files-updater', 'default-manifest.json')
}

const stageFiles = (version, outputDir) => {
  const datFileVersion = '1'
  const files = [
    { path: getOriginalManifest(), outputName: 'manifest.json' },
    { path: path.join('brave-lists', 'webcompat-exceptions.json'), outputName: path.join(datFileVersion, 'webcompat-exceptions.json') },
    { path: path.join('brave-lists', 'debounce.json'), outputName: path.join(datFileVersion, 'debounce.json') },
    { path: path.join('brave-lists', 'request-otr.json'), outputName: path.join(datFileVersion, 'request-otr.json') },
    { path: path.join('brave-lists', 'clean-urls.json'), outputName: path.join(datFileVersion, 'clean-urls.json') },
    { path: path.join('brave-lists', 'clean-urls-permissions.json'), outputName: path.join(datFileVersion, 'clean-urls-permissions.json') },
    { path: path.join('brave-lists', 'https-upgrade-exceptions-list.txt'), outputName: path.join(datFileVersion, 'https-upgrade-exceptions-list.txt') },
    { path: path.join('brave-lists', 'localhost-permission-allow-list.txt'), outputName: path.join(datFileVersion, 'localhost-permission-allow-list.txt') }
  ]
  util.stageFiles(files, version, outputDir)
}

const postNextVersionWork = (key, publisherProofKey, publisherProofKeyAlt, binary, localRun, version) => {
  const componentType = 'local-data-files-updater'
  const datFileName = 'default'
  const stagingDir = path.join('build', componentType, datFileName)
  const crxOutputDir = path.join('build', componentType)
  const crxFile = path.join(crxOutputDir, `${componentType}-${datFileName}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}-${datFileName}.pem`)
  }
  stageFiles(version, stagingDir)
  if (!localRun) {
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
  }
  console.log(`Generated ${crxFile} with version number ${version}`)
}

const processDATFile = (binary, endpoint, region, key, publisherProofKey, publisherProofKeyAlt, localRun) => {
  const originalManifest = getOriginalManifest()
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  if (!localRun) {
    return util.getNextVersion(endpoint, region, id).then((version) => {
      postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
        binary, localRun, version)
    })
  }
  postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
    binary, localRun, '1.0.0')
  return Promise.resolve()
}

export async function main (argv = process.argv) {
  util.installErrorHandlers()

  const command = util.addCommonScriptOptions(
    new commander.Command()
      .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
      .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
      .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely'))
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

  const processJob = () => {
    return processDATFile(command.binary, command.endpoint, command.region,
      keyParam, command.publisherProofKey, command.publisherProofKeyAlt, command.localRun)
  }

  if (!command.localRun) {
    return util.createTableIfNotExists(command.endpoint, command.region).then(() => processJob())
  }
  return processJob()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('Caught exception:', err)
    process.exit(1)
  })
}
