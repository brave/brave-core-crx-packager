/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  checkAdblockRustV086Compat,
  generateResourcesFile,
  getListCatalog,
  getDefaultLists,
  getRegionalLists,
  preprocess,
  resourcesComponentId,
  regionalCatalogComponentId,
  sanityCheckList
} from '../lib/adBlockRustUtils.js'
import commander from 'commander'
import Sentry from '../lib/sentry.js'
import util from '../lib/util.js'
import path from 'path'
import fs from 'fs'
import crypto from 'node:crypto'

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
  listBuffer.data = listBuffer.data.split('\n').filter(line => {
    line = line.trim()
    // Prior to adblock-rust 0.8.7, scriptlet arguments with trailing escaped commas can cause crashes.
    if (!checkAdblockRustV086Compat(line)) {
      return false
    }
    if (line.startsWith('/^dizipal\\d+\\.com$/##')) {
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
const generateDataFilesForCatalogEntry = (entry, mirrorCommitHash) => {
  const lists = entry.sources

  const promises = []
  lists.forEach((l) => {
    console.log(`${entry.langs} ${l.url}...`)
    const sourceUrlHash = crypto.createHash('md5').update(l.url).digest('hex')
    const commitRef = mirrorCommitHash === undefined ? 'refs/heads/lists' : `${mirrorCommitHash}`
    const mirroredListUrl = `https://raw.githubusercontent.com/brave/adblock-lists-mirror/${commitRef}/lists/${sourceUrlHash}.txt`
    promises.push(util.fetchTextFromURL(mirroredListUrl)
      .then(data => ({ title: l.title || entry.title, format: l.format, data }))
      .then(async listBuffer => {
        const compat = removeIncompatibleRules(preprocess(listBuffer))
        await sanityCheckList(compat)
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
const generateDataFilesForAllRegions = (mirrorCommitHash) => {
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
      generateDataFilesForCatalogEntry(region, mirrorCommitHash)
    )))
  })
}

const generateDataFilesForResourcesComponent = () => {
  return generateResourcesFile(getOutPath('resources.json', resourcesComponentId))
}

const generateDataFilesForDefaultAdblock = (mirrorCommitHash) => getDefaultLists()
  .then(defaultLists => Promise.all(defaultLists.map(list => generateDataFilesForCatalogEntry(list, mirrorCommitHash))))

commander
  .option('-c, --commit-hash <hash>', 'Use lists from a specified commit of the brave/adblock-lists-mirror repo. Defaults to the latest commit.')
  .parse(process.argv)

const mirrorCommitHash = commander.commitHash

generateDataFilesForDefaultAdblock(mirrorCommitHash)
  .then(generateDataFilesForResourcesComponent)
  .then(generateDataFilesForAllRegions.bind(null, mirrorCommitHash))
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
