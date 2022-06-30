/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// This script simply uploads the raw .dat files to the same location as brave/ad-block.
// This is done for use in browser-android-tabs and iOS.
// Android will eventually be changed to use crx packaging when it moves to Brave Core
// fully.

const fs = require('fs')
const s3 = require('s3-client')
const path = require('path')
const { installErrorHandlers } = require('../lib/util')
const dataFileVersion = 4

installErrorHandlers()

const client = s3.createClient({
  maxAsyncS3: 20,
  s3RetryCount: 3,
  s3RetryDelay: 1000,
  multipartUploadThreshold: 20971520,
  multipartUploadSize: 15728640,
  // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
  s3Options: {}
})

const uploadFile = (key, filePath, filename) => {
  return new Promise((resolve, reject) => {
    console.log('uploadFile', filename)
    const params = {
      localFile: filePath,
      // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
      s3Params: {
        Bucket: process.env.S3_ADBLOCK_BUCKET,
        Key: `${key}/${filename}`,
        GrantFullControl: process.env.S3_CANONICAL_ID,
        GrantRead: process.env.CLOUDFRONT_CANONICAL_ID
      }
    }
    const uploader = client.uploadFile(params)
    process.stdout.write(`Started uploading to: ${params.s3Params.Key}... `)
    uploader.on('error', function (err) {
      reject(new Error(`Unable to upload, do you have ~/.aws/credentials filled out? ${err}`))
    })
    uploader.on('end', function (params) {
      console.log('completed')
      resolve()
    })
  })
}

// Queue up all the uploads one at a time to easily spot errors
let p = Promise.resolve()

const basePath = path.join('build', 'ad-block-updater')
const dirs = fs.readdirSync(basePath)
dirs.forEach((dir) => {
  const dataFileDir = path.join(basePath, dir)
  if (!fs.statSync(dataFileDir).isDirectory()) {
    return
  }
  const dataFilenames = fs.readdirSync(dataFileDir)
  dataFilenames.forEach((filename) => {
    const currentPath = path.join(dataFileDir, filename)
    if (filename.startsWith('rs-')) {
      p = p.then(uploadFile.bind(null, dataFileVersion, currentPath, filename))
    }
  })
})

p = p.catch((e) => {
  console.error('A problem was encounterd', e)
  process.exit(1)
})
