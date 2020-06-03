/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const request = require('request')
const s3 = require('s3-node-client')
const unzip = require('unzip-crx-3')
const AWS = require('aws-sdk')

const DynamoDBTableName = 'Extensions'
const FirstVersion = "1.0.0"

const downloadExtensionFromCWS = (componentId, chromiumVersion, outputPath) => {
  const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${chromiumVersion}&acceptformat=crx3&x=id%3D${componentId}%26uc`
  return new Promise((resolve, reject) => {
    request(url)
      .pipe(fs.createWriteStream(outputPath))
      .on('finish', () => {
        resolve()
      })
      .on('error', () => {
        reject(new Error('Failed to make request to Chrome Web Store'))
      })
  })
}

const generateCRXFile = (binary, crxFile, privateKeyFile, inputDir) => {
  const args = `--pack-extension=${path.resolve(inputDir)} --pack-extension-key=${path.resolve(privateKeyFile)}`
  const originalOutput = `${inputDir}.crx`
  childProcess.execSync(`${binary} ${args}`)
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
    const hash = generateSHA256HashOfFile(crxFile)
    const name = data.name

    return uploadExtension(name, id, version, crxFile)
      .then(() => console.log(`Uploaded ${crxFile}`))
      .catch((err) => {
        console.log(`Uploading ${crxFile} is failed.`)
        throw err
      })
  })
}

const updateDBForCRXFile = (endpoint, region, crxFile, componentId) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  return unzip(crxFile, unzipDir).then(() => {
    const data = parseManifest(path.join(unzipDir, 'manifest.json'))
    const id = componentId || getIDFromBase64PublicKey(data.key)
    const version = data.version
    const hash = generateSHA256HashOfFile(crxFile)
    const name = data.name

    return updateDynamoDB(endpoint, region, id, version, hash, name, false)
      .then(() => console.log(`Updated DB for ${crxFile}`))
      .catch((err) => {
        console.log(`Updating DB for ${crxFile} is failed.`)
        throw err
      })
  })
}

// Update incrementVersion if this code is updated
const getPreviousVersion = (version) => {
  if (version == FirstVersion) {
    // This is the first version
    return FirstVersion
  }
  const versionParts = version.split('.')
  versionParts[versionParts.length - 1]--
  return versionParts.join('.')
}

const uploadExtension = (name, id, version, crxFile) => {
  const S3_EXTENSIONS_BUCKET = process.env.S3_EXTENSIONS_BUCKET || 'brave-core-ext'
  // Using aws_s3 because s3-node-client does not support updating tags
  const aws_s3 = new AWS.S3();
  const client = s3.createClient({
    maxAsyncS3: 20,
    s3RetryCount: 3,
    s3RetryDelay: 1000,
    multipartUploadThreshold: 20971520,
    multipartUploadSize: 15728640,
    // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
    s3Options: {
      signatureVersion: 'v4'
    }
  })
  const componentFilename = `extension_${version.replace(/\./g, '_')}.crx`
  const componentName = `${name.replace(/\s/g, '-')}`
  const previousComponentFilename = `extension_${getPreviousVersion(version).replace(/\./g, '_')}.crx`
  //See tag restrictions here: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html#tag-restrictions
  const componentNameTag = `${componentName.replace(/[^a-zA-Z0-9\+\-=\.\_\:\/@]+/g, "")}`
  const latestVersionTag = `version=${componentNameTag}/latest`
  const tag = `${componentNameTag}=${version.replace(/\./g, '.')}&${latestVersionTag}`
  console.log(`Setting tag for ${componentName}: ${tag}`)
  return new Promise((resolve, reject) => {
    var params = {
      localFile: crxFile,
      // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
      s3Params: {
        Bucket: S3_EXTENSIONS_BUCKET,
        Key: `release/${id}/${componentFilename}`,
        ACL: 'public-read',
        Tagging: tag
      }
    }
    const uploader = client.uploadFile(params)
    uploader.on('error', (err) => {
      console.error(`Upload failed for ${id}/${componentFilename} with tag ${tag}`)
      console.error('Unable to upload:', err.stack, 'Do you have ~/.aws/credentials filled out?')
      reject(new Error('Failed to upload extension to S3'))
    })
    uploader.on('end', (params) => {
      console.log(`Updating tag for ${componentName}: ${componentNameTag}=${getPreviousVersion(version).replace(/\./g, '.')}`)
      if (version == FirstVersion) {
        // This is the first version we don't need to update tags for 
        // the previous version
        resolve()
        return
      }
      var params = {
        Bucket: S3_EXTENSIONS_BUCKET,
        Key: `release/${id}/${previousComponentFilename}`,
        Tagging: {
          TagSet: [
            {
              Key: `${componentNameTag}`,
              Value: `${getPreviousVersion(version).replace(/\./g, '.')}`
            }
          ]
        }
      }
      aws_s3.putObjectTagging(params, function(err, data) {
        if (err) {
          console.error(`Tagging failed for ${id}/${previousComponentFilename} with tag ${getPreviousVersion(version).replace(/\./g, '.')}`)
          console.error(err, err.stack)
          reject(new Error('Failed to upload extension to S3'))
        }
        console.log(`Updated tags for ${id}/${previousComponentFilename}`)
        resolve()
      })
    })
  })
}

const createDynamoDBInstance = (endpoint, region) => {
  const initParams = { region }
  if (endpoint) {
    initParams.endpoint = endpoint
  }
  return new AWS.DynamoDB(initParams)
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
  return dynamodb.createTable(params).promise()
}

const createTableIfNotExists = (endpoint, region) => {
  const dynamodb = createDynamoDBInstance(endpoint, region)
  return dynamodb.listTables({})
    .promise()
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

const getNextVersion = (endpoint, region, id) => {
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
  return dynamodb.query(params).promise().then((data) => {
    if (data.Items.length === 1 && data.Items[0].Version.S !== '') {
      return incrementVersion(data.Items[0].Version.S)
    } else {
      return '1.0.0'
    }
  })
}

const updateDynamoDB = (endpoint, region, id, version, hash, name, disabled) => {
  const dynamodb = createDynamoDBInstance(endpoint, region)
  const params = {
    Item: {
      'ID': {
        S: id
      },
      'SHA256': {
        S: hash
      },
      'Version': {
        S: version
      },
      'Title': {
        S: name
      },
      'Disabled': {
        BOOL: disabled
      }
    },
    ReturnConsumedCapacity: 'TOTAL',
    TableName: DynamoDBTableName
  }
  return dynamodb.putItem(params).promise()
}

module.exports = {
  createTableIfNotExists,
  downloadExtensionFromCWS,
  generateCRXFile,
  generateSHA256HashOfFile,
  getNextVersion,
  getIDFromBase64PublicKey,
  installErrorHandlers,
  parseManifest,
  uploadCRXFile,
  updateDBForCRXFile
}
