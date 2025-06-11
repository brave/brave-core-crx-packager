/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import childProcess from 'child_process'
import crypto from 'crypto'
import fs from 'fs-extra'
import { readFile } from 'node:fs/promises'
import { mkdirp } from 'mkdirp'
import path from 'path'
import unzip from 'unzip-crx-3'
import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  PutItemCommand,
  QueryCommand
} from '@aws-sdk/client-dynamodb'
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectTaggingCommand
} from '@aws-sdk/client-s3'
import replace from 'replace-in-file'
import { pipeline } from 'stream/promises'
import { tmpdir } from 'os'
import contentSign from './contentSign.js'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import https from 'https'

const DynamoDBTableName = 'Extensions'
const FirstVersion = '1.0.0'
const S3_EXTENSIONS_BUCKET =
  process.env.S3_EXTENSIONS_BUCKET || 'brave-core-ext'

const s3Client = new S3Client({
  signatureVersion: 'v4',
  endpoint: process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT : undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
  // Add timeout configuration
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: 200 // default is 50 per client.
    }),

    // time limit (ms) for receiving response.
    requestTimeout: 30_000,

    // time limit (ms) for establishing connection.
    connectionTimeout: 6_000
  })
})

/**
 * Returns a promise that resolves with the URL's body text data.
 * The request will be retried several times if necessary.
 *
 * @param listURL The URL of the list to fetch
 * @return a promise that resolves with the content of the list or rejects with an error message.
 */
const fetchTextFromURL = (listURL) => {
  const attempt = () =>
    fetch(listURL)
      .then((response) => {
        if (response.status !== 200) {
          throw new Error(
            `Error status ${response.status} ${response.statusText} returned for URL: ${listURL}`
          )
        }
        return response.text()
      })
      .catch((error) => {
        throw new Error(`Error when fetching ${listURL}: ${error.message}`)
      })

  // Introduces a delayed rejection into a promise chain so that request retries can be caught in a loop until a request succeeds
  const delayReject = (ms) => {
    return (reason) =>
      new Promise((_resolve, reject) =>
        setTimeout(() => {
          console.log(`Spurious error: ${reason.message}`)
          console.log('  (retrying...)')
          reject(reason)
        }, ms)
      )
  }

  const maxAttempts = 5
  const delayMs = 3000

  let p = Promise.reject(new Error())

  for (let i = 0; i < maxAttempts; i++) {
    p = p.catch(attempt).catch(delayReject(delayMs))
  }

  return p
}

/**
 * All files in the component's dir that matches the specified patterns will be signed.
 *
 * @param inputDir the component's root directory.
 * @param filePatterns the list of the glob file patterns.
 * @param privateKey the RS-256 signing key.
 */
const generateVerifiedContents = (inputDir, filePatterns, privateKey) => {
  const manifest = parseManifest(path.join(inputDir, 'manifest.json'))
  const componentId = getIDFromBase64PublicKey(manifest.key)
  const version = manifest.version

  const verifiedContents = contentSign.createVerifiedContents(
    inputDir,
    filePatterns,
    componentId,
    version,
    privateKey
  )

  return JSON.stringify(verifiedContents)
}

/**
 * Writes 'brave_metadata/verified_contents.json`.
 *
 * @param inputDir the component's root directory.
 * @param filePatterns the list of the glob file patterns.
 * @param privateKey the RS-256 signing key.
 */
const generateAndWriteVerifiedContents = (
  inputDir,
  filePatterns,
  privateKey
) => {
  const verifiedContents = generateVerifiedContents(
    inputDir,
    filePatterns,
    privateKey
  )

  const metadataDir = path.join(inputDir, 'brave_metadata')
  fs.mkdirSync(metadataDir)
  fs.writeFileSync(
    path.join(metadataDir, 'verified_contents.json'),
    verifiedContents
  )
}

