/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import childProcess from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import { readFile } from 'node:fs/promises'
import mkdirp from 'mkdirp'
import path from 'path'
import unzip from 'unzip-crx-3'
import { DynamoDBClient, CreateTableCommand, ListTablesCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { S3Client, HeadObjectCommand, PutObjectCommand, PutObjectTaggingCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { finished } from 'stream/promises'

const DynamoDBTableName = 'Extensions'
const FirstVersion = '1.0.0'

const s3_client = new S3Client({
  signatureVersion: 'v4',
  endpoint: process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT : undefined,
  forcePathStyle: process.env.S3_ENDPOINT ? true : false
})

/**
 * Returns a promise that resolves with the URL's body text data.
 * The request will be retried several times if necessary.
 *
 * @param listURL The URL of the list to fetch
 * @return a promise that resolves with the content of the list or rejects with an error message.
 */
const fetchTextFromURL = (listURL) => {
  const attempt = () => fetch(listURL).then(response => {
    if (response.status !== 200) {
      throw new Error(`Error status ${response.status} ${response.statusText} returned for URL: ${listURL}`)
    }
    return response.text()
  }).catch(error => {
    throw new Error(`Error when fetching ${listURL}: ${error.message}`)
  })

  // Introduces a delayed rejection into a promise chain so that request retries can be caught in a loop until a request succeeds
  const delayReject = (ms) => {
    return (reason) => new Promise((_resolve, reject) => setTimeout(() => {
      console.log(`Spurious error: ${reason.message}`)
      console.log('  (retrying...)')
      reject(reason)
    }, ms))
  }

  const maxAttempts = 5
  const delayMs = 3000

  let p = Promise.reject(new Error())

  for (let i = 0; i < maxAttempts; i++) {
    p = p.catch(attempt).catch(delayReject(delayMs))
  }

  return p
}

const downloadExtensionFromCWS = async (componentId, chromiumVersion, outputPath) => {
  const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${chromiumVersion}&acceptformat=crx3&x=id%3D${componentId}%26uc`
  const response = await fetch(url)
  const ws = fs.createWriteStream(outputPath)
  return finished(Readable.fromWeb(response.body).pipe(ws))
}

const generateCRXFile = (binary, crxFile, privateKeyFile, publisherProofKey,
  inputDir) => {
  if (!binary) {
    throw new Error('Missing Brave binary: --binary')
  }
  if (!publisherProofKey) {
    throw new Error('Missing --publisher-proof-key <file>')
  }
  if (!fs.existsSync(path.resolve(privateKeyFile))) {
    throw new Error(`Private key file '${privateKeyFile}' is missing, was it uploaded?`)
  }
  const args = [
    `--pack-extension=${path.resolve(inputDir)}`,
    `--pack-extension-key=${path.resolve(privateKeyFile)}`,
    `--brave-extension-publisher-key=${path.resolve(publisherProofKey)}`]
  const originalOutput = `${inputDir}.crx`
  childProcess.execSync(`${binary} ${args.join(' ')}`)
  fs.renameSync(originalOutput, crxFile)
}

const generateSHA256Hash = (data) => {
  const hash = crypto.createHash('sha256')
  return hash.update(data).digest('hex')
}

const generateSHA256HashOfFile = (file) => {
  return generateSHA256Hash(fs.readFileSync(file))
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
  const json = fs.readFileSync(manifestFile).toString('utf-8').replace(/\/\/#.*/g, '')
  return JSON.parse(json)
}

const uploadCRXFile = (endpoint, region, crxFile, componentId) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  return unzip(crxFile, unzipDir).then(() => {
    const data = parseManifest(path.join(unzipDir, 'manifest.json'))
    const id = componentId || getIDFromBase64PublicKey(data.key)
    const version = data.version
    const name = data.name

    return uploadExtension(name, id, version, crxFile)
      .then(() => console.log(`Uploaded ${crxFile}`))
      .catch((err) => {
        console.log(`Uploading ${crxFile} is failed.`)
        throw err
      })
  })
}

const updateDBForCRXFile = (endpoint, region, crxFile, componentId, contentHash) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  return unzip(crxFile, unzipDir).then(() => {
    const data = parseManifest(path.join(unzipDir, 'manifest.json'))
    const id = componentId || getIDFromBase64PublicKey(data.key)
    const version = data.version
    const hash = generateSHA256HashOfFile(crxFile)
    const name = data.name

    return updateDynamoDB(endpoint, region, id, version, hash, name, false, contentHash)
      .then(() => console.log(`Updated DB for ${crxFile}, ID: ${id}, hash: ${hash}, name: ${name}`))
      .catch((err) => {
        console.log(`Updating DB for ${crxFile} is failed.`)
        throw err
      })
  })
}

// Update incrementVersion if this code is updated
const getPreviousVersion = (version) => {
  if (version === FirstVersion) {
    // This is the first version
    return FirstVersion
  }
  const versionParts = version.split('.')
  versionParts[versionParts.length - 1]--
  return versionParts.join('.')
}

const uploadExtension = async (name, id, version, crxFile) => {
  const S3_EXTENSIONS_BUCKET = process.env.S3_EXTENSIONS_BUCKET || 'brave-core-ext'
  const componentFilename = `extension_${version.replace(/\./g, '_')}.crx`
  const componentName = `${name.replace(/\s/g, '-')}`
  const previousComponentFilename = `extension_${getPreviousVersion(version).replace(/\./g, '_')}.crx`
  // See tag restrictions here: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html#tag-restrictions
  const componentNameTag = `${componentName.replace(/[^a-zA-Z0-9+\-=._:/@]+/g, '')}`
  const latestVersionTagKey = 'version'
  const latestVersionTagValue = `${componentNameTag}/latest`
  const putObjectParams = {
    Body: await readFile(crxFile),
    Bucket: S3_EXTENSIONS_BUCKET,
    Key: `release/${id}/${componentFilename}`,
    GrantFullControl: process.env.S3_CANONICAL_ID,
    GrantRead: process.env.CLOUDFRONT_CANONICAL_ID,
    ContentType: 'application/x-chrome-extension'
  }
  await s3_client.send(new PutObjectCommand(putObjectParams))
    .catch(err => {
      console.error(`Upload failed for s3://${S3_EXTENSIONS_BUCKET}/${id}/${componentFilename}`)
      console.error('Unable to upload:', err.stack, 'Do you have ~/.aws/credentials filled out?')
      throw new Error('Failed to upload extension to S3')
    })
  console.log(`Uploaded component to s3://${S3_EXTENSIONS_BUCKET}/${id}/${componentFilename}`)
  console.log(`Updating tag for ${componentName}: ${componentNameTag} = ${version}`)
  console.log(`Updating latest version tag for ${componentName}: ${latestVersionTagKey} = ${latestVersionTagValue}`)
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
  await s3_client.send(new PutObjectTaggingCommand(putObjectTaggingParams))
    .catch(err => {
      console.error(`Tagging failed for ${id}/${componentFilename} with tag ${version}`)
      console.error(err, err.stack)
      throw new Error('Failed to upload extension to S3')
    })
  console.log(`Updated tags for ${id}/${componentFilename}`)

  // Proceed to update tag for previous version to remove its latest
  // release version tag.
  console.log(`Updating tag for ${componentName}: ${componentNameTag} = ${getPreviousVersion(version)}`)

  const headObjectParams = {
    Bucket: S3_EXTENSIONS_BUCKET,
    Key: `release/${id}/${previousComponentFilename}`
  }

  try {
    await s3_client.send(new HeadObjectCommand(headObjectParams))
  } catch (err) {
    if (err.code === 'NotFound') {
      // No need to update tags if the file doesn't exist
      return
    } else {
      console.error(`Unexpected error with HeadObject command for ${id}/${componentFilename} with tag ${version}`)
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
  await s3_client.send(new PutObjectTaggingCommand(putObjectTaggingParams2))
    .catch(err => {
      console.error(`Tagging failed for ${id}/${previousComponentFilename} with tag ${getPreviousVersion(version)}`)
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
    AttributeDefinitions: [{
      AttributeName: 'ID',
      AttributeType: 'S'
    }],
    KeySchema: [{
      AttributeName: 'ID',
      KeyType: 'HASH'
    }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }
  return dynamodb.send(new CreateTableCommand(params))
}

const createTableIfNotExists = (endpoint, region) => {
  const dynamodb = createDynamoDBInstance(endpoint, region)
  return dynamodb.send(new ListTablesCommand({}))
    .then((data) => {
      const exists = data.TableNames.filter(name => {
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
      if (data.Items[0].ContentHash !== undefined && data.Items[0].ContentHash.S !== undefined && data.Items[0].ContentHash.S === contentHash) {
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

const updateDynamoDB = (endpoint, region, id, version, hash, name, disabled, contentHash) => {
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
  return command
    .option('-b, --binary <binary>',
      'Path to the Chromium based executable to use to generate the CRX file')
    .option('-p, --publisher-proof-key <file>',
      'File containing private key for generating publisher proof')

    // If setup locally, use  --endpoint http://localhost:8000
    .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')
    .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
}

export default {
  fetchTextFromURL,
  createTableIfNotExists,
  downloadExtensionFromCWS,
  generateCRXFile,
  generateSHA256HashOfFile,
  getNextVersion,
  getIDFromBase64PublicKey,
  installErrorHandlers,
  parseManifest,
  uploadCRXFile,
  updateDBForCRXFile,
  addCommonScriptOptions
}
