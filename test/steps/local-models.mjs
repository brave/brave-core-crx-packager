import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

Given('a fresh working directory for model downloads', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-models-'))
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(dir)
  this.sandbox = dir
  this.recordPath = path.join(dir, 'git-record.jsonl')
  process.env.CRX_PACKAGER_RECORD = this.recordPath
  this.savedCwd = process.cwd()
  process.chdir(dir)
})

function readGitArgv (world) {
  return fs.readFileSync(world.recordPath, 'utf8').trim().split('\n').filter(Boolean)
    .map(JSON.parse).filter(entry => entry.bin === 'git').map(entry => entry.argv.join(' '))
}

When('{string} is downloaded with sparse checkout path {string}', async function (targetDir, sparsePath) {
  const downloader = await import('../../lib/localModelsDownloader.js')
  downloader.downloadLocalModels({ targetDir, sparseCheckoutPath: sparsePath })
})

When('{string} is downloaded with renames model.gguf: weights-renamed.gguf', async function (targetDir) {
  const downloader = await import('../../lib/localModelsDownloader.js')
  downloader.downloadLocalModels({
    targetDir,
    sparseCheckoutPath: 'embeddinggemma-300m',
    renames: { 'model.gguf': 'weights-renamed.gguf' }
  })
})

When('the model download is attempted for {string}', async function (targetDir) {
  const downloader = await import('../../lib/localModelsDownloader.js')
  downloader.downloadLocalModels({ targetDir, sparseCheckoutPath: 'embeddinggemma-300m' })
})

Then('git was invoked as {string}', function (expected) {
  const invocations = readGitArgv(this)
  expect(invocations, JSON.stringify(invocations)).to.include(expected)
})

Then('the file {string} contains {string}', function (file, content) {
  expect(fs.readFileSync(file, 'utf8')).to.equal(content)
})

Then('the file {string} exists', function (file) {
  expect(fs.existsSync(file)).to.equal(true)
})

Then('the file {string} does not exist', function (file) {
  expect(fs.existsSync(file)).to.equal(false)
})

Given('the git shim fails for {string}', function (fragment) {
  process.env.CRX_PACKAGER_GIT_FAIL = fragment
})

Then('the process exited with code {int}', function (code) {
  expect(mockState().scripts.exitCalls).to.deep.equal([code])
})

Then('the temp directory {string} no longer exists', function (tempDir) {
  expect(fs.existsSync(tempDir)).to.equal(false)
})

After(function () {
  if (this.savedCwd) {
    process.chdir(this.savedCwd)
    this.savedCwd = null
  }
  delete process.env.CRX_PACKAGER_GIT_FAIL
})
