/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Engine, FilterFormat, FilterSet, RuleTypes } = require('adblock-rs')
const { generateResourcesFile, getDefaultLists, getRegionalLists, resourcesComponentId, regionalCatalogComponentId } = require('../lib/adBlockRustUtils')
const path = require('path')
const fs = require('fs')
const request = require('request')

/**
 * Returns a promise that which resolves with the list data
 *
 * @param listURL The URL of the list to fetch
 * @return a promise that resolves with the content of the list or rejects with an error message.
 */
const getListBufferFromURL = (listURL) => {
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
      resolve(body)
    })
  })
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
 * @param filterRuleData An array of { format, data, includeRedirectUrls, ruleTypes } where format is one of `adblock-rust`'s supported filter parsing formats and data is a newline-separated list of such filters.
 * includeRedirectUrls is a boolean: https://github.com/brave/adblock-rust/pull/184. We only support redirect URLs on filter lists we maintain and trust.
 * ruleTypes was added with https://github.com/brave/brave-core-crx-packager/pull/298 and allows for { RuleTypes.ALL, RuleTypes.NETWORK_ONLY, RuleTypes.COSMETIC_ONLY }
 * @param outputDATFilename The filename of the DAT file to create.
 */
const generateDataFileFromLists = (filterRuleData, outputDATFilename, outSubdir, defaultRuleType = RuleTypes.ALL) => {
  const filterSet = new FilterSet(false)
  for (let { format, data, includeRedirectUrls, ruleTypes } of filterRuleData) {
    includeRedirectUrls = Boolean(includeRedirectUrls)
    ruleTypes = ruleTypes || defaultRuleType
    const parseOpts = { format, includeRedirectUrls, ruleTypes }
    filterSet.addFilters(data.split('\n'), parseOpts)
  }
  const client = new Engine(filterSet, true)
  const arrayBuffer = client.serializeCompressed()
  const outPath = getOutPath(outputDATFilename, outSubdir)
  fs.writeFileSync(outPath, Buffer.from(arrayBuffer))
}

/**
 * Convenience function that uses getListBufferFromURL and generateDataFileFromLists
 * to construct a DAT file from a URL.
 *
 * @param listURL the URL of the list to fetch.
 * @param the format of the filter list at the given URL.
 * @param outputDATFilename the DAT filename to write to.
 * @return a Promise which resolves if successful or rejects if there's an error.
 */
const generateDataFileFromURL = (listURL, format, langs, uuid, outputDATFilename) => {
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
      generateDataFileFromLists([{ format, data: body }], outputDATFilename, uuid)
      resolve()
    })
  })
}

/**
 * Convenience function that generates a DAT file for each region, and writes
 * the catalog of available regional lists to the default list directory and
 * regional catalog component directory.
 */
const generateDataFilesForAllRegions = () => {
  console.log('Processing per region list updates...')
  return getRegionalLists().then(regions => {
    return new Promise((resolve, reject) => {
      const catalogString = JSON.stringify(regions)
      fs.writeFileSync(getOutPath('regional_catalog.json', 'default'), catalogString)
      fs.writeFileSync(getOutPath('regional_catalog.json', regionalCatalogComponentId), catalogString)
      resolve()
    }).then(Promise.all(regions.map(region =>
      generateDataFileFromURL(region.url,
        region.format, region.langs, region.uuid, `rs-${region.uuid}.dat`)
    )))
  })
}

/**
 * Convenience function that generates a DAT file and resources file for the default list
 */
const generateDataFilesForList = (lists, filename) => {
  const promises = []
  lists.forEach((l) => {
    console.log(`${l.url}...`)
    promises.push(getListBufferFromURL(l.url).then(data => ({ format: l.format, data, includeRedirectUrls: l.includeRedirectUrls })))
  })
  let p = Promise.all(promises)
  p = p.then((listBuffers) => {
    generateDataFileFromLists(listBuffers, filename, 'default')
    // for iOS team - compile cosmetic filters only
    generateDataFileFromLists(listBuffers, 'ios-cosmetic-filters.dat', 'test-data', RuleTypes.COSMETIC_ONLY)
  })
  p = p.then(() => generateResourcesFile(getOutPath('resources.json', 'default')))
  return p
}

const generateDataFilesForResourcesComponent = async () => {
  return generateResourcesFile(getOutPath('resources.json', resourcesComponentId))
}

const generateDataFilesForDefaultAdblock = () => getDefaultLists().then(defaultLists =>
  generateDataFilesForList(defaultLists, 'rs-ABPFilterParserData.dat'))

// For adblock-rust-ffi, included just as a char array via hexdump
const generateTestDataFile1 =
  generateDataFileFromLists.bind(null, [{ format: FilterFormat.STANDARD, data: 'ad-banner' }], 'ad-banner.dat', 'test-data')
// For adblock-rust-ffi, included just as a char array via hexdump
const generateTestDataFile2 =
  generateDataFileFromLists.bind(null, [{ format: FilterFormat.STANDARD, data: 'ad-banner$tag=abc' }], 'ad-banner-tag-abc.dat', 'test-data')
// For brave-core ./data/adblock-data/adblock-default/rs-ABPFilterParserData.dat
// For brave-core ./data/adblock-data/adblock-v3/rs-ABPFilterParserData.dat
const generateTestDataFile3 =
  generateDataFileFromLists.bind(null, [{ format: FilterFormat.STANDARD, data: 'adbanner\nad_banner' }], 'rs-default.dat', 'test-data')
// For brave-core ./data/adblock-data/adblock-v4/rs-ABPFilterParserData.dat
const generateTestDataFile4 =
  generateDataFileFromLists.bind(null, [{ format: FilterFormat.STANDARD, data: 'v4_specific_banner.png' }], 'rs-v4.dat', 'test-data')
// For brave-core ./brave/test/data/adblock-data/adblock-regional/
// 9852EFC4-99E4-4F2D-A915-9C3196C7A1DE/rs-9852EFC4-99E4-4F2D-A915-9C3196C7A1DE.dat
const generateTestDataFile5 =
  generateDataFileFromLists.bind(null, [{ format: FilterFormat.STANDARD, data: 'ad_fr.png' }], 'rs-9852EFC4-99E4-4F2D-A915-9C3196C7A1DE.dat', 'test-data')

generateDataFilesForDefaultAdblock()
  .then(generateDataFilesForResourcesComponent)
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