const generateCRXFile = (
  binary,
  crxFile,
  privateKeyFile,
  publisherProofKey,
  publisherProofKeyAlt,
  inputDir
) => {
  if (!binary) {
    throw new Error('Missing Brave binary: --binary')
  }
  if (!publisherProofKey) {
    throw new Error('Missing --publisher-proof-key <file>')
  }
  if (
    publisherProofKeyAlt &&
    !fs.existsSync(path.resolve(publisherProofKeyAlt))
  ) {
    throw new Error(`${publisherProofKeyAlt}' does not exist.`)
  }
  if (!fs.existsSync(path.resolve(privateKeyFile))) {
    throw new Error(
      `Private key file '${privateKeyFile}' is missing, was it uploaded?`
    )
  }

  const tmp = tmpdir()
  const tempUserDataDir = fs.mkdtempSync(path.join(tmp, 'crx-package-job-'))
  const args = [
    `--pack-extension=${path.resolve(inputDir)}`,
    `--pack-extension-key=${path.resolve(privateKeyFile)}`,
    `--user-data-dir=${tempUserDataDir}`,
    `--brave-extension-publisher-key=${path.resolve(publisherProofKey)}`
  ]
  if (publisherProofKeyAlt) {
    args.push(
      `--brave-extension-publisher-key-alt=${path.resolve(publisherProofKeyAlt)}`
    )
  }
  const originalOutput = `${inputDir}.crx`
  childProcess.execSync(`${binary} ${args.join(' ')}`)
  fs.rmSync(tempUserDataDir, { recursive: true })
  fs.renameSync(originalOutput, crxFile)
}

const generateSHA256Hash = (data) => {
  const hash = crypto.createHash('sha256')
  return hash.update(data).digest('hex')
}

const generateSHA256HashOfFile = (file) => {
  return generateSHA256Hash(fs.readFileSync(file))
}

const generateVersionedSHA256HashOfFile = (file, version) => {
  return generateSHA256Hash(version + fs.readFileSync(file))
}

const getIDFromBase64PublicKey = (key) => {
  const hash = crypto.createHash('sha256')
  const data = Buffer.from(key, 'base64')
  const digest = hash.update(data).digest('hex')
  const id = digest.toString().substring(0, 32)
  return id.replace(/[0-9a-f]/g, (c) => {
    return 'abcdefghijklmnop'.charAt('0123456789abcdef'.indexOf(c))
  })
}

// Update getPreviousVersion if this code is updated
const incrementVersion = (version) => {
  const versionParts = version.split('.')
  versionParts[versionParts.length - 1]++
  return versionParts.join('.')
}

const installErrorHandlers = () => {
  process.on('uncaughtException', (err) => {
    console.error('Caught exception:', err)
    process.exit(1)
  })

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err)
    process.exit(1)
  })
}

const parseManifest = (manifestFile) => {
  // Strip comments from manifest.json before parsing
  const json = fs
    .readFileSync(manifestFile)
    .toString('utf-8')
    .replace(/\/\/#.*/g, '')
  return JSON.parse(json)
}

// IAM permissions of the running job should prevent access to unintended buckets.
// And the source of bucket names should always be the jenkins job configuration.
// However, as an additional layer of protection, ensure we only attempt to download
// from the buckets we expect.
const permittedBuckets = [
  'brave-theme-customizations-dev',
  'brave-theme-customizations'
]

/**
 * Returns a fetch-style response object for the given url. Both https:
 * and s3: style urls are supported.
 *
 * Note only the body fields in the response are fully populated, but this code
 * already throws on a non successful http response code, and s3 failures throw
 * errors on failure anyway.
 *
 * @param {string} sourceUrl either an https:// url or a s3 path such as s3://bucket/key
 * @returns {Promise<Response>} a "fetch" response object
 */
const s3capableFetch = async (sourceUrl) => {
  const source = new URL(sourceUrl)

  if (source.protocol === 'https:') {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(
        `download of ${sourceUrl} failed with code ${response.status}`
      )
    }
    return response
  }

  if (source.protocol === 's3:') {
    const bucket = source.host
    const key = source.pathname.slice(1) // drop the leading "/" from the key, s3 keys don't use this

    if (!permittedBuckets.includes(bucket)) {
      throw new Error(
        `download of ${sourceUrl} rejected as not a permitted bucket`
      )
    }

    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const s3response = await s3Client.send(command)
    if (!s3response.Body) {
      throw new Error(
        `download of ${sourceUrl} failed with unexpectedly empty body`
      )
    }
    return new Response(s3response.Body)
  }

  throw new Error(`unsupported protocol in ${sourceUrl}`)
}

