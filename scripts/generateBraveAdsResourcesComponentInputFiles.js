/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs-extra')
const request = require('request')
const commander = require('commander')

const getComponentList = () => {
  return [
    'iso_3166_1_gb', // United Kingdom
    'iso_3166_1_jp', // Japan
    'iso_3166_1_us', // United States of America
    'iso_3166_1_ca', // Canada
    'iso_3166_1_de', // Germany
    'iso_3166_1_at', // Austria
    'iso_3166_1_ch', // Switzerland
    'iso_3166_1_be', // Belgium
    'iso_3166_1_au', // Australia
    'iso_3166_1_nz', // New Zealand
    'iso_3166_1_pt', // Portugal
    'iso_3166_1_fr', // France
    'iso_3166_1_nl', // Netherlands
    'iso_3166_1_dk', // Denmark
    'iso_3166_1_es', // Spain
    'iso_3166_1_fi', // Finland
    'iso_3166_1_hk', // Hong Kong
    'iso_3166_1_hu', // Hungary
    'iso_3166_1_ie', // Ireland
    'iso_3166_1_in', // India
    'iso_3166_1_it', // Italy
    'iso_3166_1_kr', // Korea
    'iso_3166_1_no', // Norway
    'iso_3166_1_se', // Sweden
    'iso_3166_1_sg', // Singapore
    'iso_3166_1_tw', // Taiwan
    'iso_3166_1_cz', // Czechia
    'iso_3166_1_ee', // Estonia
    'iso_3166_1_lt', // Lithuania
    'iso_3166_1_pk', // Pakistan
    'iso_3166_1_pl', // Poland
    'iso_3166_1_sk', // Slovakia
    'iso_639_1_de',
    'iso_639_1_en',
    'iso_639_1_fr',
    'iso_639_1_ja',
    'iso_639_1_pt',
    'iso_639_1_es',
    'iso_639_1_ar',
    'iso_639_1_zh',
    'iso_639_1_nl',
    'iso_639_1_fi',
    'iso_639_1_el',
    'iso_639_1_he',
    'iso_639_1_it',
    'iso_639_1_ko',
    'iso_639_1_pl',
    'iso_639_1_ro',
    'iso_639_1_ru',
    'iso_639_1_sv',
    'iso_639_1_tr'
  ]
}

function downloadComponentInputFiles (manifestFileName, manifestUrl, outDir) {
  return new Promise(function (resolve, reject) {
    let manifestBody = '{}'
    request(manifestUrl, async function (error, response, body) {
      if (error) {
        console.error(`Error from ${manifestUrl}:`, error)
        return reject(error)
      }

      if (response && response.statusCode === 200) {
        manifestBody = body
      }

      const manifestJson = JSON.parse(manifestBody)
      if (!manifestJson.schemaVersion) {
        console.error('Error: Missing schema version')
        return reject(error)
      }

      fs.writeFileSync(`${outDir}/${manifestFileName}`, JSON.stringify(manifestJson))

      const fileList = []

      if (manifestJson.resources) {
        manifestJson.resources.forEach((resource) => {
          fileList.push(resource.filename)
        })
      }

      const downloadOps = fileList.map((fileName) => new Promise(resolve => {
        const resourceFileOutPath = path.join(outDir, fileName)
        const resourceFileUrl = new URL(fileName, manifestUrl).href
        request(resourceFileUrl)
          .pipe(fs.createWriteStream(resourceFileOutPath))
          .on('finish', () => {
            console.log(resourceFileUrl)
            resolve()
          })
      }))

      await Promise.all(downloadOps)

      resolve()
    })
  })
}

async function generateComponents (dataUrl) {
  const rootResourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'resources')
  mkdirp.sync(rootResourceDir)

  for (const component of getComponentList()) {
    console.log(`Downloading ${component}...`)
    const outDir = path.join(rootResourceDir, component)
    mkdirp.sync(outDir)

    const manifestFileName = 'resources.json'
    const manifestUrl = `${dataUrl}${component}/${manifestFileName}`
    await downloadComponentInputFiles(manifestFileName, manifestUrl, outDir)
  }
}

commander
  .option('-d, --data-url <url>', 'url referring to component input files')
  .parse(process.argv)

generateComponents(commander.dataUrl)
