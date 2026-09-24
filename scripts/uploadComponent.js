/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs'
import path from 'path'
import util from '../lib/util.js'
import pAll from 'p-all'
import { pathToFileURL } from 'url'

export async function main (argv = process.argv) {
  util.installErrorHandlers()

  const command = new commander.Command()
    .option('-d, --crx-directory <dir>', 'directory containing multiple crx files to upload')
    .option('-f, --crx-file <file>', 'crx file to upload', 'extension.crx')
    .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
    .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
  command.parse(argv)

  let crxParam = ''

  if (fs.existsSync(command.crxFile)) {
    crxParam = command.crxFile
  } else if (fs.existsSync(command.crxDirectory)) {
    crxParam = command.crxDirectory
  } else {
    throw new Error(`Missing or invalid crx file/directory, file: '${command.crxFile} directory: '${command.crxDirectory}'`)
  }

  const uploadJobs = []
  if (fs.lstatSync(crxParam).isDirectory()) {
    fs.readdirSync(crxParam).forEach(file => {
      if (path.parse(file).ext === '.crx') {
        uploadJobs.push(() => util.uploadCRXFile(command.endpoint, command.region, path.join(crxParam, file)))
      }
    })
  } else {
    uploadJobs.push(() => util.uploadCRXFile(command.endpoint, command.region, crxParam))
  }

  await pAll(uploadJobs, { concurrency: 5 }).then(() => {
    return util.createTableIfNotExists(command.endpoint, command.region).then(() => {
      if (fs.lstatSync(crxParam).isDirectory()) {
        fs.readdirSync(crxParam).forEach(file => {
          const filePath = path.parse(path.join(crxParam, file))
          if (filePath.ext === '.crx') {
            const contentHashPath = path.resolve(filePath.dir, filePath.name + '.contentHash')
            let contentHash
            if (fs.existsSync(contentHashPath)) {
              contentHash = fs.readFileSync(contentHashPath).toString()
            }
            util.updateDBForCRXFile(command.endpoint, command.region, path.join(crxParam, file), undefined, contentHash)
          }
        })
      } else {
        util.updateDBForCRXFile(command.endpoint, command.region, crxParam)
      }
    })
  }).catch((err) => {
    console.error('Caught exception:', err)
    process.exit(1)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
