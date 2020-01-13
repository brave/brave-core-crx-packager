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

const getComponentDataList = () => {
  return [
      { locale: 'en-US',
        key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwnu+bh/TJ1+SvCtc4aRHC92fjS167f5uZKwgZ/YcvRK0y5BDiiWu/owQYIgcDLBYvBrJbpRg+3jyEYMdMYsCgoj6l+OZXeTGHXKGG3HeBHpu4mXArj3ohG3ce3P4SlpuuOI4qhtDsu1t7n/fP4Jm+vPMviaeJCfxVMVQEllol7ReMFpmVcpqUmiFMoF6Oop2IuZ7iSv+r/OU8dhWPO+0ghZ9b8S1D8Yr8P3ZrywUcO4vi26e5Hw8jHD1OdOuNbNYiwnqCzR4TaI4eRpPrMYBJ5MpQGKR/sxjByvdyE4iR7+4CCHXcaADY8VRcxlzjWsK7ZcSqpAdWxL5wEnWjnwe9QIDAQAB',
        id: 'jfmhfclplhdedolodknnpdpjedaojkgj' },
  ]
}

const stageFiles = (locale, version, outputDir) => {
  // Copy resources and manifest file to outputDir.
  // Copy resource files
  const resourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources', locale, '/')
  console.log('copy dir:', resourceDir, ' to:', outputDir)
  fs.copySync(resourceDir, outputDir)

  // Fix up the manifest version
  const originalManifest = getOriginalManifest(locale)
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

const generateManifestFile = (componentData) => {
  const manifestFile = getOriginalManifest(componentData.locale)
  const manifestContent = {
    description: 'Brave NTP sponsored images component',
    key: componentData.key,
    manifest_version: 2,
    name: 'Brave NTP sponsored images',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const generateManifestFiles = () => {
  getComponentDataList().forEach(generateManifestFile)
}

const getManifestsDir = () => {
  const targetResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'manifiest-files')
  mkdirp.sync(targetResourceDir)
  return targetResourceDir
}

const getOriginalManifest = (locale) => {
  return path.join(getManifestsDir(), `${locale}-manifest.json`)
}

const generateCRXFile = (binary, endpoint, region, keyDir, componentData) => {
  const originalManifest = getOriginalManifest(componentData.locale)
  const locale = componentData.locale
  const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images')
  const stagingDir = path.join(rootBuildDir, 'staging', locale)
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentData.id).then((version) => {
    const crxFile = path.join(crxOutputDir, `ntp-sponsored-images-${locale}.crx`)
    const privateKeyFile = path.join(keyDir, `ntp-sponsored-images-${locale}.pem`)
    stageFiles(locale, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
  .parse(process.argv)

let keyDir = ''
if (fs.existsSync(commander.keysDirectory)) {
  keyDir = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key directory')
}

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  generateManifestFiles()
  getComponentDataList().forEach(generateCRXFile.bind(null, commander.binary, commander.endpoint, commander.region, keyDir))
})
