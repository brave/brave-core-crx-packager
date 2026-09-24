/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-web-mcp -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/web-mcp.pem

import commander from 'commander'
import fs from 'fs-extra'
import { mkdirp } from 'mkdirp'
import path from 'path'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'
import { pathToFileURL } from 'url'

// Resource directory assembled by scripts/dataFilesWebMcp.js (contains scripts/).
const webMcpResourceDir = path.join(path.resolve(), 'web-mcp')

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'manifests', 'web-mcp', 'default-manifest.json')
}

const stageFiles = util.stageDir.bind(
  undefined,
  webMcpResourceDir,
  getOriginalManifest())

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey, publisherProofKeyAlt) => {
  const stagingDir = path.join('build', 'web-mcp')
  const crxFile = path.join(stagingDir, 'web-mcp.crx')
  mkdirp.sync(stagingDir)
  return util.getNextVersion(endpoint, region, componentID).then((version) => {
    stageFiles(version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      publisherProofKeyAlt, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

export async function main (argv = process.argv) {
  util.installErrorHandlers()

  const command = util.addCommonScriptOptions(
    commander
      .option('-k, --key-file <file>', 'file containing private key for signing crx file'))
  command.parse(argv)

  let privateKeyFile = ''
  if (command.keyFile && fs.existsSync(command.keyFile)) {
    privateKeyFile = command.keyFile
  } else {
    throw new Error('Missing or invalid private key')
  }

  await util.createTableIfNotExists(command.endpoint, command.region).then(() => {
    const [, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
    return generateCRXFile(command.binary, command.endpoint, command.region,
      componentID, privateKeyFile, command.publisherProofKey, command.publisherProofKeyAlt)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
