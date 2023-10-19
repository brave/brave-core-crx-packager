/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs'
import path from 'path'
import util from '../lib/util.js'

util.installErrorHandlers()

commander
  .option('-d, --crx-directory <dir>', 'directory containing multiple crx files to patch')
  .option('-f, --crx-file <file>', 'crx file to patch', 'extension.crx')
  .option('-p, --patches <number-of-versions>', 'Generate differential patches for the last NUM versions', parseInt, 0)
  .parse(process.argv)

let crxParam = ''

if (fs.existsSync(commander.crxFile)) {
  crxParam = commander.crxFile
} else if (fs.existsSync(commander.crxDirectory)) {
  crxParam = commander.crxDirectory
} else {
  throw new Error(`Missing or invalid crx file/directory, file: '${commander.crxFile} directory: '${commander.crxDirectory}'`)
}

const downloadJobs = []
if (fs.lstatSync(crxParam).isDirectory()) {
  fs.readdirSync(crxParam).forEach(file => {
    if (path.parse(file).ext === '.crx') {
      downloadJobs.push(util.fetchPreviousVersions(path.join(crxParam, file), null, commander.patches))
    }
  })
} else {
  downloadJobs.push(util.fetchPreviousVersions(crxParam, null, commander.patches))
}

Promise.all(downloadJobs).then(() => {
  if (fs.lstatSync(crxParam).isDirectory()) {
    fs.readdirSync(crxParam).forEach(file => {
      const filePath = path.parse(path.join(crxParam, file))
      if (filePath.ext === '.crx') {
        util.generatePuffPatches(path.join(crxParam, file), undefined, commander.patches)
      }
    })
  } else {
    util.generatePuffPatches(crxParam, undefined, commander.patches)
  }
}).catch((err) => {
  console.error('Caught exception:', err)
  process.exit(1)
})
