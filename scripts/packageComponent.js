/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs/promises'
import util from '../lib/util.js'

const getPackagingArgs = (additionalParams) => {
  util.installErrorHandlers()

  let setup = commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
    .option('-f, --key-file <file>', 'private key file for signing crx')
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely')
    .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
    .option('-p, --publisher-proof-key <file>', 'File containing private key for generating publisher proof')
    .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')
    .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')

  if (additionalParams !== undefined) {
    for (const param of additionalParams) {
      setup = setup.option(...param)
    }
  }

  return setup.parse(process.argv)
}

const packageComponent = async (packagingArgs, componentClass) => {
  let privateKeyFile = ''

  if (packagingArgs.keyFile !== undefined && (await fs.lstat(packagingArgs.keyFile)).isFile()) {
    privateKeyFile = packagingArgs.keyFile
  } else if (packagingArgs.keysDirectory !== undefined && (await fs.lstat(packagingArgs.keysDirectory)).isDirectory()) {
    privateKeyFile = componentClass.privateKeyFromDir(packagingArgs.keysDirectory)
  } else if (packagingArgs.localRun !== true) {
    throw new Error('Missing or invalid private key file/directory')
  }

  if (packagingArgs.localRun !== true) {
    await util.createTableIfNotExists(packagingArgs.endpoint, packagingArgs.region)
  }

  await util.prepareNextVersionCRX(
    packagingArgs.binary,
    packagingArgs.publisherProofKey,
    packagingArgs.endpoint,
    packagingArgs.region,
    componentClass,
    privateKeyFile,
    packagingArgs.localRun)
}

export {
  getPackagingArgs,
  packageComponent
}
