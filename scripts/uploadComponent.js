/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const commander = require('commander')
const crypto = require('crypto')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')

process.on('uncaughtException', (err) => {
  console.error('Caught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
  process.exit(1)
})

function createManifestForUpload (commander, id, name) {
  const manifestDir = path.join('build', commander.type, 'stable', 'extensions')
  const manifestFile = path.join(manifestDir, 'extensionManifest.json')

  const content =
        [
          [
            id,
            commander.setVersion,
            generateSHA256HashOfFile(commander.crx),
            name
          ]
        ]

  mkdirp.sync(manifestDir)

  fs.writeFileSync(manifestFile, JSON.stringify(content, null, 2))
}

function parseManifest (componentType) {
  const componentManifest = path.join('manifests', componentType + '-manifest.json')
  return JSON.parse(fs.readFileSync(componentManifest))
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

commander
  .option('-c, --crx <crx-file>', 'crx file', 'extension.crx')
  .option('-s, --set-version <x.x.x>', 'component extension version number')
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|tracking-protection-updater)$/i, 'ad-block-updater')
  .parse(process.argv)

if (!fs.existsSync(commander.crx)) {
  throw new Error('Missing CRX file: ' + commander.crx)
}

if (!commander.setVersion) {
  throw new Error('Missing required option: --set-version')
}

if (!commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

const data = parseManifest(commander.type)

const id = getIDFromBase64PublicKey(data.key)
const name = data.name

createManifestForUpload(commander, id, name)

let args = ''

args += '--chromium 0.0.0.0 '
args += `--id ${id} `
args += `--location ${path.join('build', commander.type)} `
args += `--path ${path.join('build', commander.type, commander.type + '.crx')} `
args += `--version ${commander.setVersion} `
args += '--v 0'

const script = path.join('node_modules', 'release-tools', 'bin', 'updateExtensions')
const result = childProcess.execSync(`node ${script} ${args}`)

const output = result.toString()
if (output) {
  console.log(output)
}

console.log(`Uploaded ${commander.crx}`)
