/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shared packaging logic for local-models components (e.g. leo-local-models,
// asr-local-models). These components ship a directory of model files staged
// alongside a committed default-manifest.json, so the only per-component
// differences are the component type and the resource directory.

import commander from 'commander'
import fs from 'fs-extra'
import path from 'path'
import util from './util.js'

/**
 * Packages a local-models component into a CRX file.
 *
 * @param {Object} options
 * @param {string} options.componentType - Component type and manifest
 *   directory name (e.g. 'asr-local-models-updater').
 * @param {string} options.resourceDir - Local directory holding the downloaded
 *   model files to stage (e.g. 'asr-local-models').
 */
export const packageLocalModelsComponent = ({ componentType, resourceDir }) => {
  const datFileName = 'default'

  const getOriginalManifest = () => {
    return path.join('manifests', componentType, 'default-manifest.json')
  }

  const stageFiles = (version, outputDir) => {
    util.stageDir(resourceDir, getOriginalManifest(), version, outputDir)
  }

  const postNextVersionWork = (key, publisherProofKey, publisherProofKeyAlt, binary, localRun, version) => {
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
      util.getNextVersion(endpoint, region, id).then((version) => {
        postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
          binary, localRun, version)
      })
    } else {
      postNextVersionWork(key, publisherProofKey, publisherProofKeyAlt,
        binary, localRun, '1.0.0')
    }
  }

  const processJob = (commander, keyParam) => {
    processDATFile(commander.binary, commander.endpoint, commander.region,
      keyParam, commander.publisherProofKey, commander.publisherProofKeyAlt, commander.localRun)
  }

  util.installErrorHandlers()

  util.addCommonScriptOptions(
    commander
      .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
      .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
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
    util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
      processJob(commander, keyParam)
    })
  } else {
    processJob(commander, keyParam)
  }
}

export default { packageLocalModelsComponent }
