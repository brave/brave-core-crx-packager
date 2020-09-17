/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const request = require('request')
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

const generateManifestFile = (publicKey) => {
  const manifestFile = getOriginalManifest()
  const manifestContent = {
    description: 'Brave wrapper for youtubedown (jwz.org)',
    key: publicKey,
    manifest_version: 2,
    name: 'youtubedown',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

function downloadFileSync (downloadUrl, destPath) {
  return new Promise(function (resolve, reject) {
    // Not sure why below code doesn't work. callback is not called.
    // request(downloadUrl, async function (error, response, body) {
    //   if (error) {
    //     console.error(`Error trying to download ${downloadUrl}:`, error)
    //     return reject(error)
    //   }

    //   if (response && response.statusCode === 200) {
    //     fs.writeFileSync(destPath, body)
    //     resolve()
    //   }

    //   const errorText = response
    //     ? `Invalid response code: ${response.statusCode}:`
    //     : 'Response was null or empty'
    //   console.error(errorText)
    //   return reject(errorText)
    // })

    request
      .get(downloadUrl)
      .on('response', function(response) {
        resolve()
      })
      .on('error' , function(error) {
        return reject()
      })
      .pipe(fs.createWriteStream(destPath))
  })
}

async function downloadLatestYoutubedown (bucketUrl) {
  // TODO(bsclifton): doesn't handle errors (ex: 403)
  // script is currently getting a 403 when fetched :(
  // Because of 403 from 'https://www.jwz.org/hacks/youtubedown.js', we copied
  // youtubedown.js to s3 bucket.
  await downloadFileSync(
    bucketUrl + 'playlist/youtubedown.js', getOutPath('youtubedown.js'))
}

const getOriginalManifest = () => {
  return getOutPath('youtubedown-manifest.json')
}

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile) => {
  const originalManifest = getOriginalManifest()
  const rootBuildDir = path.join(path.resolve(), 'build', 'youtubedown')
  const stagingDir = path.join(rootBuildDir, 'staging')
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentID).then((version) => {
    const crxFile = path.join(crxOutputDir, 'youtubedown.crx')
    stageFiles(version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-d, --bucket-url <url>', 'url that refers to the bucket that has youtubedown.js')
  .option('-k, --key <file>', 'file containing private key for signing crx file')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
  .parse(process.argv)

let privateKeyFile = ''
if (fs.existsSync(commander.key)) {
  privateKeyFile = commander.key
} else {
  throw new Error('Missing or invalid private key')
}

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

if (!commander.bucketUrl) {
  throw new Error('Missing Bucket url --bucket-url')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const [publicKey, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  generateManifestFile(publicKey)
  downloadLatestYoutubedown(commander.bucketUrl)
  generateCRXFile(commander.binary, commander.endpoint, commander.region, componentID, privateKeyFile)
})
