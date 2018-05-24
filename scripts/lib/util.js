/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')

function createManifestForUpload (id, version, hash, name, outputDir) {
  const manifestDir = path.join(outputDir, 'stable', 'extensions')
  const manifestFile = path.join(manifestDir, 'extensionManifest.json')

  const content =
        [
          [
            id,
            version,
            hash,
            name
          ]
        ]

  mkdirp.sync(manifestDir)

  fs.writeFileSync(manifestFile, JSON.stringify(content, null, 2))
}

function generateCRXFile (crxFile, privateKeyFile, inputDir, outputDir) {
  const ChromeExtension = require('crx')
  const crx = new ChromeExtension({
    privateKey: fs.readFileSync(privateKeyFile)
  })

  crx.load(path.resolve(inputDir))
    .then(() => crx.loadContents())
    .then((archiveBuffer) => {
      crx.pack(archiveBuffer).then((crxBuffer) => {
        fs.writeFileSync(crxFile, crxBuffer)
        console.log('Generated ' + crxFile)
      })
    })
    .catch((err) => {
      console.error(err.stack)
      throw err
    })
}

function generateSHA256Hash (data) {
  const hash = crypto.createHash('sha256')
  return hash.update(data).digest('hex')
}

function generateSHA256HashOfFile (file) {
  return generateSHA256Hash(fs.readFileSync(file))
}

function getIDFromBase64PublicKey (key) {
  const hash = crypto.createHash('sha256')
  const data = Buffer.from(key, 'base64')
  const digest = hash.update(data).digest('hex')
  const id = digest.toString().substring(0, 32)
  return id.replace(/[0-9a-f]/g, (c) => {
    return 'abcdefghijklmnop'.charAt('0123456789abcdef'.indexOf(c))
  })
}

function installErrorHandlers () {
  process.on('uncaughtException', (err) => {
    console.error('Caught exception:', err)
    process.exit(1)
  })

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
    process.exit(1)
  })
}

function uploadExtension (id, version, hash, name, crxFile, outputDir) {
  const script = path.join('node_modules', 'release-tools', 'bin', 'updateExtensions')

  let args = ''

  args += '--chromium 0.0.0.0 '
  args += `--id ${id} `
  args += `--location ${outputDir} `
  args += `--path ${crxFile} `
  args += `--version ${version} `
  args += '--v 0'

  createManifestForUpload(id, version, hash, name, outputDir)

  return childProcess.execSync(`node ${script} ${args}`).toString()
}

module.exports = {
  createManifestForUpload,
  generateCRXFile,
  generateSHA256HashOfFile,
  getIDFromBase64PublicKey,
  installErrorHandlers,
  uploadExtension
}
