/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const fsx = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const stageTheme = (themeDir, themeName, version, outputDir) => {
  const originalManifest = getOriginalManifest(themeDir)
  const outputManifest = path.join(outputDir, themeName, 'manifest.json')

  const originalImagesDir = path.join(themeDir, 'images')
  const outputImagesDir = path.join(outputDir, themeName, 'images')

  // Replaces version number and strips hex color code comments from
  // manifest.json

  const replaceOptions = {
    files: outputManifest,
    from: [/1\.0/, /\/\/#.*/g],
    to: [version, '']
  }

  mkdirp.sync(path.join(outputDir, themeName))

  // Copy manifest.json and perform replacements

  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)

  // Copy images

  mkdirp.sync(outputImagesDir)
  fsx.copySync(originalImagesDir, outputImagesDir)
}

const generateCRXFiles = (binary, endpoint, region, outputDir) => {
  const themesDir = path.join('node_modules', 'brave-chromium-themes')
  fs.readdirSync(themesDir).forEach(file => {
    const themeDir = path.join(themesDir, file)
    if (fs.lstatSync(path.join(themesDir, file)).isDirectory()) {
      const originalManifest = getOriginalManifest(themeDir)
      const parsedManifest = util.parseManifest(originalManifest)
      const id = util.getIDFromBase64PublicKey(parsedManifest.key)
      util.getNextVersion(endpoint, region, id).then((version) => {
        const crxFile = path.join(outputDir, file + '.crx')
        const privateKeyFile = path.join(commander.keysDirectory, file + '.pem')
        stageTheme(themeDir, file, version, outputDir)
        util.generateCRXFile(binary, crxFile, privateKeyFile, path.join(outputDir, file))
        console.log(`Generated ${crxFile} with version number ${version}`)
      })
    }
  })
}

const getOriginalManifest = (themeDir) => {
  return path.join(themeDir, 'manifest.json')
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-k, --keys-directory <dir>', 'directory containing private key files for signing crx files', 'keys')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
  .parse(process.argv)

if (!fs.lstatSync(commander.keysDirectory)) {
  throw new Error('Missing or invalid option: --keys-directory')
}

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

const outputDir = path.join('build', 'themes')

generateCRXFiles(commander.binary, commander.endpoint, commander.region, outputDir)
