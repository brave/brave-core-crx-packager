/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import path from 'path'
import { mkdirp } from 'mkdirp'
import fs from 'fs-extra'
import commander from 'commander'
import util from '../lib/util.js'
import { Readable } from 'stream'
import { finished } from 'stream/promises'

const jsonSchemaVersion = 1

const createPhotoJsonFile = (path, body) => {
  fs.writeFileSync(path, body)
}

const getImageFileNameListFrom = (photoJsonObj) => {
  const fileList = []
  if (photoJsonObj.images) {
    photoJsonObj.images.forEach((wallpaper) => {
      fileList.push(wallpaper.source)
    })
  }
  return fileList
}

const isValidSchemaVersion = (version) => {
  return version === jsonSchemaVersion
}

const validatePhotoData = (photoJsonObj) => {
  // Make sure the data has a schema version so that clients can opt to parse or not
  if (!isValidSchemaVersion(photoJsonObj.schemaVersion)) {
    console.log(`Invalid schema version ${photoJsonObj.schemaVersion}`)
    return false
  }

  let isValid = true
  if (photoJsonObj.images) {
    photoJsonObj.images.forEach((image) => {
      if (
        !image.name ||
        !image.source ||
        !image.author ||
        !image.link ||
        !image.originalUrl ||
        !image.license
      ) {
        console.log("Doesn't have sufficient properties")
        console.log(image)
        isValid = false
      }
    })
  }
  return isValid
}

async function prepareAssets(jsonFileUrl, targetResourceDir) {
  // Download and parse jsonFileUrl.
  const response = await util.s3capableFetch(jsonFileUrl)
  const body = await response.text()
  let photoData = {}
  try {
    console.log(`Start - json file ${jsonFileUrl} parsing`)
    photoData = JSON.parse(body)
  } catch (err) {
    throw new Error(`Invalid json file ${jsonFileUrl}`, { cause: err })
  }
  console.log(`Done - json file ${jsonFileUrl} parsing`)

  console.log(`Start - json file ${jsonFileUrl} validation`)
  if (!validatePhotoData(photoData)) {
    throw new Error(`Failed to validate json file ${jsonFileUrl}`)
  }
  console.log(`Done - json file ${jsonFileUrl} validation`)

  createPhotoJsonFile(
    path.join(targetResourceDir, 'photo.json'),
    JSON.stringify(photoData)
  )

  // Download image files that specified in jsonFileUrl
  const imageFileNameList = getImageFileNameListFrom(photoData)
  const imageErrors = []
  const downloadOps = imageFileNameList.map(async (imageFileName) => {
    const targetImageFilePath = path.join(targetResourceDir, imageFileName)
    const targetImageFileUrl = new URL(imageFileName, jsonFileUrl).href
    const response = await util.s3capableFetch(targetImageFileUrl)
    const ws = fs.createWriteStream(targetImageFilePath)
    await finished(Readable.fromWeb(response.body).pipe(ws))
    console.log(`Downloaded ${targetImageFileUrl}`)
  })
  await Promise.all(downloadOps)
  if (imageErrors.length) {
    imageErrors.forEach((e) => console.error(e))
    throw new Error('There were some image download errors. Aborting!')
  }
}

async function generateNTPBackgroundImages(dataUrl) {
  const targetResourceDir = path.join(
    path.resolve(),
    'build',
    'ntp-background-images',
    'resources'
  )
  mkdirp.sync(targetResourceDir)

  console.log(`Downloading background images from ${dataUrl}...`)
  const sourceJsonFileUrl = `${dataUrl}/photo.json`
  await prepareAssets(sourceJsonFileUrl, targetResourceDir)
}

util.installErrorHandlers()

commander
  .option(
    '-d, --data-url <url>',
    'https: or s3: url that refers to data that has ntp background images'
  )
  .parse(process.argv)

generateNTPBackgroundImages(commander.dataUrl).catch((e) => {
  console.error('There was a fatal problem:', e.message)
  if (e.cause) {
    console.error(e.cause)
  }
  process.exit(1)
})
