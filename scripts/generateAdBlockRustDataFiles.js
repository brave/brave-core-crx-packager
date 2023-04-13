/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Engine, FilterFormat, FilterSet, RuleTypes } from 'adblock-rs'
import { generateResourcesFile, getDefaultLists, getRegionalLists, resourcesComponentId, regionalCatalogComponentId } from '../lib/adBlockRustUtils.js'
import path from 'path'
import fs from 'fs'

/**
 * Returns a promise that which resolves with the list data
 *
 * @param listURL The URL of the list to fetch
 * @return a promise that resolves with the content of the list or rejects with an error message.
 */
const getListBufferFromURL = (listURL) => {
  return fetch(listURL).then(response => {
    if (response.status !== 200) {
      throw new Error(`Error status ${response.status} ${response.statusText} returned for URL: ${listURL}`)
    }
    return response.text()
  }).catch(error => {
    throw new Error(`Error when fetching ${listURL}: ${error.cause}`)
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

// Removes Brave-specific scriptlet injections from non-Brave lists
const enforceBraveDirectives = (title, data) => {
  if (!title || !title.startsWith('Brave ')) {
    return data.split('\n').filter(line => {
      const hasBraveScriptlet = line.indexOf('+js(brave-') >= 0
      if (hasBraveScriptlet) {
        console.log('List ' + title + ' attempted to include brave-specific directive: ' + line)
      }
      return !hasBraveScriptlet
    }).join('\n')
  } else {
    return data
  }
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
  for (let { title, format, data, includeRedirectUrls, ruleTypes } of filterRuleData) {
    includeRedirectUrls = Boolean(includeRedirectUrls)
    ruleTypes = ruleTypes || defaultRuleType
    const parseOpts = { format, includeRedirectUrls, ruleTypes }
    filterSet.addFilters(enforceBraveDirectives(title, data).split('\n'), parseOpts)
  }
  const client = new Engine(filterSet, true)
  const arrayBuffer = client.serializeCompressed()
  const outPath = getOutPath(outputDATFilename, outSubdir)
  fs.writeFileSync(outPath, Buffer.from(arrayBuffer))
}

/**
 * Serializes the provided lists to disk in one file as `list.txt` under the given component subdirectory.
 */
const generatePlaintextListFromLists = (listBuffers, outSubdir) => {
  const fullList = listBuffers.map(({ data, title }) => enforceBraveDirectives(title, data)).join('\n')
  fs.writeFileSync(getOutPath('list.txt', outSubdir), fullList)
}

/**
 * Convenience function that generates component files for a given catalog entry
 *
 * @param entry the corresponding entry directly from one of Brave's list catalogs
 * @param doIos boolean, whether or not filters for iOS should be created (currently only used by default list)
 * @return a Promise which resolves if successful or rejects if there's an error.
 */
const generateDataFilesForCatalogEntry = (entry, doIos = false) => {
  const lists = entry.sources
  // default adblock DAT component requires this for historical reasons
  const outputDATFilename = (entry.uuid === 'default') ? 'rs-ABPFilterParserData.dat' : `rs-${entry.uuid}.dat`

  const promises = []
  lists.forEach((l) => {
    console.log(`${entry.langs} ${l.url}...`)
    promises.push(getListBufferFromURL(l.url).catch(error => {
      throw new Error(`Error when fetching ${l.url}: ${error.cause}`)
    }).then(data => ({ title: l.title || entry.title, format: l.format, data })))
  })
  let p = Promise.all(promises)
  p = p.then((listBuffers) => {
    generatePlaintextListFromLists(listBuffers, entry.list_text_component.component_id)
    generateDataFileFromLists(listBuffers, outputDATFilename, entry.uuid)
    if (doIos) {
      // for iOS team - compile cosmetic filters only
      generateDataFileFromLists(listBuffers, 'ios-cosmetic-filters.dat', 'test-data', RuleTypes.COSMETIC_ONLY)
    }
  })
  return p
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
    }).then(() => Promise.all(regions.map(region =>
      generateDataFilesForCatalogEntry(region)
    )))
  })
}

const generateDataFilesForResourcesComponent = () => {
  return generateResourcesFile(getOutPath('resources.json', resourcesComponentId))
}

const generateDataFilesForDefaultAdblock = () => getDefaultLists()
  .then(defaultLists => generateDataFilesForCatalogEntry(defaultLists[0], true))
  // default adblock DAT component requires this for historical reasons
  .then(() => generateResourcesFile(getOutPath('resources.json', 'default')))

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
