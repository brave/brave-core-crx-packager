/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs'
import os from 'os'
import path from 'path'
import pAll from 'p-all'
import util from '../lib/util.js'

util.installErrorHandlers()

commander
  .option('-d, --crx-directory <dir>', 'directory containing multiple crx files to patch')
  .option('-f, --crx-file <file>', 'crx file to patch', 'extension.crx')
  .option('-p, --patches <number-of-versions>', 'Generate differential patches for the last NUM versions', parseInt, 0)
  .option('-c, --concurrency <number>', 'Maximum concurrent patch generation processes', parseInt)
  .parse(process.argv)

let crxParam = ''

if (fs.existsSync(commander.crxFile)) {
  crxParam = commander.crxFile
} else if (fs.existsSync(commander.crxDirectory)) {
  crxParam = commander.crxDirectory
} else {
  throw new Error(`Missing or invalid crx file/directory, file: '${commander.crxFile} directory: '${commander.crxDirectory}'`)
}

const isDirectory = fs.lstatSync(crxParam).isDirectory()

const downloadJobs = []
if (isDirectory) {
  fs.readdirSync(crxParam).forEach(file => {
    if (path.parse(file).ext === '.crx') {
      downloadJobs.push(util.fetchPreviousVersions(path.join(crxParam, file), null, commander.patches))
    }
  })
} else {
  downloadJobs.push(util.fetchPreviousVersions(crxParam, null, commander.patches))
}

Promise.all(downloadJobs).then(async () => {
  console.log('All downloads for all CRX files completed. Starting patch generation...')

  let concurrency = commander.concurrency

  // If unset, default to CPU cores
  if (concurrency === undefined) {
    concurrency = os.cpus().length
  } else if (!Number.isInteger(concurrency) || concurrency < 1) {
    // If invalid (negative, NaN, etc), default to 1
    console.warn(`Invalid concurrency value '${commander.concurrency}'. Falling back to 1.`)
    concurrency = 1
  }

  console.log(`Using puffin concurrency limit of ${concurrency}`)

  // Collect all patch jobs from all CRX files first,
  // then execute with a global concurrency limit
  const patchJobs = []
  if (isDirectory) {
    fs.readdirSync(crxParam).forEach(file => {
      const filePath = path.join(crxParam, file)
      if (path.parse(filePath).ext === '.crx') {
        patchJobs.push(util.generatePuffPatches(filePath, undefined, commander.patches))
      }
    })
  } else {
    patchJobs.push(util.generatePuffPatches(crxParam, undefined, commander.patches))
  }
  const allPatchJobs = (await Promise.all(patchJobs)).flat()

  // Execute all patch jobs with global concurrency limit
  await pAll(allPatchJobs, { concurrency })
  console.log('All patches generated.')
}).catch((err) => {
  console.error('Caught exception:', err)
  process.exit(1)
})
