/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs-extra')
const commander = require('commander')
const util = require('../lib/util')
const request = require('request')

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
      if (!image.name || !image.source || !image.author ||
          !image.link || !image.originalUrl || !image.license) {
        console.log('Doesn\'t have sufficient properties')
        console.log(image)
        isValid = false
      }
    })
  }
  return isValid
}

const prepareAssets = (jsonFileUrl, targetResourceDir) => {
  return new Promise(function (resolve, reject) {
    let body = '{}'

    // Download and parse jsonFileUrl.
    request(jsonFileUrl, async function (error, response, jsonFileBody) {
      if (error) {
        console.error(`Error from ${jsonFileUrl}:`, error)
        return reject(error)
      }

      if (response && response.statusCode !== 200) {
        console.error(`Error from ${jsonFileUrl}:`, response.statusMessage)
        return reject(error)
      }

      if (response && response.statusCode === 200) {
        body = jsonFileBody
      }
      let photoData = {}
      try {
        console.log(`Start - json file ${jsonFileUrl} parsing`)
        photoData = JSON.parse(body)
      } catch (err) {
        console.error(`Invalid json file ${jsonFileUrl}`)
        return reject(error)
      }
      console.log(`Done - json file ${jsonFileUrl} parsing`)

      console.log(`Start - json file ${jsonFileUrl} validation`)
      if (!validatePhotoData(photoData)) {
        console.error(`Failed to validate json file ${jsonFileUrl}`)
        return reject(error)
      }
      console.log(`Done - json file ${jsonFileUrl} validation`)

      createPhotoJsonFile(path.join(targetResourceDir, 'photo.json'), JSON.stringify(photoData))

      // Download image files that specified in jsonFileUrl
      const imageFileNameList = getImageFileNameListFrom(photoData)
      const downloadOps = imageFileNameList.map((imageFileName) => new Promise(resolve => {
        const targetImageFilePath = path.join(targetResourceDir, imageFileName)
        const targetImageFileUrl = new URL(imageFileName, jsonFileUrl).href
        request(targetImageFileUrl)
          .pipe(fs.createWriteStream(targetImageFilePath))
          .on('finish', () => {
            console.log(`Downloaded ${targetImageFileUrl}`)
            resolve()
          })
      }))
      await Promise.all(downloadOps)
      resolve()
    })
  })
}

async function generateNTPBackgroundImages (dataUrl) {
  const targetResourceDir = path.join(path.resolve(), 'build', 'ntp-background-images', 'resources')
  mkdirp.sync(targetResourceDir)

  console.log(`Downloading background iamges from ${dataUrl}...`)
  const sourceJsonFileUrl = `${dataUrl}/photo.json`
  await prepareAssets(sourceJsonFileUrl, targetResourceDir)
}

util.installErrorHandlers()

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp background images')
  .parse(process.argv)

generateNTPBackgroundImages(commander.dataUrl)
