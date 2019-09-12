/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Engine, lists } = require('adblock-rs')
const path = require('path')
const fs = require('fs')
const request = require('request')
const uBlockResources = 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/resources.txt'

/**
 * Returns a promise that which resolves with the list data
 *
 * @param listURL The URL of the list to fetch
 * @param filter The filter function to apply to the body
 * @return a promise that resolves with the content of the list or rejects with an error message.
 */
const getBufferFromURL = (listURL, filter) => {
  return new Promise((resolve, reject) => {
    request.get(listURL, function (error, response, body) {
      if (error) {
        reject(new Error(`Request error: ${error}`))
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Error status code ${response.statusCode} returned for URL: ${listURL}`))
        return
      }
      if (filter) {
        body = filter(body)
      }
      resolve(body)
    })
  })
}

/**
 * Returns a filter function to apply for a specific UUID
 *
 * @param uuid The UUID that the filter function should be returned for.
 */
const getListFilterFunction = (uuid) => {
  // Apply any transformations based on list UUID here
  // if (uuid === 'FBB430E8-3910-4761-9373-840FC3B43FF2') {
  //  return (input) => input.split('\n').slice(4)
  //    .map((line) => `||${line}`).join('\n')
  // }
  return undefined
}

/**
 * Obtains the output path to store a file given the specied name and subdir
 */
const getOutPath = (outputFilename, outSubdir) => {
  let outPath = path.join('build')
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath)
  }
  outPath = path.join(outPath, 'ad-block-updater')
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath)
  }
  outPath = path.join(outPath, outSubdir)
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath)
  }
  return path.join(outPath, outputFilename)
}

/**
 * Parses the passed in filter rule data and serializes a data file to disk.
 *
 * @param filterRuleData The filter rule data to parse, or an array of such strings.
 * @param outputDATFilename The filename of the DAT file to create.
 */
const generateDataFileFromString = (filterRuleData, outputDATFilename, outSubdir) => {
  let rules
  if (filterRuleData.constructor === Array) {
    rules = filterRuleData.join('\n')
  } else {
    rules = filterRuleData
  }
  const client = new Engine(rules.split('\n'))
  const arrayBuffer = client.serialize()
  const outPath = getOutPath(outputDATFilename, outSubdir)
  fs.writeFileSync(outPath, Buffer.from(arrayBuffer))
}

/**
 * Generates a reosources.txt file for the specified buffer and subdir
 *
 * @param resourcesData The data to store in the resources.txt file
 */
const generateResourcesFileFromString = (resourcesData) => {
  const outPath = getOutPath('resources.txt', 'default')
  fs.writeFileSync(outPath, resourcesData, 'utf8')
}

/**
 * Convenience function that uses getBufferFromURL and generateDataFileFromString
 * to construct a DAT file from a URL while applying a specific filter.
 *
 * @param listURL the URL of the list to fetch.
 * @param outputDATFilename the DAT filename to write to.
 * @param filter The filter function to apply.
 * @return a Promise which resolves if successful or rejects if there's an error.
 */
const generateDataFileFromURL = (listURL, langs, uuid, outputDATFilename, filter) => {
  return new Promise((resolve, reject) => {
    console.log(`${langs} ${listURL}...`)
    request.get(listURL, function (error, response, body) {
      if (error) {
        reject(new Error(`Request error: ${error}`))
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Error status code ${response.statusCode} returned for URL: ${listURL}`))
        return
      }
      if (filter) {
        body = filter(body)
      }
      generateDataFileFromString([body], outputDATFilename, uuid)
      resolve()
    })
  })
}

/**
 * Convenience function that generates a DAT file for each region
 */
const generateDataFilesForAllRegions = () => {
  console.log('Processing per region list updates...')
  let p = Promise.resolve()
  new lists('regions').forEach((region) => { // eslint-disable-line
    p = p.then(generateDataFileFromURL.bind(null, region.url,
      region.langs, region.uuid, `rs-${region.uuid}.dat`))
  })
  return p
}

/**
 * Convenience function that generates a DAT file for the default list
 */
const generateDataFilesForList = (lists, filename) => {
  let promises = []
  lists.forEach((l) => {
    console.log(`${l.url}...`)
    const filterFn = getListFilterFunction(l.uuid)
    promises.push(getBufferFromURL(l.url, filterFn))
  })
  let p = Promise.all(promises)
  p = p.then((listBuffers) => {
    generateDataFileFromString(listBuffers, filename, 'default')
  })
  p = p.then(getBufferFromURL.bind(null, uBlockResources))
    .then(generateResourcesFileFromString)
  return p
}

const generateDataFilesForDefaultAdblock =
  generateDataFilesForList.bind(null, new lists('default'), 'rs-ABPFilterParserData.dat')  // eslint-disable-line

// For adblock-rust-ffi, included just as a char array via hexdump
const generateTestDataFile1 =
  generateDataFileFromString.bind(null, 'ad-banner', 'ad-banner.dat', 'test-data')
// For adblock-rust-ffi, included just as a char array via hexdump
const generateTestDataFile2 =
  generateDataFileFromString.bind(null, 'ad-banner$tag=abc', 'ad-banner-tag-abc.dat', 'test-data')
// For brave-core ./data/adblock-data/adblock-default/rs-ABPFilterParserData.dat
// For brave-core ./data/adblock-data/adblock-v3/rs-ABPFilterParserData.dat
const generateTestDataFile3 =
  generateDataFileFromString.bind(null, 'adbanner\nad_banner', 'rs-default.dat', 'test-data')
// For brave-core ./data/adblock-data/adblock-v4/rs-ABPFilterParserData.dat
const generateTestDataFile4 =
  generateDataFileFromString.bind(null, 'v4_specific_banner.png', 'rs-v4.dat', 'test-data')
// For brave-core ./brave/test/data/adblock-data/adblock-regional/
// 9852EFC4-99E4-4F2D-A915-9C3196C7A1DE/rs-9852EFC4-99E4-4F2D-A915-9C3196C7A1DE.dat
const generateTestDataFile5 =
  generateDataFileFromString.bind(null, 'ad_fr.png', 'rs-9852EFC4-99E4-4F2D-A915-9C3196C7A1DE.dat', 'test-data')

generateDataFilesForDefaultAdblock()
  .then(generateTestDataFile1)
  .then(generateTestDataFile2)
  .then(generateTestDataFile3)
  .then(generateTestDataFile4)
  .then(generateTestDataFile5)
  .then(generateDataFilesForAllRegions)
  .then(() => {
    console.log('Thank you for updating the data files, don\'t forget to upload them too!')
  })
  .catch((e) => {
    console.error(`Something went wrong, aborting: ${e}`)
    process.exit(1)
  })

process.on('uncaughtException', (err) => {
  console.error('Caught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
  process.exit(1)
})