const downloadFileFromS3 = async (key, outputPath, hashAsFilename = false) => {
  const command = new GetObjectCommand({
    Bucket: S3_EXTENSIONS_BUCKET,
    Key: key
  })

  if (hashAsFilename && !fs.statSync(outputPath).isDirectory()) {
    throw new Error(
      'Output path must be a directory when hashAsFilename is true'
    )
  }

  try {
    const tempUserDataDir = fs.mkdtempSync(path.join(tmpdir(), 's3-download-'))
    const tmpPath = path.join(tempUserDataDir, 'download')

    const response = await s3Client.send(command)
    await pipeline(response.Body, fs.createWriteStream(tmpPath))

    let outputFilename
    if (hashAsFilename) {
      outputFilename = `${outputPath}/${generateSHA256HashOfFile(tmpPath)}.crx`
    } else {
      outputFilename = outputPath
    }
    fs.copyFileSync(tmpPath, outputFilename)
    fs.unlinkSync(tmpPath)

    console.log(`Downloaded ${key}`)
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      console.error(`Failed to download ${key}, object does not exist.`)
    } else throw err
  }
}

const recreateDirectory = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true })
  }
  mkdirp.sync(dirPath)
}

const fetchPreviousVersions = (crxFile, componentId, num) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  return unzip(crxFile, unzipDir).then(() => {
    const data = parseManifest(path.join(unzipDir, 'manifest.json'))
    const id = componentId || getIDFromBase64PublicKey(data.key)
    const version = data.version

    const downloadJobs = []
    const downloadDir = `build/previous/${id}`

    recreateDirectory(downloadDir)

    for (let i = 0; i < num; i++) {
      const previousComponentFilename = `extension_${getPreviousVersion(version, i + 1).replace(/\./g, '_')}.crx`
      console.log(`Downloading ${previousComponentFilename}`)
      downloadJobs.push(
        downloadFileFromS3(
          `release/${id}/${previousComponentFilename}`,
          downloadDir,
          true
        )
      )
    }

    return Promise.all(downloadJobs)
      .then(() => {
        console.log('All files have been downloaded successfully.')
      })
      .catch((err) => {
        console.error('An error occurred during the downloads:', err)
        throw err
      })
  })
}

const generatePuffDiff = (sourceFile, destinationFile, outputFile) => {
  if (!sourceFile || !destinationFile || !outputFile) {
    throw new Error(
      'Missing parameters: source_file, destination_file, or output_file'
    )
  }

  const args = [
    '-puffdiff',
    path.resolve(sourceFile),
    path.resolve(destinationFile),
    path.resolve(outputFile)
  ]

  const result = childProcess.spawnSync('puffin', args, {
    stdio: [null, process.stdout, process.stderr]
  })
  if (result.error) {
    console.error(`Failed to execute puffin: ${result.error.message}`)
  }
}

const generatePuffPatches = (crxFile, componentId, num) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  return unzip(crxFile, unzipDir).then(() => {
    const data = parseManifest(path.join(unzipDir, 'manifest.json'))
    const id = componentId || getIDFromBase64PublicKey(data.key)
    const hash = generateSHA256HashOfFile(crxFile)

    const patchJobs = []
    const downloadDir = `build/previous/${id}`
    const outputDir = `build/patches/${id}/${hash}`

    recreateDirectory(outputDir)

    fs.readdirSync(downloadDir).forEach((file) => {
      const filePath = path.join(downloadDir, file)
      const parsedPath = path.parse(filePath)
      if (parsedPath.ext === '.crx') {
        const outputFile = `${outputDir}/${parsedPath.name}.puff`
        console.log(`Generating patch: ${outputFile}`)
        patchJobs.push(generatePuffDiff(filePath, crxFile, outputFile))
      }
    })

    return Promise.all(patchJobs)
      .then(() => {
        console.log('All patches generated.')
      })
      .catch((err) => {
        console.error('An error occurred:', err)
      })
  })
}

const uploadCRXFile = (endpoint, region, crxFile, componentId) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  return unzip(crxFile, unzipDir).then(() => {
    const data = parseManifest(path.join(unzipDir, 'manifest.json'))
    const id = componentId || getIDFromBase64PublicKey(data.key)
    const version = data.version
    const hash = generateSHA256HashOfFile(crxFile)
    const name = data.name

    return uploadExtension(name, id, version, hash, crxFile)
      .then(() => console.log(`Uploaded ${crxFile}`))
      .catch((err) => {
        console.log(`Uploading ${crxFile} is failed.`)
        throw err
      })
  })
}

