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

// Regression: the previous `startsWith(resolvedRoot)` check would incorrectly
// allow a sibling directory that shares the root as a string prefix.
test('should reject sibling directories sharing the root prefix', () => {
  const rootDir = path.resolve(fs.mkdtempSync('ntp-util-test'))

  assert.throws(() =>
    ntpUtil.validateTargetPath(rootDir, rootDir + '-evil/payload'),
  /traverses outside of root/)
})

// Edge case: a filesystem root already ends with a separator, so appending
// another separator must not reject valid targets beneath it.
test('should allow targets under a filesystem-root root path', () => {
  const fsRoot = path.resolve('/')

  ntpUtil.validateTargetPath(fsRoot, path.join(fsRoot, 'anything'))
})
