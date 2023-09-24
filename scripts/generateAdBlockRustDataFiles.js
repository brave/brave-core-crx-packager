/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Engine, FilterFormat, FilterSet, RuleTypes } from 'adblock-rs'
import { generateResourcesFile, getListCatalog, getDefaultLists, getRegionalLists, resourcesComponentId, regionalCatalogComponentId } from '../lib/adBlockRustUtils.js'
import util from '../lib/util.js'
import path from 'path'
import fs from 'fs'

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
  const arrayBuffer = client.serializeRaw()
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
    promises.push(util.fetchTextFromURL(l.url).then(data => ({ title: l.title || entry.title, format: l.format, data })))
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
      getListCatalog().then(listCatalog => {
        const catalogString = JSON.stringify(listCatalog)
        fs.writeFileSync(getOutPath('list_catalog.json', regionalCatalogComponentId), catalogString)
        resolve()
      })
    }).then(() => Promise.all(regions.map(region =>
      generateDataFilesForCatalogEntry(region)
    )))
  })
}

const generateDataFilesForResourcesComponent = () => {
  return generateResourcesFile(getOutPath('resources.json', resourcesComponentId))
}

const generateDataFilesForDefaultAdblock = () => getDefaultLists()
  // TODO convert to map/Promise.all once 'ios-cosmetic-filters.dat' is no longer required
  .then(defaultLists => generateDataFilesForCatalogEntry(defaultLists[0], true)
    .then(() => generateDataFilesForCatalogEntry(defaultLists[1], false)))
  // default adblock DAT component requires this for historical reasons
  .then(() => generateResourcesFile(getOutPath('resources.json', 'default')))

generateDataFilesForDefaultAdblock()
  .then(generateDataFilesForResourcesComponent)
  .then(generateDataFilesForAllRegions)
  .then(() => {
    console.log('Thank you for updating the data files, don\'t forget to upload them too!')
  })
  .catch((e) => {
    console.error(`Something went wrong, aborting: ${e} ${e.stack} ${e.message}`)
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