const getDiffPatchList = (id, hash) => {
  const patchDir = `build/patches/${id}/${hash}`
  const patchList = {}
  try {
    fs.readdirSync(patchDir).forEach((file) => {
      const fullPath = path.join(patchDir, file)
      const parsedPath = path.parse(fullPath)
      if (parsedPath.ext === '.puff') {
        patchList[parsedPath.name] = {
          M: {
            Namediff: {
              S: file
            },
            Hashdiff: {
              S: generateSHA256HashOfFile(fullPath)
            },
            Sizediff: {
              N: fs.statSync(fullPath).size.toString()
            }
          }
        }
      }
    })
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`Directory ${patchDir} does not exist, no patches found.`)
    } else {
      throw err
    }
  }
  return patchList
}

const updateDBForCRXFile = (
  endpoint,
  region,
  crxFile,
  componentId,
  contentHash
) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  return unzip(crxFile, unzipDir).then(() => {
    const data = parseManifest(path.join(unzipDir, 'manifest.json'))
    const id = componentId || getIDFromBase64PublicKey(data.key)
    const version = data.version
    const hash = generateSHA256HashOfFile(crxFile)
    const name = data.name
    // DynamoDB expects numbers as strings
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.LowLevelAPI.html#Programming.LowLevelAPI.Numbers
    const size = fs.statSync(crxFile).size.toString()

    const patchList = getDiffPatchList(id, hash)

    return updateDynamoDB(
      endpoint,
      region,
      id,
      version,
      hash,
      name,
      false,
      contentHash,
      patchList,
      size
    )
      .then(() =>
        console.log(
          `Updated DB for ${crxFile}, ID: ${id}, hash: ${hash}, name: ${name}, size: ${size} bytes`
        )
      )
      .catch((err) => {
        console.log(`Updating DB for ${crxFile} is failed.`)
        throw err
      })
  })
}

// Update incrementVersion if this code is updated
const getPreviousVersion = (version, diff = 1) => {
  if (version === FirstVersion) {
    // This is the first version
    return FirstVersion
  }
  const versionParts = version.split('.')
  versionParts[versionParts.length - 1] -= diff
  return versionParts.join('.')
}

const uploadToS3 = async (file, bucket, key, contentType) => {
  const putObjectParams = {
    Body: await readFile(file),
    Bucket: bucket,
    Key: key,
    GrantFullControl: process.env.S3_CANONICAL_ID,
    GrantRead: process.env.CLOUDFRONT_CANONICAL_ID,
    ContentType: contentType
  }
  await s3Client.send(new PutObjectCommand(putObjectParams)).catch((err) => {
    console.error(`Upload failed for s3://${bucket}/${key}`)
    console.error(
      'Unable to upload:',
      err.stack,
      'Do you have ~/.aws/credentials filled out?'
    )
    throw new Error('Failed to upload extension to S3')
  })
}

