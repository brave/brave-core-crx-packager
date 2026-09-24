/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-wallet-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files-updater.pem

import { createRequire } from 'module'
import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import { pathToFileURL } from 'url'

const require = createRequire(import.meta.url)

const stageFiles = (version, outputDir) => {
  util.stageDir(getPackageDir(), getOriginalManifest(), version, outputDir)

  fs.unlinkSync(path.join(outputDir, 'package.json'))
}

const getPackageDir = () => {
  try {
    return path.dirname(require.resolve('@brave/wallet-lists/package.json'))
  } catch (err) {
    const fallback = path.join('node_modules', '@brave', 'wallet-lists')
    if (fs.existsSync(path.join(fallback, 'manifest.json'))) {
      return fallback
    }
    throw new Error(
      `Unable to locate @brave/wallet-lists. Install it before packaging (${err.message})`
    )
  }
}

const getOriginalManifest = () => {
  return path.join(getPackageDir(), 'manifest.json')
}

const postNextVersionWork = (key, publisherProofKey, publisherProofKeyAlt, binary, localRun, version) => {
  const componentType = 'wallet-data-files-updater'
  const stagingDir = path.join('build', componentType)
  const crxFile = path.join(stagingDir, `${componentType}.crx`)
  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}.pem`)
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

const processJob = (command, keyParam) => {
  return processDATFile(command.binary, command.endpoint,
    command.region, keyParam, command.publisherProofKey, command.publisherProofKeyAlt,
    command.localRun)
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

  if (!command.localRun) {
    await util.createTableIfNotExists(command.endpoint, command.region).then(() => {
      processJob(command, keyParam)
    })
  } else {
    processJob(command, keyParam)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
