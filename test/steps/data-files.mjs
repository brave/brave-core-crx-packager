import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

let psst
let webMcp
let leo
let asr

function freshSandbox (world) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-files-'))
  world.tmpDirs = world.tmpDirs || []
  world.tmpDirs.push(dir)
  world.recordPath = path.join(dir, 'shim-record.jsonl')
  process.env.CRX_PACKAGER_RECORD = world.recordPath
  world.savedCwd = process.cwd()
  process.chdir(dir)
}

function readRecordArgv (world, bin) {
  return fs.readFileSync(world.recordPath, 'utf8').trim().split('\n').filter(Boolean)
    .map(JSON.parse).filter(entry => entry.bin === bin).map(entry => entry.argv.join(' '))
}

Given('a fresh sandbox for data file generators', function () {
  freshSandbox(this)
})

Given('the directory {string} already exists', function (dir) {
  fs.mkdirpSync(dir)
})

Given('the directory {string} already exists with a {string} directory', function (repo, sub) {
  fs.mkdirpSync(path.join(repo, sub))
  fs.writeFileSync(path.join(repo, sub, 'index.js'), 'seeded-content')
})

Given('the git shim seeds the cloned repo with a {string} directory', function (seeded) {
  process.env.CRX_PACKAGER_GIT_SEED = `${seeded}/index.js`
})

When('the psst data files are generated for {string}', async function (mode) {
  psst = await import('../../scripts/dataFilesBravePsst.js')
  psst.main(['node', 'script', mode])
})

When('the psst data files are generated', async function () {
  psst = await import('../../scripts/dataFilesBravePsst.js')
  psst.main(['node', 'script'])
})

When('the web-mcp data files are generated', async function () {
  webMcp = await import('../../scripts/dataFilesWebMcp.js')
  webMcp.main()
})

When('the leo local models data files are generated', async function () {
  leo = await import('../../scripts/generateLeoLocalModelsDataFiles.js')
  leo.main()
})

When('the asr local models data files are generated', async function () {
  asr = await import('../../scripts/generateAsrLocalModelsDataFiles.js')
  asr.main()
})

Then('npm was invoked as {string}', function (expected) {
  const invocations = readRecordArgv(this, 'npm')
  expect(invocations, JSON.stringify(invocations)).to.include(expected)
})

After(function () {
  if (this.savedCwd) {
    process.chdir(this.savedCwd)
    this.savedCwd = null
  }
  delete process.env.CRX_PACKAGER_GIT_SEED
})
