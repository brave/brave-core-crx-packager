/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const unzip = require('unzip-crx-3')
const AWS = require('aws-sdk')

const DynamoDBTableName = 'Extensions'

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

const uploadCRXFile = (endpoint, region, vaultUpdaterPath, crxFile) => {
  const unzipDir = path.join('build', 'unzip', path.parse(crxFile).name)

  mkdirp.sync(unzipDir)

  unzip(crxFile, unzipDir).then(() => {
    const manifest = path.join(unzipDir, 'manifest.json')
    const data = parseManifest(manifest)

    const id = getIDFromBase64PublicKey(data.key)
    const version = data.version
    const hash = generateSHA256HashOfFile(crxFile)
    const name = data.name

    updateDynamoDB(endpoint, region, id, version, hash, name, false).then(() => {
      const result = uploadExtension(vaultUpdaterPath, id, version, hash, name, crxFile)
      if (result) {
        console.log(result)
      }
    }).catch((err) => {
      throw err
    })

    console.log(`Uploaded ${crxFile}`)
  })
}

const uploadExtension = (vaultUpdaterPath, id, version, hash, name, crxFile) => {
  const script = path.join('node_modules', 'release-tools', 'bin', 'updateExtensions')

  let args = ''

  args += '--chromium 0.0.0.0 '
  args += `--id ${id} `
  args += `--location ${vaultUpdaterPath} `
  args += `--path ${crxFile} `
  args += `--version ${version} `
  args += '--v 0'

  process.env.S3_EXTENSIONS_BUCKET = 'brave-core-ext'
  return childProcess.execSync(`node ${script} ${args}`).toString()
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
  generateCRXFile,
  generateSHA256HashOfFile,
  getNextVersion,
  getIDFromBase64PublicKey,
  installErrorHandlers,
  parseManifest,
  uploadCRXFile,
  uploadExtension
}
