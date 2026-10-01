import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let util
let commander

async function loadUtil () {
  if (!util) util = (await import('../../lib/util.js')).default
  return util
}

function freshTmp (world) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'util-staging-'))
  world.tmpDirs = world.tmpDirs || []
  world.tmpDirs.push(dir)
  world.tmp = dir
  return dir
}

Given('a manifest file containing:', async function (doc) {
  await loadUtil()
  freshTmp(this)
  this.manifestFile = path.join(this.tmp, 'manifest.json')
  fs.writeFileSync(this.manifestFile, doc)
})

Given('a manifest file with version {string}', async function (_version) {
  await loadUtil()
  freshTmp(this)
  this.manifestFile = path.join(this.tmp, 'manifest.json')
  fs.writeFileSync(this.manifestFile, JSON.stringify({ name: 'component', version: '0.0.0' }))
})

Given('a resource directory with files {string} and {string}', async function (fileA, fileB) {
  await loadUtil()
  freshTmp(this)
  fs.mkdirSync(path.join(this.tmp, 'resource', path.dirname(fileB)), { recursive: true })
  fs.writeFileSync(path.join(this.tmp, 'resource', fileA), 'a-data')
  fs.writeFileSync(path.join(this.tmp, 'resource', fileB), 'nested-data')
  this.resourceDir = path.join(this.tmp, 'resource')
})

Given('a staged file set of {string} as {string} plus {string}', async function (fileA, outputName, fileB) {
  await loadUtil()
  freshTmp(this)
  fs.writeFileSync(path.join(this.tmp, fileA), 'a-js')
  fs.writeFileSync(path.join(this.tmp, fileB), JSON.stringify({ name: 'staged', version: '0.0.0' }))
  this.stageFilesArg = [
    { path: path.join(this.tmp, fileA), outputName },
    { path: path.join(this.tmp, fileB) }
  ]
})

Given('a lone staged file {string} without a manifest', async function (file) {
  await loadUtil()
  freshTmp(this)
  fs.writeFileSync(path.join(this.tmp, file), 'a-js')
  this.stageFilesArg = [{ path: path.join(this.tmp, file) }]
})

When('the manifest is parsed', async function () {
  this.parsed = util.parseManifest(this.manifestFile)
})

When('the manifest is copied to an output dir with version {string}', async function (version) {
  this.outputDir = path.join(this.tmp, 'out')
  fs.mkdirSync(this.outputDir, { recursive: true })
  util.copyManifestWithVersion(this.manifestFile, this.outputDir, version)
})

When('the resource directory is staged with version {string}', async function (version) {
  this.outputDir = path.join(this.tmp, 'staging')
  fs.writeFileSync(path.join(this.tmp, 'manifest-template.json'), JSON.stringify({ name: 'staged', version: '0.0.0' }))
  util.stageDir(this.resourceDir, path.join(this.tmp, 'manifest-template.json'), version, this.outputDir)
})

When('the files are staged with version {string}', async function (version) {
  this.outputDir = path.join(this.tmp, 'staged-files')
  util.stageFiles(this.stageFilesArg, version, this.outputDir)
})

When('staging is attempted with version {string}', async function (version) {
  this.outputDir = path.join(this.tmp, 'staged-files')
  try {
    util.stageFiles(this.stageFilesArg, version, this.outputDir)
    this.stageError = null
  } catch (error) {
    this.stageError = error
  }
})

When('a string with quotes, backslashes and newlines is escaped for JSON', async function () {
  await loadUtil()
  this.escapedInput = 'say "hi"\n\\backslash\ttab'
  this.escaped = util.escapeStringForJSON(this.escapedInput)
})

When('the number {int} is escaped for JSON', async function (value) {
  await loadUtil()
  try {
    this.escaped = util.escapeStringForJSON(value)
    this.escapeError = null
  } catch (error) {
    this.escapeError = error
  }
})

When('the common script options are parsed from {string}', async function (args) {
  await loadUtil()
  commander = (await import('commander')).default
  const command = new commander.Command()
  util.addCommonScriptOptions(command)
  command.parse(['node', 'script', ...args.split(' ').filter(Boolean)], { from: 'user' })
  this.cliOptions = command.opts()
})

When('the common script options are parsed from no arguments', async function () {
  await loadUtil()
  commander = (await import('commander')).default
  const command = new commander.Command()
  util.addCommonScriptOptions(command)
  command.parse(['node', 'script'], { from: 'user' })
  this.cliOptions = command.opts()
})

Then('the parsed name is {string}', function (value) {
  expect(this.parsed.name).to.equal(value)
})

Then('the parsed version is {string}', function (value) {
  expect(this.parsed.version).to.equal(value)
})

Then('the copied manifest declares version {string}', function (version) {
  const copied = JSON.parse(fs.readFileSync(path.join(this.outputDir, 'manifest.json'), 'utf8'))
  expect(copied.version).to.equal(version)
})

Then('the staging output contains the files:', function (doc) {
  for (const file of doc.split('\n').map(line => line.trim()).filter(Boolean)) {
    expect(fs.existsSync(path.join(this.outputDir, file)), file).to.equal(true)
  }
})

Then('the staged manifest declares version {string}', function (version) {
  const staged = JSON.parse(fs.readFileSync(path.join(this.outputDir, 'manifest.json'), 'utf8'))
  expect(staged.version).to.equal(version)
})

Then('the staging fails with {string}', function (fragment) {
  expect(this.stageError).to.be.an('error')
  expect(this.stageError.message).to.include(fragment)
})

Then('the escaped output round-trips through JSON.parse', function () {
  const roundTripped = JSON.parse(`"${this.escaped}"`)
  expect(roundTripped).to.equal(this.escapedInput)
})

Then('the escaping fails with {string}', function (fragment) {
  expect(this.escapeError).to.be.an('error')
  expect(this.escapeError.message).to.include(fragment)
})

Then('the parsed binary is {string}', function (value) {
  expect(this.cliOptions.binary).to.equal(value)
})

Then('the parsed publisher proof key is {string}', function (value) {
  expect(this.cliOptions.publisherProofKey).to.equal(value)
})

Then('the parsed alt publisher proof key is {string}', function (value) {
  expect(this.cliOptions.publisherProofKeyAlt).to.equal(value)
})

Then('the parsed verified contents key is {string}', function (value) {
  expect(this.cliOptions.verifiedContentsKey).to.equal(value)
})

Then('the parsed endpoint is {string}', function (value) {
  expect(this.cliOptions.endpoint).to.equal(value)
})

Then('the parsed region is {string}', function (value) {
  expect(this.cliOptions.region).to.equal(value)
})
