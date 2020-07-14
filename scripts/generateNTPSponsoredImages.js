/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs-extra')
const request = require('request')
const commander = require('commander')
const util = require('../lib/util')

const jsonFileName = 'photo.json'
const jsonSchemaVersion = 1

const getRegionList = () => {
  return [ 'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS',
           'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO',
           'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO',
           'KM', 'CG', 'CD', 'CK', 'CR', 'HR', 'CW', 'CY', 'CZ', 'CI', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG',
           'SV', 'GQ', 'ER', 'EE', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE',
           'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA',
           'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ',
           'KE', 'KI', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MK',
           'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN',
           'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF',
           'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA',
           'RO', 'RU', 'RW', 'RE', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN',
           'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR',
           'SJ', 'SZ', 'SE', 'CH', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM',
           'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF',
           'EH', 'YE', 'ZM', 'ZW' ]
}

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
    })
  }
  return fileList
}

function downloadForRegion (jsonFileUrl, targetResourceDir) {
  return new Promise(function (resolve, reject) {
    const jsonFilePath = path.join(targetResourceDir, jsonFileName)
    let jsonFileBody = '{}'

    // Download and parse photo.json.
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
        photoData.schemaVersion = jsonSchemaVersion
      } else if (incomingSchemaVersion !== jsonSchemaVersion) {
        // We don't support this file format
        console.error(`Error: Cannot parse JSON data at ${jsonFileUrl} since it has a schema version of ${incomingSchemaVersion} but we expected ${jsonSchemaVersion}! This region will not be updated.`)
        return reject(error)
      }

      createPhotoJsonFile(jsonFilePath, JSON.stringify(photoData))

      // Download image files that specified in photo.json
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

function getTargetRegionList(targetRegions, excludedTargetRegions) {
  targetRegionList = []
  if (targetRegions === '')
    targetRegionList = getRegionList()
  else
    targetRegionList = targetRegions.split(',')

  if (excludedTargetRegions === '')
    return targetRegionList

  return targetRegionList.filter(region => !excludedTargetRegions.includes(region))
}

async function generateNTPSponsoredImages (dataUrl, targetRegions, excludedTargetRegions) {
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources')
  mkdirp.sync(rootResourceDir)

  for (const region of getTargetRegionList(targetRegions, excludedTargetRegions)) {
    console.log(`Downloading ${region}...`)
    const targetResourceDir = path.join(rootResourceDir, region)
    mkdirp.sync(targetResourceDir)
    const jsonFileUrl = `${dataUrl}${region}/${jsonFileName}`
    await downloadForRegion(jsonFileUrl, targetResourceDir)
  }
}

util.installErrorHandlers()

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp sponsored images')
  .option('-t, --target-regions <regions>', 'Comma separated list of regions that should generate SI component. For example: "AU,US,GB"', '')
  .option('-u, --excluded-target-regions <regions>', 'Comma separated list of regions that should not generate SI component. For example: "AU,US,GB"', '')
  .parse(process.argv)

let targetRegions = ""
if (commander.targetRegions) {
  // Stripping unrelated chars.
  // Only upper case and commas are allowed.
  targetRegions = commander.targetRegions.replace(/[^A-Z,]/g, "")
}
let excludedTargetRegions = ""
if (commander.excludedTargetRegions) {
  excludedTargetRegions = commander.excludedTargetRegions.replace(/[^A-Z,]/g, "")
}

generateNTPSponsoredImages(commander.dataUrl, targetRegions, excludedTargetRegions)
