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

function createManifestForUpload (commander) {
  const componentManifest = path.join('manifests', commander.type + '-manifest.json')
  const name = JSON.parse(fs.readFileSync(componentManifest)).name

  const manifestDir = path.join('build', commander.type, 'stable', 'extensions')
  const manifestFile = path.join(manifestDir, 'extensionManifest.json')

  const content =
        [
          [
            getIDFromComponentType(commander.type),
            commander.setVersion,
            generateSHA256HashOfFile(commander.crx),
            name
          ]
        ]

  mkdirp.sync(manifestDir)

  fs.writeFileSync(manifestFile, JSON.stringify(content, null, 2))
}

function generateSHA256HashOfFile (file) {
  const data = fs.readFileSync(file)
  const hash = crypto.createHash('sha256')
  return hash.update(data).digest('hex')
}

function getIDFromComponentType (componentType) {
  switch (componentType) {
    case 'ad-block-updater':
      return 'cffkpbalmllkdoenhmdmpbkajipdjfam'
    case 'tracking-protection-updater':
      return 'afalakplffnnnlkncjhbmahjfjhmlkal'
    default:
      throw new Error('Unrecognized component extension type: ' + componentType)
  }
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

createManifestForUpload(commander)

let args = ''

args += '--chromium 0.0.0.0 '
args += '--id ' + getIDFromComponentType(commander.type) + ' '
args += '--location ' + path.join('build', commander.type) + ' '
args += '--path ' + path.join('build', commander.type, commander.type + '.crx') + ' '
args += '--version ' + commander.setVersion + ' '
args += '--v 0'

const script = path.join('node_modules', 'release-tools', 'bin', 'updateExtensions')
const result = childProcess.execSync(`node ${script} ${args}`)

const output = result.toString()
if (output) {
  console.log(output)
}

console.log(`Uploaded ${commander.crx}`)
