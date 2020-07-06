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
    { locale: 'iso_3166_1_gb',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwUhHj3i7l7P0ayp7bJr9wIIvBBpMbr+wDMNq/0yfmigMxybgEAPELFjjtsMFcZ1uUWRiZvigXI2fXEQEax9DHBNDGS8lRcd8ujOmH01Y+Ar1iJD8D4oMnl0wpVh5/z9X+oj9U0xmZnghB24Eozx+AELHYaY/CT7a+FJJzQA9HMtX8v5aX6RmAndcjdaIdIjZCt8EX/60IK7sT3UCqlDeaFFS+CyUEMFciyHpz0GpD/usPvyep9Go+Jhw1iNa/Axv/Bp+h+xQ+Nh6cGbyqw6QXFa756I4YVsX9vnT3IF5CMqoAz9Z8Xrkf5s6C81LD82iagf6gkYVx44EZ4CoXD+KhwIDAQAB',
      id: 'epgnoopijcjaaedpjbaogchfdcobmhfa' },
    { locale: 'iso_3166_1_us',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIBCgKCAQEA0JUQgqigxzVxeiHUnHRcRwN0KL64GexYC71ftCnypY4QyOSbjU+aYSleJbdo96KG4knmKNcv3vFc11uT0qawunFzx1/xSv8Pd+82mE0LBvVS+uTTQ8Nmf/xIwgyh4xze3I69FGBJudXsbla1Scy6yyzysarsDd/z0kC+An937fFFjqKciaurbMGUyIB7UYg0G3kkJ/QNt04EeGGhqszhl5kKKO1h5bzKXx8/a32Ol437zNxMZrN+XvcrkdFZu/nNxYWrDyxSHq44jGe5/HNW0wnn6RUxyEajIYQqikHZK0dOsUf4ykAqr4epTO3n5zvtECvDh9WGkT1pOX7YHrzbnwIDAQAB',
      id: 'dlafghnakbalimfefbnaplghhdbnookp' },
    { locale: 'iso_639_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuP/PjuScAH+x3XEPZe9J7dYrU5OqAkxyARvwSvKkOK93/L0CKLUMRND26a2Nb3yYXFYWCZUTjosqDcGGtDZd/C3En5Zv4lGu7yEgGvdPmb2Xz6I++C0F855OJq0/Pp+rJhtfsZVjruQkSAQhQRArHTkx//UiGPQ06nVoh6wa12U+k3a4DRmTiAu0NJ+C8hY8cbabezff9kwOvWm1v3jF/4porPU/Wwj4bqhsKo46n3iMUYg/NrhLMKXZizC1EVIzk7ez0bC9FXAViNKsjBFBGXG4IUicmHa4I/5USsKM2dTlNZtt39dQBOUCY5vdWRje5hSfqvQZWhRFAnade9U2FwIDAQAB',
      id: 'fhdmdmkanapebegeijnmleialkfnjnah' },
      { locale: 'iso_639_1_en',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA21EAqCxIIQy9yu0aewD/sPtUKEuLOKUIcEykxH5SFXxbeBjBnrc9J6xnAtEHNfActbFXyjzp4x7GfvgNAxMXIFPYFG344hLXtRiRoohJIkPk/W3tCDjG/TAoWzJ+tVa/KeGeNJFYy2YDvjw2Mi8/Oo0QS39iKiA8368g9+jx8mjbDLa8htS6dNnZpf3+X41H3scCNkIQnzjVNs4xvgc0VCH41QwH7GGP2TowaJ56Ap4qMJ3aNsuSX9Qy1J9JQL/RhOOUebnEA7wl4VZ8bicj3jvJnI8Bec3s5bpFl0WOMr8NrX/O0VYHMco/df/5hv9mkZoFr9mT3upDLBu9hQ7wMwIDAQAB',
      id: 'lllkkaeoemedheggokooogimejbjbohf' },
    { locale: 'iso_639_1_fr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtQkG97MzonzGWICiEZf3Nvf1+AHxhKh9RtE6CrLl8ot7c+p7cLN5seXbIO8Mseg0gry+v2arSjKMUvuuZauM6cOWgv7yHpnM9XMq4unITsjoK3uvLwZKZx82WqqPiebW+xryk32FL7ljJTbkctfkIutsdV9dCFU834anv+s9HMsRSffOAMoxjgu+1uGilEsgilEy0iKyPlt6k0JrxlojcG1cvVi1T3gvfU1kvEgJykKbwX7+LMjjUCGZNpn/rqMojWFOHa/Fl68T8v5eJtXN9+8bEhPBqLB3DDCwnklLF9j6iNputmd1d+lIJw9AvVJ9Vn4k81SkedMoR5M6vqpFmQIDAQAB',
      id: 'gchgedofejfccficedfnkljdpldcocgc' }
  ]
 }
 
 const stageFiles = (locale, version, outputDir) => {
   // Copy resources and manifest file to outputDir.
   // Copy resource files
   const resourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'resources', locale, '/')
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
     description: 'Brave User Model Installer Component',
     key: componentData.key,
     manifest_version: 2,
     name: 'Brave User Model Installer',
     version: '0.0.0'
   }
   fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
 }
 
 const generateManifestFiles = () => {
   getComponentDataList().forEach(generateManifestFile)
 }
 
 const getManifestsDir = () => {
   const targetResourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'manifiest-files')
   mkdirp.sync(targetResourceDir)
   return targetResourceDir
 }
 
 const getOriginalManifest = (locale) => {
   return path.join(getManifestsDir(), `${locale}-manifest.json`)
 }
 
 const generateCRXFile = (binary, endpoint, region, keyDir, componentData) => {
   const originalManifest = getOriginalManifest(componentData.locale)
   const locale = componentData.locale
   const rootBuildDir = path.join(path.resolve(), 'build', 'user-model-installer')
   const stagingDir = path.join(rootBuildDir, 'staging', locale)
   const crxOutputDir = path.join(rootBuildDir, 'output')
   mkdirp.sync(stagingDir)
   mkdirp.sync(crxOutputDir)
   util.getNextVersion(endpoint, region, componentData.id).then((version) => {
     const crxFile = path.join(crxOutputDir, `user-model-installer-${locale}.crx`)
     const privateKeyFile = path.join(keyDir, `user-model-installer-${locale}.pem`)
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
