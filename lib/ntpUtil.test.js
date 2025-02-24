import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ntpUtil from './ntpUtil.js'
import path from 'node:path'

test('should validate path does not traverse outside of target', () => {
  const rootDir = fs.mkdtempSync('ntp-util-test')

  // success cases
  ntpUtil.validateTargetPath(rootDir, rootDir)
  ntpUtil.validateTargetPath(rootDir, path.join(rootDir, 'file.json'))
  ntpUtil.validateTargetPath(rootDir, path.join(rootDir, 'subdir/file.json'))
  ntpUtil.validateTargetPath(rootDir, path.join(rootDir, './file.json'))

  // failure
  assert.throws(() =>
    ntpUtil.validateTargetPath(rootDir, path.join(rootDir, '../file.json')),
  /path file.json traverses outside of root/)
})
