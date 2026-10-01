/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs'
import os from 'os'
import path from 'path'
import pAll from 'p-all'
import util from '../lib/util.js'
import { pathToFileURL } from 'url'

export async function main (argv = process.argv) {
  util.installErrorHandlers()

  const command = new commander.Command()
    .option('-d, --crx-directory <dir>', 'directory containing multiple crx files to patch')
    .option('-f, --crx-file <file>', 'crx file to patch', 'extension.crx')
    .option('-p, --patches <number-of-versions>', 'Generate differential patches for the last NUM versions', parseInt, 0)
    .option('-c, --concurrency <number>', 'Maximum concurrent patch generation processes', parseInt)
  command.parse(argv)

  let crxParam = ''

  if (fs.existsSync(command.crxFile)) {
    crxParam = command.crxFile
  } else if (fs.existsSync(command.crxDirectory)) {
    crxParam = command.crxDirectory
  } else {
    throw new Error(`Missing or invalid crx file/directory, file: '${command.crxFile} directory: '${command.crxDirectory}'`)
  }

  const isDirectory = fs.lstatSync(crxParam).isDirectory()

  const downloadJobs = []
  if (isDirectory) {
    fs.readdirSync(crxParam).forEach(file => {
      if (path.parse(file).ext === '.crx') {
        downloadJobs.push(() => util.fetchPreviousVersions(path.join(crxParam, file), null, command.patches))
      }
    })
  } else {
    downloadJobs.push(() => util.fetchPreviousVersions(crxParam, null, command.patches))
  }

  // limit fetch parallelisation to avoid overloading the s3 client
  //  note each download job may fetch multiple versions (as controlled by `-p`), so
  //  the concurrency here is deliberately conservative
  await pAll(downloadJobs, { concurrency: 5 }).then(async () => {
    console.log('All downloads for all CRX files completed. Starting patch generation...')

    let concurrency = command.concurrency

    // If unset, default to CPU cores
    if (concurrency === undefined) {
      concurrency = os.cpus().length
    } else if (!Number.isInteger(concurrency) || concurrency < 1) {
      // If invalid (negative, NaN, etc), default to 1
      console.warn(`Invalid concurrency value '${command.concurrency}'. Falling back to 1.`)
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
          patchJobs.push(util.generatePuffPatches(filePath, undefined, command.patches))
        }
      })
    } else {
      patchJobs.push(util.generatePuffPatches(crxParam, undefined, command.patches))
    }
    const allPatchJobs = (await Promise.all(patchJobs)).flat()

    // Execute all patch jobs with global concurrency limit
    await pAll(allPatchJobs, { concurrency })
    console.log('All patches generated.')
  }).catch((err) => {
    console.error('Caught exception:', err)
    process.exit(1)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