const uploadExtension = async (name, id, version, hash, crxFile) => {
  const componentFilename = `extension_${version.replace(/\./g, '_')}.crx`
  const componentName = `${name.replace(/\s/g, '-')}`
  const previousComponentFilename = `extension_${getPreviousVersion(version).replace(/\./g, '_')}.crx`
  // See tag restrictions here: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html#tag-restrictions
  const componentNameTag = `${componentName.replace(/[^a-zA-Z0-9+\-=._:/@]+/g, '')}`
  const latestVersionTagKey = 'version'
  const latestVersionTagValue = `${componentNameTag}/latest`
  const patchDir = `build/patches/${id}/${hash}`
  await uploadToS3(
    crxFile,
    S3_EXTENSIONS_BUCKET,
    `release/${id}/${componentFilename}`,
    'application/x-chrome-extension'
  )
  console.log(
    `Uploaded component to s3://${S3_EXTENSIONS_BUCKET}/release/${id}/${componentFilename}`
  )

  const uploadJobs = []
  try {
    fs.readdirSync(patchDir).forEach((file) => {
      const fullPath = path.join(patchDir, file)
      const parsedPath = path.parse(fullPath)
      if (parsedPath.ext === '.puff') {
        uploadJobs.push(
          uploadToS3(
            fullPath,
            S3_EXTENSIONS_BUCKET,
            `release/${id}/patches/${hash}/${file}`,
            'application/octet-stream'
          ).then(() =>
            console.log(
              `Uploaded patch to s3://${S3_EXTENSIONS_BUCKET}/release/${id}/patches/${hash}/${file}`
            )
          )
        )
      }
    })
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`Directory ${patchDir} does not exist, no patches found.`)
    } else {
      throw err
    }
  }
  await Promise.all(uploadJobs)

  console.log(
    `Updating tag for ${componentName}: ${componentNameTag} = ${version}`
  )
  console.log(
    `Updating latest version tag for ${componentName}: ${latestVersionTagKey} = ${latestVersionTagValue}`
  )
  const putObjectTaggingParams = {
    Bucket: S3_EXTENSIONS_BUCKET,
    Key: `release/${id}/${componentFilename}`,
    Tagging: {
      TagSet: [
        {
          Key: `${componentNameTag}`,
          Value: `${version}`
        },
        {
          Key: 'version',
          Value: `${componentNameTag}/latest`
        }
      ]
    }
  }
  await s3Client
    .send(new PutObjectTaggingCommand(putObjectTaggingParams))
    .catch((err) => {
      console.error(
        `Tagging failed for ${id}/${componentFilename} with tag ${version}`
      )
      console.error(err, err.stack)
      throw new Error('Failed to upload extension to S3')
    })
  console.log(`Updated tags for ${id}/${componentFilename}`)

  // Proceed to update tag for previous version to remove its latest
  // release version tag.
  console.log(
    `Updating tag for ${componentName}: ${componentNameTag} = ${getPreviousVersion(version)}`
  )

  const headObjectParams = {
    Bucket: S3_EXTENSIONS_BUCKET,
    Key: `release/${id}/${previousComponentFilename}`
  }

  try {
    await s3Client.send(new HeadObjectCommand(headObjectParams))
  } catch (err) {
    if (err.name === 'NotFound') {
      // No need to update tags if the file doesn't exist
      return
    } else {
      console.error(
        `Unexpected error with HeadObject command for ${id}/${componentFilename} with tag ${version}`
      )
      console.error(err, err.stack)
      throw new Error('Unexpected error with HeadObject command')
    }
  }
  const putObjectTaggingParams2 = {
    Bucket: S3_EXTENSIONS_BUCKET,
    Key: `release/${id}/${previousComponentFilename}`,
    Tagging: {
      TagSet: [
        {
          Key: `${componentNameTag}`,
          Value: `${getPreviousVersion(version)}`
        }
      ]
    }
  }
  await s3Client
    .send(new PutObjectTaggingCommand(putObjectTaggingParams2))
    .catch((err) => {
      console.error(
        `Tagging failed for ${id}/${previousComponentFilename} with tag ${getPreviousVersion(version)}`
      )
      console.error(err, err.stack)
      throw new Error('Failed to upload extension to S3')
    })
  console.log(`Updated tags for ${id}/${previousComponentFilename}`)
}

const createDynamoDBInstance = (endpoint, region) => {
  const initParams = { region }
  if (endpoint) {
    initParams.endpoint = endpoint
  }
  return new DynamoDBClient(initParams)
}

