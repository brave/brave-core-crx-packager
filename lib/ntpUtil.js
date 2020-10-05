/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const util = require('../lib/util')
const request = require('request')

const jsonSchemaVersion = 1

const createPhotoJsonFile = (path, body) => {
  fs.writeFileSync(path, body)
}

const getImageFileNameListFrom = (photoJsonObj) => {
  let fileList = []
  if (photoJsonObj.logo)
    fileList.push(photoJsonObj.logo.imageUrl)

  if (photoJsonObj.wallpapers) {
    photoJsonObj.wallpapers.forEach((wallpaper) => {
      fileList.push(wallpaper.imageUrl)
      // V2 feature - support per-wallpaper logo
      if (wallpaper.logo && wallpaper.logo.imageUrl) {
        fileList.push(wallpaper.logo.imageUrl)
      }
    })
  }

  if (photoJsonObj.topSites) {
    photoJsonObj.topSites.forEach((topSiteObj) => {
      fileList.push(topSiteObj.iconUrl)
    })
  }
  return fileList
}

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

const isValidSchemaVersion = (version) => {
  return version === jsonSchemaVersion;
}

const prepareAssets = (jsonFileUrl, targetResourceDir, targetJsonFileName) => {
  return new Promise(function (resolve, reject) {
    let jsonFileBody = '{}'

    // Download and parse jsonFileUrl.
    // If it doesn't exist, create with empty object.
    request(jsonFileUrl, async function (error, response, body) {
      if (error) {
        console.error(`Error from ${jsonFileUrl}:`, error)
        return reject(error)
      }
      if (response && response.statusCode === 200) {
        jsonFileBody = body
      }
      let photoData = {}
      try {
        photoData = JSON.parse(jsonFileBody)
      } catch (err) {
        console.error(`Invalid json file ${jsonFileUrl}`)
        return reject(error)
      }
      // Make sure the data has a schema version so that clients can opt to parse or not
      const incomingSchemaVersion = photoData.schemaVersion
      if (!incomingSchemaVersion) {
        // Source has no schema version, assume and set current version.
        // TODO(petemill): Don't allow this once the source is established to always
        // have a schema version.
        incomingSchemaVersion = jsonSchemaVersion
      } else if (!isValidSchemaVersion(incomingSchemaVersion)) {
        console.error(`Error: Cannot parse JSON data at ${jsonFileUrl} since it has a schema version of ${incomingSchemaVersion} but we expected ${jsonSchemaVersion}! This region will not be updated.`)
        return reject(error)
      }

      createPhotoJsonFile(path.join(targetResourceDir, 'photo.json'), JSON.stringify(photoData))

      // Download image files that specified in jsonFileUrl
      const imageFileNameList = getImageFileNameListFrom(photoData)
      const downloadOps = imageFileNameList.map((imageFileName) => new Promise(resolve => {
        const targetImageFilePath = path.join(targetResourceDir, imageFileName)
        const targetImageFileUrl = new URL(imageFileName, jsonFileUrl).href
        request(targetImageFileUrl)
          .pipe(fs.createWriteStream(targetImageFilePath))
          .on('finish', () => {
            console.log(targetImageFileUrl)
            resolve()
          })
      }))
      await Promise.all(downloadOps)
      resolve()
    })
  })
}

module.exports = {
  generatePublicKeyAndID,
  prepareAssets
}
