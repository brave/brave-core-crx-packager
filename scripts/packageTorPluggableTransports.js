/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-tor-pluggable-transports -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

const commander = require('commander')
const crypto = require('crypto')
const execSync = require('child_process').execSync
const fs = require('fs')
const mkdirp = require('mkdirp')
const { platform } = require('os')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const TOR_PLUGGABLE_TRANSPORTS_UPDATER = 'tor-pluggable-transports-updater'
const TOR_PLUGGABLE_TRANSPORTS_HASHES = Object.freeze({
  snowflake: {
    win32 : '24da027fbe06ee04954dde5f38657943bd998675ed31115bc00487bf6ea860ebd2bcd5ef73bc4186433a485d4586d9ce3f1d4f9630c056d677e943ee23bc7c7b',
    linux: '3263e161e95021fbdaaff6e91624bb1b1ccdda3ae9db8cb7dc76e50ea81a8bd1e3c2ce5b8d86229792f3b16525233881b7d4dab008d8063e7c5ae53170280070',
    darwin: 'a864e36e25c7c5f6ff74b212732abddc3f0afdf37be0ec02d92e050c312fe0c18e89f7515c6e20859af71d07071891919dc7f995facf7a1763902ca91a5f89bc',
  },
  obfs4: {
    win32 : '98a79e62afe562bc2b389b19710fe08e150ae3611cf93a3940738d04efa6233fa417dfb3e4aaede6322875a66a510e9dcce1fb974b25cb63e307ccbbc0e54f82',
    linux: '1327eccd93ca98c136a8cb7dff0631d3880b5cd69fdce07fbb76a11def2c7ab830cd6ffe9b0d428cd6a8dc2d109eca5c9ac859591264d0f8de3d6231daf5e812',
    darwin: '8e4b11598179199864dbc223aa3e936aed2edfad738d26dc254ab8ccbb1de56085b77aaab9f09ed6824c423b28887cb72c687103781425264595dd2856b6420f',
  }
})

const getTransportUrl = (platform, transport) => {
  if (transport == 'snowflake')
    return `snowflake/client/${platform}/tor-snowflake-brave`
  if (transport == 'obfs4')
    return `obfs4/obfs4proxy/${platform}/tor-obfs4-brave`
}

// Downloads one platform-specific tor pluggable transport executable from s3
const downloadTorPluggableTransport = (platform, transport) => {
  const transportPath = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER, 'dowloads', `${platform}`)
  const transportFilename = `tor-${transport}-brave`
  const sha512 = TOR_PLUGGABLE_TRANSPORTS_HASHES[transport][platform]

  mkdirp.sync(transportPath)

  const transport_file = path.join(transportPath, transportFilename)
  const cmd = 'cp ' + getTransportUrl(platform, transport) + ' ' + transport_file
  // Download the executable
  execSync(cmd)

  // Verify the checksum
  if (!verifyChecksum(transport_file, sha512)) {
    console.error(`Tor ${transport} checksum verification failed on ${platform}`)
    process.exit(1)
  }  

  // Make it executable
  fs.chmodSync(transport_file, 0o755)

  return transport_file
}

const getOriginalManifest = (platform) => {
  return path.join('manifests', TOR_PLUGGABLE_TRANSPORTS_UPDATER, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}-manifest.json`)
}

const packageTorPluggableTransports = (binary, endpoint, region, platform, key, publisherProofKey) => {
  const originalManifest = getOriginalManifest(platform)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  util.getNextVersion(endpoint, region, id).then((version) => {
    const snowflake = downloadTorPluggableTransport(platform, 'snowflake')
    const obfs4 = downloadTorPluggableTransport(platform, 'obfs4')

    const stagingDir = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER, platform)
    const crxOutputDir = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER)
    const crxFile = path.join(crxOutputDir, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}.crx`)
    const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}.pem`)
    stageFiles(platform, snowflake, obfs4, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const stageFiles = (platform, snowflake, obfs4, version, outputDir) => {
  const originalManifest = getOriginalManifest(platform)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputSnowflake = path.join(outputDir, path.parse(snowflake).base)
  const outputObfs4 = path.join(outputDir, path.parse(obfs4).base)

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(snowflake, outputSnowflake)
  fs.copyFileSync(obfs4, outputObfs4)

  replace.sync(replaceOptions)
}

// Does a hash comparison on a file against a given hash
const verifyChecksum = (file, hash) => {
  const filecontent = fs.readFileSync(file)
  const computedHash = crypto.createHash('sha512').update(filecontent).digest('hex')
  console.log(`${file} has hash ${computedHash}`)
  return hash === computedHash
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files', 'abc')
    .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem'))
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  packageTorPluggableTransports(commander.binary, commander.endpoint, commander.region,
                                'darwin', keyParam, commander.publisherProofKey)
  packageTorPluggableTransports(commander.binary, commander.endpoint, commander.region,
                                'linux', keyParam, commander.publisherProofKey)
  packageTorPluggableTransports(commander.binary, commander.endpoint, commander.region,
                                'win32', keyParam, commander.publisherProofKey)
})
