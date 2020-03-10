/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs-extra')
const request = require('request')
const commander = require('commander')

const jsonFileName = 'data.json'
const jsonSchemaVersion = 1

const createDataJsonFile = (path, body) => {
  fs.writeFileSync(path, body)
}

const getImageFileNameListFrom = (dataJsonObj) => {
  let fileList = []
  if (dataJsonObj.logo)
    fileList.push(dataJsonObj.logo.imageUrl)

  if (dataJsonObj.wallpapers) {
    dataJsonObj.wallpapers.forEach((wallpaper) => {
      fileList.push(wallpaper.imageUrl)
    })
  }
  if (dataJsonObj.topSites) {
    dataJsonObj.topSites.forEach((topSiteObj) => {
      fileList.push(topSiteObj.iconUrl)
    })
  }
  return fileList
}

function downloadForRegion (jsonFileUrl, targetResourceDir) {
  return new Promise(function (resolve, reject) {
    const jsonFilePath = path.join(targetResourceDir, jsonFileName)
    let jsonFileBody = '{}'

    // Download and parse data.json.
    // If it doesn't exist, create with empty object.
    request(jsonFileUrl, async function (error, response, body) {
      if (error) {
        console.error(`Error from ${jsonFileUrl}:`, error)
        return reject(error)
      }
      if (response && response.statusCode === 200) {
        jsonFileBody = body
      }

      const data = JSON.parse(jsonFileBody)
      // Make sure the data has a schema version so that clients can opt to parse or not
      const incomingSchemaVersion = data.schemaVersion
      if (!incomingSchemaVersion) {
        // Source has no schema version, assume and set current version.
        // TODO(petemill): Don't allow this once the source is established to always
        // have a schema version.
        data.schemaVersion = jsonSchemaVersion
      } else if (incomingSchemaVersion !== jsonSchemaVersion) {
        // We don't support this file format
        console.error(`Error: Cannot parse JSON data at ${jsonFileUrl} since it has a schema version of ${incomingSchemaVersion} but we expected ${jsonSchemaVersion}! This region will not be updated.`)
        return reject(error)
      }

      createDataJsonFile(jsonFilePath, JSON.stringify(data))

      // Download image files that specified in data.json
      const imageFileNameList = getImageFileNameListFrom(data)
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

async function generateNTPSuperReferrer (dataUrl, referrerName) {
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-super-referrer', 'resources')
  mkdirp.sync(rootResourceDir)

  console.log(`Downloading for ${referrerName}...`)
  const targetResourceDir = path.join(rootResourceDir, referrerName)
  mkdirp.sync(targetResourceDir)
  const jsonFileUrl = `${dataUrl}superreferrer/${referrerName}/${jsonFileName}`
  await downloadForRegion(jsonFileUrl, targetResourceDir)
}

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp super referrer')
  .option('-n, --super-referrer-name <name>', 'super referrer name for this component')
  .parse(process.argv)

generateNTPSuperReferrer(commander.dataUrl, commander.superReferrerName)
