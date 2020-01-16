/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs-extra')
const request = require('request')
const commander = require('commander')
const admZip = require('adm-zip')

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

const generateNTPSponsoredImages = (dataUrl) => {
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources')
  mkdirp.sync(rootResourceDir)

  getRegionList().forEach((region) => {
    const targetResourceDir = path.join(rootResourceDir, region)
    mkdirp.sync(targetResourceDir)
    const dataZipFile = path.join(rootResourceDir, `${region}.zip`)
    const url = `${dataUrl}${region}.zip`
    request(url)
      .pipe(fs.createWriteStream(dataZipFile))
      .on('finish', () => {
        try {
          let zip = new admZip(dataZipFile)
          zip.extractAllTo(targetResourceDir)
          console.log(`Downloaded ${url} to ${dataZipFile} and unzipped`)
          fs.unlinkSync(dataZipFile)
        } catch (error) {
          console.log(`${error} - maybe due to missing zip file (${region}.zip)`)
          // Generate empty photo.json for generating crx file with it.
          const emptyPhotoJsonFile = path.join(targetResourceDir, 'photo.json')
          fs.writeFileSync(emptyPhotoJsonFile, '{}')
          fs.unlinkSync(dataZipFile)
        }
      })
  })
}

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp sponsored images')
  .parse(process.argv)

generateNTPSponsoredImages(commander.dataUrl)
