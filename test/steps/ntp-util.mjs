import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let ntpUtil

When('the target root is a fresh temp directory', async function () {
  ntpUtil = (await import('../../lib/ntpUtil.js')).default
  this.rootDir = path.resolve(fs.mkdtempSync(path.join(os.tmpdir(), 'ntp-util-')))
  this.tmpDirs = this.tmpDirs || []
  this.tmpDirs.push(this.rootDir)
})

When('the target root is the filesystem root', async function () {
  ntpUtil = (await import('../../lib/ntpUtil.js')).default
  this.rootDir = path.resolve('/')
})

Then('the root itself is a valid target', function () {
  expect(() => ntpUtil.validateTargetPath(this.rootDir, this.rootDir)).to.not.throw()
})

Then('{string} is a valid target', function (template) {
  const target = template.replace('<root>', this.rootDir)
  expect(() => ntpUtil.validateTargetPath(this.rootDir, target)).to.not.throw()
})

Then('the target {string} is rejected with {string}', function (template, fragment) {
  const target = template.replace('<root>', this.rootDir)
  expect(() => ntpUtil.validateTargetPath(this.rootDir, target)).to.throw(fragment)
})
