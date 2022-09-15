/* Copyright (c) 2022 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/ad-block-updater-regional-component-keys

const commander = require('commander')
const fs = require('fs-extra')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')
const { regionalCatalogComponentId, resourcesComponentId } = require('../lib/adBlockRustUtils')

async function stageFiles (version, outputDir) {
  // ad-block components are in the correct folder
  // we don't need to stage the crx files
  const resourceFileName = 'resources.json'
  const resourceJsonPath = path.join('build', 'ad-block-updater', 'default', resourceFileName)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputResourceJSON = path.join(outputDir, resourceFileName)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  replace.sync(replaceOptions)
  // Only copy resources.json into components with a UUID. We will migrate to
  // using component IDs instead of UUIDs for directory names.
  // UUIDs are 36 characters, component IDs are 32.
  if (path.basename(outputDir).length > 32 && resourceJsonPath !== outputResourceJSON) {
    fs.copyFileSync(resourceJsonPath, outputResourceJSON)
  }
}

const postNextVersionWork = (componentSubdir, key, publisherProofKey,
  binary, localRun, version, contentHash) => {
  const stagingDir = path.join('build', 'ad-block-updater', componentSubdir)
  const crxOutputDir = path.join('build', 'ad-block-updater')
  const crxFile = path.join(crxOutputDir, `ad-block-updater-${componentSubdir}.crx`)
  const contentHashFile = path.join(crxOutputDir, `ad-block-updater-${componentSubdir}.contentHash`)
  stageFiles(version, stagingDir).then(() => {
    // Remove any existing `.contentHash` file for determinism
    if (fs.existsSync(contentHashFile)) {
      fs.unlinkSync(contentHashFile)
    }
    if (!localRun) {
      const privateKeyFile = path.join(key, `ad-block-updater-${componentSubdir}.pem`)
      util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
        stagingDir)
    }
    if (contentHash !== undefined) {
      fs.writeFileSync(contentHashFile, contentHash)
    }
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const getOriginalManifest = (componentSubdir) => {
  const manifestsDir = path.join('build', 'ad-block-updater')
  return path.join(manifestsDir, componentSubdir, 'manifest.json')
}

const processComponent = (binary, endpoint, region, keyDir,
  publisherProofKey, localRun, componentSubdir) => {
  const originalManifest = getOriginalManifest(componentSubdir)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  let fileToHash
  if (componentSubdir === regionalCatalogComponentId) {
    fileToHash = 'regional_catalog.json'
  } else if (componentSubdir === resourcesComponentId) {
    fileToHash = 'resources.json'
  } else if (componentSubdir.length === 32) {
    fileToHash = 'list.txt'
  }

  let contentHash
  if (fileToHash !== undefined) {
    const contentFile = path.join('build', 'ad-block-updater', componentSubdir, fileToHash)
    contentHash = util.generateSHA256HashOfFile(contentFile)
  }

  if (!localRun) {
    util.getNextVersion(endpoint, region, id, contentHash).then((version) => {
      if (version !== undefined) {
        postNextVersionWork(componentSubdir, keyDir, publisherProofKey,
          binary, localRun, version, contentHash)
      } else {
        console.log('content for ' + id + ' was not updated, skipping!')
      }
    })
  } else {
    postNextVersionWork(componentSubdir, undefined, publisherProofKey,
      binary, localRun, '1.0.0', contentHash)
  }
}

const getComponentList = () => {
  return fs.readdirSync(path.join('build', 'ad-block-updater'))
    .filter(dir => {
      return fs.existsSync(path.join('build', 'ad-block-updater', dir, 'manifest.json'))
    })
    .reduce((acc, val) => {
      acc.push(path.join(val))
      return acc
    }, [])
}

const processJob = (commander, keyDir) => {
  getComponentList()
    .forEach(processComponent.bind(null, commander.binary, commander.endpoint,
      commander.region, keyDir,
      commander.publisherProofKey,
      commander.localRun))
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely'))
  .parse(process.argv)

if (!commander.localRun) {
  let keyDir = ''
  if (fs.existsSync(commander.keysDirectory)) {
    keyDir = commander.keysDirectory
  } else {
    throw new Error('Missing or invalid private key file/directory')
  }
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    processJob(commander, keyDir)
  })
} else {
  processJob(commander, undefined)
}
