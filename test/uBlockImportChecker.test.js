/* Copyright (c) 2026 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { makeLoadHook, buildSyntheticDiff, getReviewScope, collectLoadedModules } from '../.github/braveCheckImports.js'

const root = path.join(import.meta.dirname, '..')
const config = JSON.parse(fs.readFileSync(path.join(root, '.github/pull-merge.json'), 'utf8'))

const hasFilterdiff = spawnSync('filterdiff', ['--version'], { encoding: 'utf8' }).status === 0
const submoduleReady = fs.existsSync(path.join(root, 'submodules/uBlock/src/js/resources/scriptlets.js'))

// The file paths Brave actually consumes from the uBlock submodule; must stay
// in sync with lib/adBlockRustUtils.js and .github/pull-merge.json.
const WATCHED_SAMPLE = [
  'submodules/uBlock/src/js/resources/scriptlets.js',
  'submodules/uBlock/src/js/redirect-resources.js',
  'submodules/uBlock/src/web_accessible_resources/amazon_ads.js',
  'submodules/uBlock/assets/assets.json'
]

test('pull-merge.json review scope covers the gitlink and watch list', () => {
  const args = config.filterdiff_args.split(/\s+/)
  // The LLM must see the submodule pin change; the upstream content behind it
  // is appended by brave/pull-merge's extra_diff_* inputs at review time.
  assert.ok(args.includes('--include=**/submodules/uBlock'), 'missing gitlink include glob')
  // Upstream-relative globs stay intact (they also match the submodule-prefixed
  // paths that the import checker loads — verified with real filterdiff below).
  for (const glob of [
    '**/assets/assets.json',
    '**/src/web_accessible_resources/*',
    '**/src/js/resources/*',
    '**/src/js/redirect-resources.js',
    '**/src/js/jsonpath.js',
    '**/src/js/arglist-parser.js',
    '**/src/js/urlskip.js'
  ]) {
    assert.ok(args.includes(`--include=${glob}`), `missing watch glob ${glob}`)
  }
  assert.equal(config.amplification, '0')
  assert.equal(config.debounce_time, '0')
  assert.equal(config.include_diff, 'true')
  assert.equal(config.max_tokens, '24000')
})

test('pull-merge.json system prompt keeps the verdict format and untrusted-diff rules', () => {
  for (const marker of ['### Verdict', '### Risk', '### Summary', '### Findings', 'UNTRUSTED DATA', 'MUST flag']) {
    assert.ok(config.system_prompt.includes(marker), `system_prompt missing ${marker}`)
  }
  assert.match(config.system_prompt, /upstream diff between the old and new submodule pins/)
  assert.match(config.system_prompt, /submodule/)
})

test('load hook blocks remote URLs and repo escapes', () => {
  const loaded = new Set()
  const hook = makeLoadHook(loaded)
  assert.throws(() => hook.load('https://evil.example/x.js', {}, () => ({})), /Remote URL blocked/)
  assert.throws(() => hook.load(pathToFileURL('/etc/passwd').href, {}, () => ({})), /Outside repo root/)
  hook.load(pathToFileURL(path.join(root, 'lib/util.js')).href, {}, () => ({}))
  assert.deepEqual([...loaded], ['lib/util.js'])
})

test('buildSyntheticDiff produces one header-per-file diff', () => {
  const diff = buildSyntheticDiff(['a/b.js', 'c/d.js'])
  assert.match(diff, /diff --git a\/a\/b\.js b\/a\/b\.js/)
  assert.match(diff, /\+x\n/)
  // one hunk per loaded file, no more
  assert.equal(diff.match(/diff --git/g).length, 2)
})

test('review scope includes every file the scriptlets import graph loads', { skip: !hasFilterdiff || !submoduleReady ? 'filterdiff or uBlock submodule not available' : false }, async () => {
  const loaded = await collectLoadedModules()
  assert.ok(loaded.size > 0, 'no modules were loaded through the hook')
  for (const p of loaded) {
    assert.ok(p.startsWith('submodules/uBlock/'), `unexpected load outside submodule: ${p}`)
  }
  const scope = await getReviewScope(config.filterdiff_args, buildSyntheticDiff(loaded))
  const unreviewed = [...loaded].filter((p) => !scope.has(p))
  assert.deepEqual(unreviewed, [], 'files loaded but outside LLM review scope')
})

test('filterdiff_args match the watched sample paths', { skip: !hasFilterdiff ? 'filterdiff not available' : false }, async () => {
  const scope = await getReviewScope(config.filterdiff_args, buildSyntheticDiff(WATCHED_SAMPLE))
  for (const p of WATCHED_SAMPLE) {
    assert.ok(scope.has(p), `watched path not matched by filterdiff_args: ${p}`)
  }
})
