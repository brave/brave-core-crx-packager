/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ethereum-remote-client -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ethereum-remote-client.pem

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'

const stageFiles = (componentType, version, outputDir) => {
  util.stageDir(getPackageDirByComponentType(componentType), getOriginalManifest(componentType), version, outputDir)

  if (componentType === 'wallet-data-files-updater') {
    fs.unlinkSync(path.join(outputDir, 'package.json'))
  }
}

const validComponentTypes = [
  'ethereum-remote-client',
  'wallet-data-files-updater'
]

const getPackageNameByComponentType = (componentType) => {
  switch (componentType) {
    case 'ethereum-remote-client':
      return componentType
    case 'wallet-data-files-updater':
      return 'brave-wallet-lists'
    default:
      // shouldn't be possible to get here
      return null
  }
}
const getPackageDirByComponentType = (componentType) => {
  return path.join('node_modules', getPackageNameByComponentType(componentType))
}

const getOriginalManifest = (componentType) => {
  return path.join(getPackageDirByComponentType(componentType), 'manifest.json')
}

const generateCRXFile = async (binary, endpoint, region, componentType, key,
  publisherProofKey, localRun) => {
  const originalManifest = getOriginalManifest(componentType)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  let privateKeyFile = ''
  if (!localRun) {
    privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${componentType}.pem`)
  }
  const stagingDir = path.join('build', componentType)
  const crxFile = path.join(stagingDir, `${componentType}.crx`)

  await util.prepareNextVersionCRX(
    binary,
    publisherProofKey,
    endpoint,
    region,
    id,
    stageFiles.bind(undefined, componentType),
    stagingDir,
    crxFile,
    privateKeyFile,
    localRun)
}

const processJob = async (commander, keyParam) => {
  if (!validComponentTypes.includes(commander.type)) {
    throw new Error('Unrecognized component extension type: ' + commander.type)
  }
  await generateCRXFile(commander.binary, commander.endpoint,
    commander.region, commander.type, keyParam,
    commander.publisherProofKey,
    commander.localRun)
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
    .option('-t, --type <type>', 'component extension type', /^(local-data-files-updater|ethereum-remote-client|wallet-data-files-updater)$/i)
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely'))
  .parse(process.argv)

let keyParam = ''

if (!commander.localRun) {
  if (fs.existsSync(commander.keyFile)) {
    keyParam = commander.keyFile
  } else if (fs.existsSync(commander.keysDirectory)) {
    keyParam = commander.keysDirectory
  } else {
    throw new Error('Missing or invalid private key file/directory')
  }
}

if (!commander.localRun) {
  util.createTableIfNotExists(commander.endpoint, commander.region).then(async () => {
    await processJob(commander, keyParam)
  })
} else {
  processJob(commander, keyParam)
}
