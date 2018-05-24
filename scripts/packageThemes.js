/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs')
const fsx = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')

const {generateCRXFile, installErrorHandlers} = require('./lib/util')

function stageTheme (themeDir, themeName, outputDir) {
  const originalManifest = path.join(themeDir, 'manifest.json')
  const outputManifest = path.join(outputDir, themeName, 'manifest.json')

  const originalImagesDir = path.join(themeDir, 'images')
  const outputImagesDir = path.join(outputDir, themeName, 'images')

  // Replaces version number and strips hex color code comments from
  // manifest.json

  const replaceOptions = {
    files: outputManifest,
    from: [/1\.0/, /\/\/#.*/g],
    to: [commander.setVersion, '']
  }

  mkdirp.sync(path.join(outputDir, themeName))

  // Copy manifest.json and perform replacements

  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)

  // Copy images

  mkdirp.sync(outputImagesDir)
  fsx.copySync(originalImagesDir, outputImagesDir)
}

function generateCRXFiles (outputDir) {
  const themesDir = path.join('node_modules', 'brave-chromium-themes')
  fs.readdirSync(themesDir).forEach(file => {
    if (fs.lstatSync(path.join(themesDir, file)).isDirectory()) {
      const crxFile = path.join(outputDir, file + '.crx')
      const privateKeyFile = path.join(commander.keysDirectory, file + '.pem')
      stageTheme(path.join(themesDir, file), file, outputDir)
      generateCRXFile(crxFile, privateKeyFile, path.join(outputDir, file), outputDir)
    }
  })
}

installErrorHandlers()

commander
  .option('-k, --keys-directory <dir>', 'directory containing private key files', 'keys')
  .option('-s, --set-version <x.x.x>', 'extension version number')
  .parse(process.argv)

if (!commander.keysDirectory || !fs.lstatSync(commander.keysDirectory)) {
  throw new Error('Missing or invalid option: ' + commander.keysDirectory)
}

if (!commander.setVersion || !commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version')
}

const outputDir = path.join('build', 'themes')

generateCRXFiles(outputDir)
