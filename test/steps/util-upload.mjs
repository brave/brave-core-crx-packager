import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { mockState } from '../support/state.mjs'

let util

async function loadUtil () {
  if (!util) util = (await import('../../lib/util.js')).default
  return util
}

// Builds a signed fixture CRX with the pure-JS packager (fast 512-bit
// test key). The manifest carries name, version and the injected key.
async function buildFixtureCrx (world, { version, name, locales }) {
  await loadUtil()
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'util-upload-'))
  world.tmpDirs.push(stagingDir)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  const extensionKeyFile = path.join(stagingDir, 'extension-key.pem')
  fs.writeFileSync(extensionKeyFile, privateKey)
  const manifest = {
    name: name || 'My Component',
    version,
    key: publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  }
  if (locales) {
    fs.mkdirSync(path.join(stagingDir, '_locales', locales.locale), { recursive: true })
    fs.writeFileSync(
      path.join(stagingDir, '_locales', locales.locale, 'messages.json'),
      JSON.stringify({ [locales.messageKey]: { message: locales.message } })
    )
  }
  fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest))
  const crx = (await import('../../lib/crx.js')).default
  const result = await crx.generateCrx(stagingDir, extensionKeyFile, [], undefined)
  const crxTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'util-upload-crx-'))
  world.tmpDirs.push(crxTmp)
  world.crxFile = path.join(crxTmp, 'fixture.crx')
  fs.writeFileSync(world.crxFile, result.crx)
  world.componentId = util.getIDFromBase64PublicKey(manifest.key)
  world.crxHash = util.generateSHA256Hash(result.crx)
  world.fixtureStagingDir = stagingDir
  world.extensionKeyFile = extensionKeyFile
  return { stagingDir, extensionKeyFile }
}

Given('a staged extension directory with a generated key', async function () {
  await loadUtil()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'util-upload-'))
  this.tmpDirs.push(dir)
  this.tmp = dir
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  this.stagingDir = path.join(dir, 'staging')
  fs.mkdirSync(this.stagingDir)
  fs.writeFileSync(path.join(this.stagingDir, 'manifest.json'), JSON.stringify({ name: 'component', version: '0.0.0' }))
  fs.writeFileSync(path.join(this.stagingDir, 'file1.js'), 'file1')
  this.privateKeyFile = path.join(dir, 'key.pem')
  fs.writeFileSync(this.privateKeyFile, privateKey)
  this.recordPath = path.join(dir, 'chrome-record.jsonl')
  process.env.CRX_PACKAGER_RECORD = this.recordPath
  // signed fixture CRX (version 2.3.4, name "My Component") used by the
  // upload / previous-versions / patch scenarios
  const fixture = await buildFixtureCrx(this, { version: '2.3.4', name: 'My Component' })
  this.fixtureStagingDir = fixture.stagingDir
})

Given('two puff patches exist for the fixture hash', async function () {
  const patchDir = path.join('build', 'patches', this.componentId, this.crxHash)
  fs.mkdirpSync(patchDir)
  fs.writeFileSync(path.join(patchDir, 'extension_2_3_3.puff'), 'puff-one')
  fs.writeFileSync(path.join(patchDir, 'extension_2_3_2.puff'), 'puff-two')
})

Given('two puff patch files exist under the fixture patch dir', async function () {
  const patchDir = path.join('build', 'patches', this.componentId, this.crxHash)
  fs.mkdirpSync(patchDir)
  fs.writeFileSync(path.join(patchDir, 'extension_2_3_3.puff'), 'puff-one')
  fs.writeFileSync(path.join(patchDir, 'extension_2_3_2.puff'), 'puff-two')
})

Given('a previous CRX file {string} under {string}', async function (filename, dirTemplate) {
  const dir = dirTemplate.replace('<id>', this.componentId)
  fs.mkdirpSync(dir)
  fs.writeFileSync(path.join(dir, filename), 'previous-crx-bytes')
})

