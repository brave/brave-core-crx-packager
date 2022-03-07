/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
// npm run package-ipfs-daemon -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/key/dir

const commander = require('commander')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')
const ipfsVersion = '0.12.0'

const getIpfsDaemonPath = (os, arch) => {
  const ipfsPath = path.join('build', 'ipfs-daemon-updater', 'downloads')
  const myplatform = os === 'win32' ? 'windows' : os
  const ipfsFilename = `go-ipfs_v${ipfsVersion}_${myplatform}-${arch}`
  return path.join(ipfsPath, ipfsFilename)
}

const getOriginalManifest = (platform) => {
  return path.join('manifests', 'ipfs-daemon-updater', `ipfs-daemon-updater-${platform}-manifest.json`)
}

const packageIpfsDaemon = (binary, endpoint, region, os, arch, key) => {
  const platform = `${os}-${arch}`
  const originalManifest = getOriginalManifest(platform)
  const parsedManifest = util.parseManifest(originalManifest)
  const id = util.getIDFromBase64PublicKey(parsedManifest.key)

  util.getNextVersion(endpoint, region, id).then((version) => {
    const stagingDir = path.join('build', 'ipfs-daemon-updater', platform)
    const ipfsDaemon = getIpfsDaemonPath(os, arch)
    const crxOutputDir = path.join('build', 'ipfs-daemon-updater')
    const crxFile = path.join(crxOutputDir, `ipfs-daemon-updater-${platform}.crx`)
    const privateKeyFile = !fs.lstatSync(key).isDirectory() ? key : path.join(key, `ipfs-daemon-updater-${platform}.pem`)
    stageFiles(platform, ipfsDaemon, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

const stageFiles = (platform, ipfsDaemon, version, outputDir) => {
  const originalManifest = getOriginalManifest(platform)
  const outputManifest = path.join(outputDir, 'manifest.json')
  const outputIpfsClient = path.join(outputDir, path.parse(ipfsDaemon).base)

  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }

  mkdirp.sync(outputDir)

  fs.copyFileSync(originalManifest, outputManifest)
  fs.copyFileSync(ipfsDaemon, outputIpfsClient)

  replace.sync(replaceOptions)
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-p, --publisher-proof-key <file>', 'Not used now, for backward compatibility')
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files', 'abc')
  .option('-f, --key-file <file>', 'private key file for signing crx', 'key.pem')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
  .parse(process.argv)

let keyParam = ''

if (fs.existsSync(commander.keyFile)) {
  keyParam = commander.keyFile
} else if (fs.existsSync(commander.keysDirectory)) {
  keyParam = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  packageIpfsDaemon(commander.binary, commander.endpoint, commander.region, 'darwin', 'amd64', keyParam)
  packageIpfsDaemon(commander.binary, commander.endpoint, commander.region, 'linux', 'amd64', keyParam)
  packageIpfsDaemon(commander.binary, commander.endpoint, commander.region, 'win32', 'amd64', keyParam)
  packageIpfsDaemon(commander.binary, commander.endpoint, commander.region, 'darwin', 'arm64', keyParam)
})