const createTable = (endpoint, region) => {
  const dynamodb = createDynamoDBInstance(endpoint, region)
  const params = {
    TableName: DynamoDBTableName,
    AttributeDefinitions: [
      {
        AttributeName: 'ID',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'ID',
        KeyType: 'HASH'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }
  return dynamodb.send(new CreateTableCommand(params))
}

const createTableIfNotExists = (endpoint, region) => {
  const dynamodb = createDynamoDBInstance(endpoint, region)
  return dynamodb.send(new ListTablesCommand({})).then((data) => {
    const exists =
      data.TableNames.filter((name) => {
        return name === DynamoDBTableName
      }).length > 0
    if (exists) {
      return Promise.resolve()
    }
    return createTable(endpoint, region)
  })
}

const getNextVersion = (endpoint, region, id, contentHash) => {
  const dynamodb = createDynamoDBInstance(endpoint, region)
  const params = {
    ExpressionAttributeValues: {
      ':id': {
        S: id
      }
    },
    KeyConditionExpression: 'ID = :id',
    TableName: DynamoDBTableName
  }
  return dynamodb.send(new QueryCommand(params)).then((data) => {
    if (data.Items.length === 1 && data.Items[0].Version.S !== '') {
      if (
        data.Items[0].ContentHash !== undefined &&
        data.Items[0].ContentHash.S !== undefined &&
        data.Items[0].ContentHash.S === contentHash
      ) {
        // return no next version if the content hash matches the last cached value
        return undefined
      } else {
        return incrementVersion(data.Items[0].Version.S)
      }
    } else {
      return '1.0.0'
    }
  })
}

const updateDynamoDB = (
  endpoint,
  region,
  id,
  version,
  hash,
  name,
  disabled,
  contentHash,
  patchList,
  size
) => {
  const dynamodb = createDynamoDBInstance(endpoint, region)
  const params = {
    Item: {
      ID: {
        S: id
      },
      SHA256: {
        S: hash
      },
      Version: {
        S: version
      },
      Title: {
        S: name
      },
      Disabled: {
        BOOL: disabled
      },
      PatchList: {
        M: patchList
      },
      Size: {
        N: size
      }
    },
    ReturnConsumedCapacity: 'TOTAL',
    TableName: DynamoDBTableName
  }
  if (contentHash !== undefined) {
    params.Item.ContentHash = {
      S: contentHash
    }
  }
  return dynamodb.send(new PutItemCommand(params))
}

const addCommonScriptOptions = (command) => {
  return (
    command
      .option(
        '-b, --binary <binary>',
        'Path to the Chromium based executable to use to generate the CRX file'
      )
      .option(
        '-p, --publisher-proof-key <file>',
        'Private key for generating publisher proof'
      )
      .option(
        '-a, --publisher-proof-key-alt <file>',
        'Second private key for generating publisher proof. Useful when rotating keys.'
      )
      .option(
        '-vc, --verified-contents-key <file>',
        'Private key for generating verified_contents.json.'
      )

      // If setup locally, use  --endpoint http://localhost:8000
      .option(
        '-e, --endpoint <endpoint>',
        'DynamoDB endpoint to connect to',
        ''
      )
      .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
  )
}

const escapeStringForJSON = (str) => {
  if (typeof str !== 'string') {
    throw new Error('Not a string: ' + JSON.stringify(str))
  }
  return JSON.stringify(str).slice(1, -1)
}

const copyManifestWithVersion = (originalLocation, outputDir, version) => {
  const outputLocation = path.join(outputDir, 'manifest.json')
  const replaceOptions = {
    files: outputLocation,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalLocation, outputLocation)
  replace.sync(replaceOptions)
}

const stageDir = (
  resourceDir,
  manifestTemplateLocation,
  version,
  outputDir
) => {
  fs.copySync(resourceDir, outputDir)
  copyManifestWithVersion(manifestTemplateLocation, outputDir, version)
}

const stageFiles = (files, version, outputDir) => {
  mkdirp.sync(outputDir)

  let hasManifest = false

  for (let { path: inputPath, outputName } of files) {
    if (outputName === undefined) {
      outputName = path.parse(inputPath).base
    }

    if (outputName === 'manifest.json') {
      copyManifestWithVersion(inputPath, outputDir, version)
      hasManifest = true
    } else {
      fs.copyFileSync(inputPath, path.join(outputDir, outputName))
    }
  }

  if (!hasManifest) {
    throw new Error(
      'Missing manifest.json in output files: ' + JSON.stringify(files)
    )
  }
}

export default {
  fetchTextFromURL,
  createTableIfNotExists,
  fetchPreviousVersions,
  generateCRXFile,
  generatePuffPatches,
  generateSHA256Hash,
  generateSHA256HashOfFile,
  generateVersionedSHA256HashOfFile,
  getNextVersion,
  getIDFromBase64PublicKey,
  installErrorHandlers,
  parseManifest,
  uploadCRXFile,
  updateDBForCRXFile,
  addCommonScriptOptions,
  escapeStringForJSON,
  copyManifestWithVersion,
  stageDir,
  stageFiles,
  generateVerifiedContents,
  generateAndWriteVerifiedContents,
  s3capableFetch
}
