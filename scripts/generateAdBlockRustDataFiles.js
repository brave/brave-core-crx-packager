/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  generateResourcesFile,
  getListCatalog,
  getDefaultLists,
  getRegionalLists,
  resourcesComponentId,
  regionalCatalogComponentId,
  sanityCheckList
} from '../lib/adBlockRustUtils.js'
import Sentry from '../lib/sentry.js'
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

const removeIncompatibleRules = (listBuffer) => {
  // Prior to adblock-rust 0.8.7, scriptlet arguments with trailing escaped commas can cause crashes.
  listBuffer.data = listBuffer.data.split('\n').filter(line => {
    line = line.trim()
    if (line.indexOf('+js(') >= 0 && line.endsWith('\\,)')) {
      return false
    }
    return true
  }).join('\n')
  return listBuffer
}

/**
 * Serializes the provided lists to disk in one file as `list.txt` under the given component subdirectory.
 */
const generatePlaintextListFromLists = (listBuffers, outSubdir) => {
  const fullList = listBuffers.map(({ data, title }) => enforceBraveDirectives(title, data)).join('\n')
  fs.writeFileSync(getOutPath('list.txt', outSubdir), fullList)
}

/**
 * Convenience function that generates component files for a given catalog entry.
 *
 * If any list source cannot be downloaded, the promise will resolve but the new files will _not_ be generated.
 *
 * @param entry the corresponding entry directly from one of Brave's list catalogs
 * @param doIos boolean, whether or not filters for iOS should be created (currently only used by default list)
 * @return a Promise which resolves upon completion
 */
const generateDataFilesForCatalogEntry = (entry) => {
  const lists = entry.sources

  const promises = []
  lists.forEach((l) => {
    console.log(`${entry.langs} ${l.url}...`)
    promises.push(util.fetchTextFromURL(l.url)
      .then(data => ({ title: l.title || entry.title, format: l.format, data }))
      .then(listBuffer => {
        const compat = removeIncompatibleRules(listBuffer)
        sanityCheckList(compat)
        return compat
      })
    )
  })
  return Promise.all(promises)
    .then(
      listBuffers => generatePlaintextListFromLists(listBuffers, entry.list_text_component.component_id),
      e => {
        console.error(`Not publishing a new version of ${entry.title} due to failure downloading a source: ${e.message}`)
        if (Sentry) {
          Sentry.captureException(e, { level: 'warning' })
        }
      }
    )
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
  .then(defaultLists => Promise.all(defaultLists.map(list => generateDataFilesForCatalogEntry(list))))

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
