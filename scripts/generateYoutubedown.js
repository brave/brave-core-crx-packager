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

const YoutubeDownJSURL = 'https://www.jwz.org/hacks/youtubedown.js'

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
    const options = {
      url: downloadUrl,
      headers: {
       'User-Agent': 'Request',
      }
    }
    request
      .get(options)
      .pipe(fs.createWriteStream(destPath))
      .on('response', function(response) {
        resolve()
      })
      .on('error' , function(error) {
        return reject()
      })
  })
}

async function downloadLatestYoutubedown () {
  await downloadFileSync(YoutubeDownJSURL, getOutPath('youtubedown.js'))
}

const getOriginalManifest = () => {
  return getOutPath('youtubedown-manifest.json')
}

util.installErrorHandlers()

commander
  .option('-k, --key <file>', 'file containing private key for signing crx file')
  .parse(process.argv)

let privateKeyFile = ''
if (fs.existsSync(commander.key)) {
  privateKeyFile = commander.key
} else {
  throw new Error('Missing or invalid private key')
}

const [publicKey, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
generateManifestFile(publicKey)
downloadLatestYoutubedown()
