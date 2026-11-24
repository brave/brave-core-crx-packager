/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import util from '../lib/util.js'

const getPackagingArgs = (additionalParams) => {
  util.installErrorHandlers()

  let setup = commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-f, --key-file <file>', 'private key file for signing crx')
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely')
    .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
    .option('-p, --publisher-proof-key <file>', 'Private key for generating publisher proof')
    .option('-a, --publisher-proof-key-alt <file>', 'Second private key for generating publisher proof. Useful when rotating keys.')
    .option('-vc, --verified-contents-key <file>', 'Private key for generating verified_contents.json.')

    // If setup locally, use  --endpoint http://localhost:8000
    .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')
    .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')

  if (additionalParams !== undefined) {
    for (const param of additionalParams) {
      setup = setup.option(...param)
    }
  }

  return setup.parse(process.argv)
}

const getPrivateKeyFile = async (packagingArgs, componentDescriptor) => {
  if (packagingArgs.keyFile !== undefined && (await fs.lstat(packagingArgs.keyFile)).isFile()) {
    return packagingArgs.keyFile
  }

  if (packagingArgs.keysDirectory !== undefined && (await fs.lstat(packagingArgs.keysDirectory)).isDirectory()) {
    if (componentDescriptor.privateKeyFromDir === undefined) {
      throw new Error('This component does not support --keys-directory, use --key-file instead')
    }
    return componentDescriptor.privateKeyFromDir(packagingArgs.keysDirectory)
  }

  if (packagingArgs.localRun === true) {
    return ''
  }

  throw new Error('Missing or invalid private key file/directory')
}

const packageComponent = async (packagingArgs, componentDescriptor) => {
  // Resolve the private key first so a missing or invalid key fails fast,
  // before any connection is attempted.
  const privateKeyFile = await getPrivateKeyFile(packagingArgs, componentDescriptor)

  if (packagingArgs.localRun !== true) {
    await util.createTableIfNotExists(packagingArgs.endpoint, packagingArgs.region)
  }

  await util.prepareNextVersionCRX({
    binary: packagingArgs.binary,
    publisherProofKey: packagingArgs.publisherProofKey,
    publisherProofKeyAlt: packagingArgs.publisherProofKeyAlt,
    verifiedContentsKey: packagingArgs.verifiedContentsKey,
    endpoint: packagingArgs.endpoint,
    region: packagingArgs.region,
    componentDescriptor,
    privateKeyFile,
    localRun: packagingArgs.localRun === true
  })
}

export { getPackagingArgs, packageComponent }
