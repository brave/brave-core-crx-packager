/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/wallet-data-files.pem

const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const COMPONENT_TYPE = 'wallet-data-files-updater'
const MANIFEST_TEMPLATE_PATH = path.join('manifests', COMPONENT_TYPE, 'manifest.json')

function stageComponentManifestFile(stagingDir, version) {
  const originalManifest = MANIFEST_TEMPLATE_PATH
  const outputManifest = path.join(stagingDir, 'manifest.json')
  console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)
}

function getOutputTokenPath(stagingDir, inputTokenFilePath) {
  const tokenFilename = path.parse(inputTokenFilePath).base
  return path.join(stagingDir, tokenFilename)
}

function stageTokenFile(stagingDir, inputTokenFilePath) {
  fs.copyFileSync(inputTokenFilePath, getOutputTokenPath(stagingDir, inputTokenFilePath))
}

async function stageTokenImages(stagingDir, inputTokenFilePath, addExtraTokens = false) {
  const outputTokenFilePath = getOutputTokenPath(stagingDir, inputTokenFilePath);
  const baseSrcTokenPath = path.dirname(inputTokenFilePath)
  // Copy images and convert them to png plus resize to 200x200 if needed
  const imagesSrcPath = path.join(baseSrcTokenPath, "images")
  const imagesDstPath = path.join(stagingDir, "images")
  const files = fs.readdirSync(imagesSrcPath)
  if (!fs.existsSync(imagesDstPath)){
    fs.mkdirSync(imagesDstPath)
  }
  for (var i = 0; i < files.length; i++) {
    var file = files[i]
    var fileTo = file.substr(0, file.lastIndexOf(".")) + ".png"
    var fromPath = path.join(imagesSrcPath, file)
    var toPath = path.join(imagesDstPath, fileTo)
    await util.saveToPNGResize(fromPath, toPath, false)
  }
  util.contractReplaceSvgToPng(outputTokenFilePath)
  // We can remove this later if we migrate the tokens to
  // github.com/brave/token-list.  We can't do this yet because we need
  // to supporpt old builds that are using the token file.
  // This can be done after April 2022.
  if (addExtraTokens) {
    util.contractAddExtraAssetIcons(outputTokenFilePath, imagesDstPath)
  }
}

const postNextVersionWork = (stagingDir, keyParam, binary, version) => {
  const crxFile = path.join(stagingDir, `${COMPONENT_TYPE}.crx`)
  const privateKeyFile = !fs.lstatSync(keyParam).isDirectory() ? keyParam : path.join(keyParam, `${COMPONENT_TYPE}.pem`)
  util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
  console.log(`Generated ${crxFile} with version number ${version}`)
}

async function processJob (commander, keyParam) {
  if (!commander.localRun) {
    await util.createTableIfNotExists(commander.endpoint, commander.region)
  }
  const stagingDir = path.join('build', COMPONENT_TYPE)
  mkdirp.sync(stagingDir)

  // Add MetaMask tokens for contract-map.json
  const metamaskTokenPath = path.join('node_modules', '@metamask', 'contract-metadata', 'contract-map.json');
  stageTokenFile(stagingDir, metamaskTokenPath)
  await stageTokenImages(stagingDir, metamaskTokenPath, true)

  // Add Brave specific tokens in evm-contract-map.json
  const braveTokenPath = path.join('node_modules', '@brave', 'token-lists', 'evm-contract-map.json');
  stageTokenFile(stagingDir, braveTokenPath)
  await stageTokenImages(stagingDir, braveTokenPath)

  let version = '1.0.0'
  if (!commander.localRun) {
    const componentId = util.getComponentIdFromManifest(MANIFEST_TEMPLATE_PATH)
    version = await util.getNextVersion(commander.endpoint, commander.region, componentId)
  }
  stageComponentManifestFile(stagingDir, version)
  if (!commander.localRun) {
    postNextVersionWork(stagingDir, keyParam, commander.binary, version)
  }
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
  .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
  .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely')
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

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

processJob(commander, keyParam)