Given('the staged extension uses the localized name placeholder {string} with locale {string} message {string}', async function (placeholder, locale, message) {
  // rebuild fixture with localized manifest
  const manifestPath = path.join(this.fixtureStagingDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  manifest.name = placeholder
  manifest.default_locale = locale
  fs.mkdirSync(path.join(this.fixtureStagingDir, '_locales', locale), { recursive: true })
  fs.writeFileSync(
    path.join(this.fixtureStagingDir, '_locales', locale, 'messages.json'),
    JSON.stringify({ extName: { message } })
  )
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  const result = await (await import('../../lib/crx.js')).default.generateCrx(this.fixtureStagingDir, this.extensionKeyFile, [], undefined)
  fs.writeFileSync(this.crxFile, result.crx)
  this.crxHash = util.generateSHA256Hash(result.crx)
})

When('the CRX file is generated with binary {string} into {string} with alt key', async function (binary, outTemplate) {
  await attemptGenerate(this, binary, outTemplate, { publisherProofKey: 'proof.pem', publisherProofKeyAlt: this.privateKeyFile })
})

When('the CRX file is generated with binary {string} into {string}', async function (binary, outTemplate) {
  await attemptGenerate(this, binary, outTemplate, { publisherProofKey: 'proof.pem' })
})

When('the CRX file is generated with binary {string} into {string} without alt key', async function (binary, outTemplate) {
  await attemptGenerate(this, binary, outTemplate, { publisherProofKey: 'proof.pem' })
})

When('the CRX file is generated with binary {string} without a publisher proof key', async function (binary) {
  await attemptGenerate(this, binary, '<tmp>/out.crx', {})
})

When('the CRX file is generated with binary {string} and a nonexistent private key', async function (binary) {
  await attemptGenerate(this, binary, '<tmp>/out.crx', { publisherProofKey: 'proof.pem', privateKeyFile: '/nonexistent/key.pem' })
})

When('the CRX file is generated with binary {string} and a nonexistent alt key', async function (binary) {
  await attemptGenerate(this, binary, '<tmp>/out.crx', { publisherProofKey: 'proof.pem', publisherProofKeyAlt: '/nonexistent/alt.pem' })
})

async function attemptGenerate (world, binary, outTemplate, options) {
  await loadUtil()
  const crxFile = outTemplate.replace('<tmp>', world.tmp)
  world.outCrxPath = crxFile
  try {
    util.generateCRXFile(
      binary,
      crxFile,
      options.privateKeyFile || world.privateKeyFile,
      options.publisherProofKey,
      options.publisherProofKeyAlt,
      world.stagingDir
    )
    world.generateError = null
  } catch (error) {
    world.generateError = error
  }
}

When('the CRX file {string} is uploaded with endpoint {string} region {string} and no patches on S3', async function (version, endpoint, region) {
  // previous version object absent from S3 -> only one tagging pass
  mockState().s3.replies.HeadObjectCommand = { error: Object.assign(new Error('NotFound'), { name: 'NotFound' }) }
  await uploadFixture(this, endpoint, region)
})

When('the CRX file {string} is uploaded with the previous version {string} present', async function (version, prevVersion) {
  mockState().s3.replies.HeadObjectCommand = { value: { ContentLength: 1 } }
  await uploadFixture(this, 'http://e', 'us-west-2')
})

When('the CRX file {string} is uploaded', async function (_version) {
  await uploadFixture(this, 'http://e', 'us-west-2')
})

async function uploadFixture (world, endpoint, region) {
  try {
    await util.uploadCRXFile(endpoint, region, world.crxFile)
    world.uploadError = null
  } catch (error) {
    world.uploadError = error
  }
}

When('the S3 PutObject rejects with {string}', function (reason) {
  mockState().s3.replies.PutObjectCommand = { error: Object.assign(new Error(reason), { name: reason }) }
})

When('the DB is updated for the CRX file {string} with content hash {string}', async function (version, contentHash) {
  try {
    await util.updateDBForCRXFile('http://e', 'us-west-2', this.crxFile, undefined, contentHash)
    this.dbError = null
  } catch (error) {
    this.dbError = error
  }
})

When('the previous {int} versions of the CRX file {string} are fetched', async function (num, version) {
  const bodies = ['body-1', 'body-2']
  mockState().s3.replies.GetObjectCommand = { value: () => ({ Body: Readable.from([Buffer.from(bodies.shift() || 'body-x')]) }) }
  try {
    await util.fetchPreviousVersions(this.crxFile, undefined, num)
    this.prevFetchError = null
  } catch (error) {
    this.prevFetchError = error
  }
})

When('the S3 GetObject rejects with {string}', function (reason) {
  mockState().s3.replies.GetObjectCommand = { error: Object.assign(new Error(reason), { name: reason }) }
})

When('the puff patches are generated', async function () {
  this.patchJobs = await util.generatePuffPatches(this.crxFile)
})

When('verified contents are generated and written for the fixture staging dir', async function () {
  this.vcResult = util.generateAndWriteVerifiedContents(this.fixtureStagingDir, ['**'], this.extensionKeyFile)
})

Then('chrome received a {string} argument for the staging dir', function (flag) {
  const records = readRecords(this.recordPath)
  const packArg = records.flatMap(entry => entry.argv).find(arg => arg.startsWith(flag))
  expect(packArg).to.equal(`--pack-extension=${path.resolve(this.stagingDir)}`)
})

Then('chrome received {string} and {string}', function (flagA, flagB) {
  const args = readRecords(this.recordPath).flatMap(entry => entry.argv)
  expect(args.some(arg => arg.startsWith(flagA))).to.equal(true)
  expect(args.some(arg => arg.startsWith(flagB))).to.equal(true)
})

Then('chrome received {string}', function (flag) {
  const args = readRecords(this.recordPath).flatMap(entry => entry.argv)
  expect(args.some(arg => arg.startsWith(flag))).to.equal(true)
})

Then('chrome never received {string}', function (flag) {
  const args = readRecords(this.recordPath).flatMap(entry => entry.argv)
  expect(args.some(arg => arg.startsWith(flag))).to.equal(false)
})

Then('the CRX output exists at {string} containing the staged manifest', async function (outTemplate) {
  expect(this.generateError).to.equal(null)
  expect(fs.existsSync(this.outCrxPath)).to.equal(true)
  const zip = await (await import('jszip')).default.loadAsync(fs.readFileSync(this.outCrxPath))
  const manifest = JSON.parse(await zip.files['manifest.json'].async('text'))
  expect(manifest.version).to.equal('0.0.0')
})

Then('the generation fails with {string}', function (fragment) {
  expect(this.generateError).to.be.an('error')
  expect(this.generateError.message).to.include(fragment)
})

Then('the S3 PutObject targeted {string} with content type {string}', function (keyTemplate, contentType) {
  const key = keyTemplate.replace('<id>', this.componentId)
  const puts = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectCommand')
  const target = puts.find(call => call.input.Key === key)
  expect(target, JSON.stringify(puts)).to.not.equal(undefined)
  expect(target.input.ContentType).to.equal(contentType)
  expect(target.input.Bucket).to.equal('brave-core-ext')
})

Then('the PutObjectTagging tagged the component with version {string} and latest tag', function (version) {
  const tagCalls = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectTaggingCommand')
  expect(tagCalls).to.have.lengthOf(1)
  const tags = tagCalls[0].input.Tagging.TagSet
  expect(tags).to.deep.include({ Key: 'My-Component', Value: version })
  expect(tags).to.deep.include({ Key: 'version', Value: 'My-Component/latest' })
})

Then('the S3 HeadObject targeted {string}', function (keyTemplate) {
  const key = keyTemplate.replace('<id>', this.componentId)
  const headCalls = mockState().s3.sendCalls.filter(call => call.command === 'HeadObjectCommand')
  expect(headCalls).to.have.lengthOf(1)
  expect(headCalls[0].input.Key).to.equal(key)
})

Then('only {int} PutObjectTagging command was sent', function (count) {
  const tagCalls = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectTaggingCommand')
  expect(tagCalls).to.have.lengthOf(count)
})

Then('the previous version was re-tagged with its own version', function () {
  const tagCalls = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectTaggingCommand')
  expect(tagCalls).to.have.lengthOf(2)
  expect(tagCalls[1].input.Tagging.TagSet).to.deep.equal([{ Key: 'My-Component', Value: '2.3.3' }])
})

Then('the S3 PutObject uploaded {int} objects including {int} patches as {string}', function (total, patches, patchContentType) {
  const puts = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectCommand')
  expect(puts).to.have.lengthOf(total)
  const patchPuts = puts.filter(call => call.input.Key.includes('/patches/'))
  expect(patchPuts).to.have.lengthOf(patches)
  for (const put of patchPuts) {
    expect(put.input.ContentType).to.equal(patchContentType)
  }
})

Then('the tagging recorded the component name {string}', function (componentName) {
  const tagCalls = mockState().s3.sendCalls.filter(call => call.command === 'PutObjectTaggingCommand')
  expect(tagCalls[0].input.Tagging.TagSet[0].Key).to.equal(componentName)
})

Then('the PutItem stored the component id with hash, size and {int} patch entries', function (patchCount) {
  const putCalls = mockState().dynamodb.sendCalls.filter(call => call.command === 'PutItemCommand')
  expect(putCalls).to.have.lengthOf(1)
  const item = putCalls[0].input.Item
  expect(item.ID.S).to.equal(this.componentId)
  expect(item.SHA256.S).to.equal(this.crxHash)
  expect(item.ContentHash.S).to.equal('content-1')
  expect(Number(item.Size.N)).to.be.at.least(1)
  expect(Object.keys(item.PatchList.M)).to.have.lengthOf(patchCount)
})

Then('{int} GetObject commands targeted {string} and {string}', function (count, keyTemplateA, keyTemplateB) {
  const gets = mockState().s3.sendCalls.filter(call => call.command === 'GetObjectCommand')
  expect(gets).to.have.lengthOf(count)
  const keys = gets.map(call => call.input.Key)
  expect(keys).to.include(keyTemplateA.replace('<id>', this.componentId))
  expect(keys).to.include(keyTemplateB.replace('<id>', this.componentId))
})

Then('{int} hash-named .crx files exist under {string}', function (count, dirTemplate) {
  const dir = dirTemplate.replace('<id>', this.componentId)
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.crx'))
  expect(files).to.have.lengthOf(count)
  for (const file of files) {
    const hash = file.replace('.crx', '')
    const body = fs.readFileSync(path.join(dir, file))
    expect(util.generateSHA256Hash(body)).to.equal(hash)
  }
})

Then('the fetch of previous versions succeeds', function () {
  expect(this.prevFetchError).to.equal(null)
})

Then('{int} patch job is returned', function (count) {
  expect(this.patchJobs).to.have.lengthOf(count)
})

Then('running the job invokes puffin with {string} for the previous CRX and the fixture CRX', async function (flag) {
  this.puffRecordPath = path.join(this.tmp, 'puff-record.jsonl')
  fs.writeFileSync(this.puffRecordPath, '')
  process.env.CRX_PACKAGER_RECORD = this.puffRecordPath
  await this.patchJobs[0]()
  const records = fs.readFileSync(this.puffRecordPath, 'utf8').trim().split('\n').map(JSON.parse)
  expect(records).to.have.lengthOf(1)
  expect(records[0].argv[0]).to.equal(flag)
  expect(records[0].argv[1]).to.equal(path.resolve(path.join('build', 'previous', this.componentId, 'extension_2_3_3.crx')))
  expect(records[0].argv[2]).to.equal(path.resolve(this.crxFile))
})

Then('the upload fails with {string}', function (_message) {
  expect(this.uploadError).to.be.an('error')
  expect(this.uploadError.message).to.equal('Failed to upload extension to S3')
})

Then('{string} exists with the component item id', function (metadataPath) {
  const metadataFile = path.join(this.fixtureStagingDir, metadataPath)
  expect(fs.existsSync(metadataFile)).to.equal(true)
  const verifiedContents = JSON.parse(fs.readFileSync(metadataFile, 'utf8'))
  const payload = JSON.parse(Buffer.from(verifiedContents[0].signed_content.payload, 'base64url').toString())
  expect(payload.item_id).to.equal(this.componentId)
})

function readRecords (recordPath) {
  return fs.readFileSync(recordPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
}
