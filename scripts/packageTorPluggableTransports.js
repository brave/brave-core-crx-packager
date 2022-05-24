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
    win32 : '46219bf1cff887d88639c2491be80053a304ea495d81d9ce33b9f5078be41a7b17657a85af303275c7aa761fc805aa48d2cbd330e524df3adb8dbdf764f31634',
    linux: '93cd12ea2bb952ef7beb7e2a7bbd948eb85f5eb9d9970ac4f511e24f44a9a60c975ea195f82354c7f4d6f0c55e948f34ffe8e418dca37872125eeb9c3879e381',
    darwin: '0a980b50489680dc4051b8d32b11c1997229733926237db7f68c3e7d2b00e17cbbedc8fffb38a8aa390cd9e149f0232caa866e533222f6a6a8922072c1a713f5',
  },
  obsf4: {
    win32 : '66ebfdf5df39cf51832dd4025c8b3137a6c090fac3b8e7f9a7ac9564712c5fe7daec43526d0a846b36b859e246e7e737818469621f30b519a642194305c17ce6',
    linux: 'a59de28331358484e9e986d17ee8f85b543a2ca855250a04e123610925e796cc1f606264822aebb12a9f5e97ed3bb086cf3a168e4298d03cbd449f015eeb2323',
    darwin: '77d55c6576c9afcc67c34cef40db40bd82f840d95cd8c11a986536f8aae2388225f9f317cfc2bfa6358cdc657d3b0231a7e25388f66210a35439ad7a47c56645',    
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
    const obsf4 = downloadTorPluggableTransport(platform, 'obsf4')

    const stagingDir = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER, platform)
    const crxOutputDir = path.join('build', TOR_PLUGGABLE_TRANSPORTS_UPDATER)
    const crxFile = path.join(crxOutputDir, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}.crx`)
    const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `${TOR_PLUGGABLE_TRANSPORTS_UPDATER}-${platform}.pem`)
    stageFiles(platform, snowflake, obsf4, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const stageFiles = (platform, snowflake, obsf4, version, outputDir) => {
  const originalManifest = getOriginalManifest(platform)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputSnowflake = path.join(outputDir, path.parse(snowflake).base)
  const outputObsf4 = path.join(outputDir, path.parse(obsf4).base)

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(snowflake, outputSnowflake)
  fs.copyFileSync(obsf4, outputObsf4)

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
