/* Copyright (c) 2025 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

import fs from 'fs'
import unzip from 'unzip-crx-3'
import path from 'path'
import commander from 'commander'
import glob from 'glob'
import util from '../lib/util.js'
import crx from '../lib/crx.js'

const downloadExtension = async (config) => {
  const buildPath = path.join('build', config.name)
  const download = path.join(buildPath, 'download')
  const unpacked = path.join(buildPath, 'unpacked')

  fs.mkdirSync(download, { recursive: true })
  fs.mkdirSync(unpacked, { recursive: true })

  let downloadUrl = config.url
  if (config.url_version_template) {
    // Firstly obtain the version
    const latest = await fetch(downloadUrl)
    const version = latest.url.split('/').pop()
    downloadUrl = config.url_version_template.replaceAll('{version}', version)
  }

  const response = await fetch(downloadUrl)
  const data = Buffer.from(await response.arrayBuffer())
  const sources = path.join(download, 'sources.zip')
  fs.writeFileSync(sources, Buffer.from(data))

  await unzip(sources, unpacked)

  const findRoot = (root, file) => {
    const manifestFile = glob.sync('**/manifest.json', {
      cwd: root,
      absolute: true,
      nodir: true
    })
    if (!manifestFile) {
      throw new Error(`${config.name} can not find manifest`)
    }

    const manifest = util.parseManifest(manifestFile[0])
    if (!manifest || manifest.manifest_version !== 2) {
      throw new Error(`${config.name} manifest is invalid`)
    }

    return path.dirname(manifestFile[0])
  }

  return findRoot(unpacked)
}

const getExtensionConfig = (extensionName) => {
  return path.join('manifests', extensionName, 'config.json')
}

const packageV2Extension = (
  extensionName,
  endpoint,
  region,
  keysDir,
  verifiedContentsKey,
  localRun
) => {
  const config = util.parseManifest(getExtensionConfig(extensionName))
  const id = util.getIDFromBase64PublicKey(config.key)
  const extensionCrxFile = path.join('build', 'extensions-v2', `${id}.crx`)
  const extensionZipFile = path.join('build', 'extensions-v2', `${id}.zip`)

  const writeOutputFiles = (extension) => {
    fs.mkdirSync(path.join('build', 'extensions-v2'), { recursive: true })
    fs.writeFileSync(extensionCrxFile, extension.crx)
    fs.writeFileSync(extensionZipFile, extension.zip)
  }

  const processExtension = async () => {
    const stagingDir = await downloadExtension(config)
    const extensionKeyFile = path.join(keysDir, `${extensionName}-key.pem`)

    crx
      .generateCrx(stagingDir, extensionKeyFile, [], verifiedContentsKey)
      .then((extension) => {
        if (id !== util.getIDFromBase64PublicKey(extension.manifest.key)) {
          throw new Error(`${extensionName} invalid extension key used.`)
        }

        if (!localRun) {
          util
            .getNextVersion(
              endpoint,
              region,
              id,
              util.generateSHA256Hash(extension.crx)
            )
            .then((version) => {
              if (version !== undefined) {
                writeOutputFiles(extension)
              } else {
                console.log(`${config.name} extension: no updates detected!`)
              }
            })
        } else {
          writeOutputFiles(extension)
        }
      })
  }

  processExtension()
}

util.installErrorHandlers()

util
  .addCommonScriptOptions(
    commander
      .option(
        '-d, --keys-directory <dir>',
        'directory containing private keys for signing crx files'
      )
      .option(
        '-l, --local-run',
        'Runs updater job without connecting anywhere remotely'
      )
  )
  .parse(process.argv)

let keysDir = ''
if (fs.existsSync(commander.keysDirectory)) {
  keysDir = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

const ExtensionsV2 = ['no-script-v2', 'adguard-v2', 'umatrix-v2', 'ublock-v2']

if (!commander.localRun) {
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    ExtensionsV2.forEach((extensionName) => {
      packageV2Extension(
        extensionName,
        commander.endpoint,
        commander.region,
        keysDir,
        commander.verifiedContentsKey
      )
    })
  })
} else {
  ExtensionsV2.forEach((extensionName) => {
    packageV2Extension(
      extensionName,
      commander.endpoint,
      commander.region,
      keysDir,
      commander.verifiedContentsKey,
      commander.localRun
    )
  })
}
