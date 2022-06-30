/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')
const ntpUtil = require('../lib/ntpUtil')

const getOutPath = (outputFilename) => {
  let outPath = path.join('build')
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath)
  }
  outPath = path.join(outPath, 'youtubedown')
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath)
  }
  return path.join(outPath, outputFilename)
}

const stageFiles = (version, outputDir) => {
  const scriptFile = getOutPath('youtubedown.js')
  const outputScriptFile = path.join(outputDir, 'youtubedown.js')
  console.log('copy ', scriptFile, ' to:', outputScriptFile)
  fs.copyFileSync(scriptFile, outputScriptFile)

  // Fix up the manifest version
  const originalManifest = getOriginalManifest()
  const outputManifest = path.join(outputDir, 'manifest.json')
  console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)
}

const getOriginalManifest = () => {
  return getOutPath('youtubedown-manifest.json')
}

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey) => {
  const rootBuildDir = path.join(path.resolve(), 'build', 'youtubedown')
  const stagingDir = path.join(rootBuildDir, 'staging')
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentID).then((version) => {
    const crxFile = path.join(crxOutputDir, 'youtubedown.crx')
    stageFiles(version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
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

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const [, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  generateCRXFile(commander.binary, commander.endpoint, commander.region,
    componentID, privateKeyFile, commander.publisherProofKey)
})
