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
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7L65ymlZt+jRoLsulYP60EtHUcVL+BNs9qdJMDP+UvPlN/eHrjaaRy5uJgQCyTVP1cS20GCTD/d4YhNtMSoNiMfaIInaHzxx4nRu2ipfrpzrypV7LmmDCajrlsIwhiRvDevn8057/k4+J9TuDR3JuRTcCXxNv+LNHCYNcE2DKQDACv1c4CQ6sqasmkhle49UBrhKLiu/mSKmLBAJ45mRNwpKXtFMzNZB2US0BynoHco1rJIVrtx3Y2K2JBW1DqDohrb76J6+2KzcR7Zx55Haca7MhGZ9Mf9+tf5rzjdjIewF79PbX8xNMb0xmw05fekAjJjeLrJygL7BKQNN4BashQIDAQAB',
      id: 'cdjnpippjnphaeahihhpafnneefcnnfh' },
    { locale: 'iso_3166_1_jp',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArBgclTrukKlWqH47I5tP+i/agOow6Kb6UW0pW9FjrfQ26kFiTfYaTFPEBGcM2Qh8pu5fPWI1R2lF1elmF+JKZMdx5286SMuOpfKL8gekfYolt/wDRPNJgPdEleZwGXL3FJVwb5yYee2hFsDlXgDBuR24HwGsZ/bZolnLkMMtonsBzD8IDNyGBEsBOjIRePrShaCFiqLJqcFhTQtLAOCWqmU1Cmf5PxIiBSD3egFQXSdnuDwtORMXqcx9WOQeddtaQKTskHHZyPAbQZhV6h7GFjxMz7EZxrkPBiDiB4p7AcHwI6ZrjvJFzB5AvO7E0SMr6PUJ0DW9G6N21sX0vcBnMwIDAQAB',
      id: 'ienmdlgalnmefnpjggommgdilkklopof' },
    { locale: 'iso_3166_1_us',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA09bImTdimqDHKRK9SGQrxfLxwCVC/fNbPskVhhdyqLV7KsNA4isJaInByxgAllOc0xAXgeSTUx8iq7+33mwj3tZUYxaL3e57NjTQ4Ymm38UIjAD+yS+Wh5icdOW4EtMN41EMEJTrQup9WsKU+SxzL/+A/jcYdrkRMZKHixKHrQxnZ5QUrPitV54/YD+kcYNmGVFpQcHn8fJbvNSLchaFi7D+3KQSWwIS/psPG/Ni3Xi2PcSPRTMN9O09lNyyjA+twFqNhSd13IHlDTVEWE4a0MIR3/4MNQHLMLhchoDokc0Hy+ysSy0ipDCh0iTwLt4FhsMS9e2vIXG9IpzNqE4EbQIDAQAB',
      id: 'kkjipiepeooghlclkedllogndmohhnhi' },
    { locale: 'iso_639_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw6fYL/onqsR2Eqr2lif68RY8/KSB9e0r6rOXlo6qclUckngboamWnQGZnW8LNrN7fyVjUnsK0OCLzRkOEyEm3hOnmUlROYgk2NvSIzrAhq5PA8M2xc9siU00myQ+IOhbVcNDSOxpbrX9w3e6rA9MwrytywGtL58nDWyOcFgMwfkzQHfxVxeu/rkQODkNEgXZl2t9Jd+1eHCSfleuJeNVfb9OaZ1rjVWwETHwk+Y3w2LHcS2JtFXcA7O9QI/w+s4uYGMogZKwrZG7sYZtAftOOERPrSFJDux/MNjVtm8Rpk0ZWFRIUmVWf6PnFbX6UjtJY2qAN0Nsq27TNvVKCpdz5wIDAQAB',
      id: 'eclclcmhpefndfimkgjknaenojpdffjp' },
      { locale: 'iso_639_1_en',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvgtusqSONTB+vdbby05Kt/CRVLD+90WzphIfnG5UVYTfibXJJ9zlR+bvh86fBq0S5jbhC1e46ooDqBxPzYs8xgkbNfnvdccG26SZM+q40n7qr5Pg6y/4RXAhy0KWfLCmANPR2vjTYMfTHIhRE0mNKIhBsXldNakpzEKf/70jGOT9wh1lwXEkDN8yuQy4YbY+HGRsPowG1G1Y6fN7bR/X24vtiuFN4W2YHjNmFCLeu9o/2Qi1Wtc9+ORCQwLPIWGhSTHd/XUeZt5AfIWBKCOy8VlAYbfmw6STYVznoDsHCSXn0kj5cErGzx6V7oC1uNyXNSf2eQyLSohks+TQ1yvz8QIDAQAB',
      id: 'emgmepnebbddgnkhfmhdhmjifkglkamo' },
    { locale: 'iso_639_1_fr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx1/9cmzkLNdnqefKfXfJseIA6Js0e1PC2pkCnkXbMIRBCtvvq86LhUDvERrJZ4UD/zd2YNoRUu9nqMTNpj6IZKfXwKtNwMo5yY1B2KmdOQo4MgIIf+uLVOTc18ylq0WrmLvcKW2cSvD9jR1nY1IR7eZ8n7MAriMJufckAKMpvI72/ylTYUAT5mg+o9JOghx7mixa2OGn1LC3tPlF6kqdBD06z8XBO+mpF5xlLk9CiCYiTdF1V+GiVniDX8XoJ5+nFWJolw0GVEjckFSlZiYCazUox3M2BlURLxxSjZBm77GjdMVosV5+0n0tPJ/Fjb+NnPmslcjo944DmGgzLQ1nQQIDAQAB',
      id: 'hbejpnagkgeeohiojniljejpdpojmfdp' },
    { locale: 'iso_639_1_ja',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvJFbfap/j/4+DJ4FFY2zZHbm14SxpZIyoRwtCSoNKh9HsO9mt+9blnntHmaLDhZ7ITCCux8xy8pQZ/7ztsfm+DplzpDBIasS2T1FsE8VXBE/vL2xzlvo+FTXmgHg+3H6GW/0r7bzGuYml9fZv1aHBGTeajBH7LebLMYV6qlSL3K/iuiHEh+Qq95dqUKcrY28CPPriUzpyLWpQQKV0M3Z5++o04rf0jbOswHN8LSSG3HYB1BzxhPhaEco1Pn3fuxNVM69GXr5huQm8fWxViQHFcWWCd/emRC7MAPHBLuUy5i1QvIjfzfa2DZqwl03hw6m/NzzGIGMYXU3SniystOC4QIDAQAB',
      id: 'ncnmgkcadooabjhgjlkkdipdnfokpjnm' },
    { locale: 'iso_639_1_pt',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtZsD7mfrycGNo2orydis1b/tBCCuPzZdW5TjIgsridYH+hi9C4YkYgvfQ3WNFZHUnvQEsYhOSKr7hhDfGJB8kuZrPMnLnAX6ADjvPQSPPwYhbyBgpkmkVRi649oupVfuqEgJxFAJST7H/vLEMJA+gDHjxxyh+7J/EQbMNho+MgG+aGcQDvCDmax+g3+MXh97r0B/1mrOyskF4zP0q+zclcJVOsefgRGr+h0DbTHtMLWrrvbBO3rsM+7TaX5QTyYm5XgWI7Zt4VoiAzdS3YQCpQf5Simj1yFVFC0TfI8+LXuElBT72bADfRfLh/pVmcx1h2Uv7uK/9eYTVxmbmKxRcQIDAQAB',
      id: 'ikpplkdenofcphgejneekjmhepajgopf' },
    { locale: 'iso_639_1_es',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAonX2Nny33Q7yAmw8OIuaofnbejVaueiBA+lOqTCaMtxB4JcKa5G/FIzs7OQJiIkY7OiPAT7GvaitJP3IUAJNMRZ3O00ZvG7Gg7hkzrQLRk6920d2U/muw0DiY122JUdzadawm67C5WPznzNgOUxSmejkKcvv7Sj9AXf0wbjAd0BSfdPJKOsbtI4A9HAy9Hi88vMTvni/dic3VHnwo6tttz84yUgWEyweT3YKjrdsokJwmJZTV3Bi+o0ZeNOQigPBg0KFwxUCUWA82ZIJ4C/FyE8oZQ0gGE1LPnFw5pXVWfxlGqxGYr5hiPUZFDBIlpTye2utwrjsY3erjJ3zy93HUwIDAQAB',
      id: 'ahiocclicnhmiobhocikfdamfccbehhn' }
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
   .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
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
