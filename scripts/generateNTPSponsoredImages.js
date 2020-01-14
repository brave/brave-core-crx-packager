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
  return [ 'en-US' ]
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
        let zip = new admZip(dataZipFile)
        zip.extractAllTo(targetResourceDir)
        console.log(`Downloaded ${url} to ${dataZipFile} and unzipped`)
      })
  })
}

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp sponsored images')
  .parse(process.argv)

generateNTPSponsoredImages(commander.dataUrl)
