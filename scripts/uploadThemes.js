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

function createManifestForUpload (id, name, crxFileHash) {
  const manifestDir = path.join('build', 'themes', 'stable', 'extensions')
  const manifestFile = path.join(manifestDir, 'extensionManifest.json')

  const content =
        [
          [
            id,
            commander.setVersion,
            crxFileHash,
            name
          ]
        ]

  mkdirp.sync(manifestDir)

  fs.writeFileSync(manifestFile, JSON.stringify(content, null, 2))
}

function parseManifest (manifestFile) {
  // Strip comments from manifest.json before parsing
  const json = fs.readFileSync(manifestFile).toString('utf-8').replace(/\/\/#.*/g, '')
  return JSON.parse(json)
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

function upload (crxFile) {
  const outputDir = path.join('build', 'themes')
  const themeName = path.parse(crxFile).name

  const manifest = path.join('node_modules', 'brave-chromium-themes', themeName, 'manifest.json')
  const data = parseManifest(manifest)

  const id = getIDFromBase64PublicKey(data.key)
  const name = data.name
  const crxFileHash = generateSHA256HashOfFile(crxFile)

  createManifestForUpload(id, name, crxFileHash)

  let args = ''

  args += '--chromium 0.0.0.0 '
  args += `--id ${id} `
  args += `--location ${outputDir} `
  args += `--path ${crxFile} `
  args += `--version ${commander.setVersion} `
  args += '--v 0'

  const script = path.join('node_modules', 'release-tools', 'bin', 'updateExtensions')
  const result = childProcess.execSync(`node ${script} ${args}`)

  const output = result.toString()
  if (output) {
    console.log(output)
  }

  console.log(args)

  console.log(`Uploaded ${crxFile}`)
}

commander
  .option('-c, --crx-directory <dir>', 'crx directory')
  .option('-s, --set-version <x.x.x>', 'extension version number')
  .parse(process.argv)

if (!commander.crxDirectory || !fs.lstatSync(commander.crxDirectory).isDirectory()) {
  throw new Error('Missing or invalid option: --crx-directory')
}

if (!commander.setVersion || !commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

const outputDir = path.join('build', 'themes')
fs.readdirSync(commander.crxDirectory).forEach(file => {
  if (path.extname(file) === '.crx') {
    upload(path.join(outputDir, file))
  }
})
