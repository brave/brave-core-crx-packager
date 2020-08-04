/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const stageFiles = (version, outputDir) => {
  const scriptFile = path.join(path.resolve(), 'build', 'youtubedown', 'youtubedown.js')
  //..
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
    name: `youtubedown`,
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const downloadLatestYoutubedown = () => {
  return new Promise(function (resolve, reject) {
    const downloadUrl = 'https://www.jwz.org/hacks/youtubedown.js'

    request(downloadUrl, async function (error, response, body) {
      if (error) {
        console.error(`Error trying to download ${downloadUrl}:`, error)
        return reject(error)
      }

      if (response && response.statusCode === 200) {
        const targetScriptFile = path.join(path.resolve(), 'build', 'youtubedown', 'youtubedown.js')
        fs.writeFileSync(targetScriptFile, body)
        resolve()
      }

      const errorText = response
         ? `Invalid response code: ${response.statusCode}:`
         : 'Response was null or empty'
      console.error(errorText)
      return reject(errorText)
    }
}

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'build','youtubedown', 'youtubedown-manifest.json')
}

const generatePublicKeyAndID = (privateKeyFile) => {
  childProcess.execSync(`openssl rsa -in ${privateKeyFile} -pubout -out public.pub`)
  try {
      // read contents of the file
      const data = fs.readFileSync('public.pub', 'UTF-8');

      // split the contents by new line
      const lines = data.split(/\r?\n/);
      let pubKeyString = ''
      lines.forEach((line) => {
          if (!line.includes('-----'))
            pubKeyString += line
      });
      console.log(`publicKey: ${pubKeyString}`)
      const id = util.getIDFromBase64PublicKey(pubKeyString)
      console.log(`componentID: ${id}`)
      return [pubKeyString, id]
  } catch (err) {
      console.error(err);
  }
}

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile) => {
  const originalManifest = getOriginalManifest()
  const rootBuildDir = path.join(path.resolve(), 'build', 'youtubedown')
  const stagingDir = path.join(rootBuildDir, 'staging')
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentID).then((version) => {
    const crxFile = path.join(crxOutputDir, `youtubedown.crx`)
    stageFiles(version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
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

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const [publicKey, componentID] = generatePublicKeyAndID(privateKeyFile)
  generateManifestFile(publicKey)
  await downloadLatestYoutubedown()
  generateCRXFile(commander.binary, commander.endpoint, commander.region, componentID, privateKeyFile)
})
