/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import childProcess from 'child_process'
import fs from 'fs'
import path from 'path'
import util from '../lib/util.js'
import { pipeline } from 'stream/promises'

const generatePublicKeyAndID = (privateKeyFile) => {
  childProcess.execSync(`openssl rsa -in ${privateKeyFile} -pubout -out public.pub`)
  try {
    // read contents of the file
    const data = fs.readFileSync('public.pub', 'UTF-8')

    // split the contents by new line
    const lines = data.split(/\r?\n/)
    let pubKeyString = ''
    lines.forEach((line) => {
      if (!line.includes('-----')) {
        pubKeyString += line
      }
    })
    console.log(`publicKey: ${pubKeyString}`)
    const id = util.getIDFromBase64PublicKey(pubKeyString)
    console.log(`componentID: ${id}`)
    return [pubKeyString, id]
  } catch (err) {
    console.error(err)
  }
}

const downloadFile = async (sourceUrl, dest) => {
  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error(`download of ${sourceUrl} failed with code ${response.status}`)
  }

  if (!response.body) {
    throw new Error(`download of ${sourceUrl} failed with empty body`)
  }

  // ensure target directory exists
  const targetDirectory = path.dirname(dest)
  fs.mkdirSync(targetDirectory, { recursive: true })

  // and download
  const file = fs.createWriteStream(dest)
  await pipeline(response.body, file)
}

const validateTargetPath = (rootPath, targetPath) => {
  const resolvedRoot = path.resolve(rootPath)
  const resolvedTarget = path.resolve(targetPath)

  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error(`path ${targetPath} traverses outside of root ${rootPath}`)
  }
}

const prepareAssets = async (jsonFileUrl, targetResourceDir) => {
  const response = await fetch(jsonFileUrl)

  if (!response.ok) {
    throw new Error(`download of ${jsonFileUrl} failed with code ${response.status}`)
  }

  console.log(` Reading ${jsonFileUrl}`)

  // example file format:
  // https://github.com/brave/ntp-si-assets/blob/966021c07cf1dcb58128c0b0487b8bd974f4eda8/resources/test-data/examples/assets.json
  const json = await response.json()

  const allDownloads = json.assets.map(async asset => {
    const targetAssetFilePath = path.join(targetResourceDir, asset.path)
    const targetAssetFileUrl = new URL(asset.path, jsonFileUrl).href

    validateTargetPath(targetResourceDir, targetAssetFilePath)
    await downloadFile(targetAssetFileUrl, targetAssetFilePath)

    const hash = util.generateSHA256HashOfFile(targetAssetFilePath)
    if (hash !== asset.sha256) {
      throw new Error(`${targetAssetFileUrl}: hash does not match, expected ${asset.sha256} got ${hash}`)
    }

    console.log(' ' + targetAssetFileUrl)
  })

  await Promise.all(allDownloads)
}

export default {
  generatePublicKeyAndID,
  prepareAssets,
  validateTargetPath
}
