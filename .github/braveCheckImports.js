/* Copyright (c) 2026 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

// Import-scope checker for the uBlock submodule (ported from brave/uBlock
// .github/braveCheckImports.js, adapted to this repo's layout).
//
// While importing the uBlock scriptlets entry point, every module load is
// intercepted and asserted to be a file:// URL inside this repo. The set of
// loaded files is then compared against the LLM review scope declared in
// .github/pull-merge.json (filterdiff_args) so nothing the packager executes
// can escape puLL-Merge review.
//
// Run with: sudo unshare -n node .github/braveCheckImports.js

import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPTLETS_ENTRY = '../submodules/uBlock/src/js/resources/scriptlets.js'
const PULL_MERGE_CONFIG = '.github/pull-merge.json'

export function makeLoadHook (loaded) {
  return {
    load (url, context, nextLoad) {
      assert(url.startsWith('file:///'), `Remote URL blocked [${url}].`)
      const filePath = fileURLToPath(url)
      const relativePath = path.relative(process.cwd(), filePath)
      const escaped = relativePath.startsWith('..') || path.isAbsolute(relativePath)
      assert(!escaped, `Outside repo root [${relativePath}].`)
      loaded.add(relativePath)
      return nextLoad(url, context)
    }
  }
}

// Import the uBlock scriptlets entry point while recording every module
// load in the graph. Must run before the entry module is cached.
export async function collectLoadedModules (entryPath = SCRIPTLETS_ENTRY) {
  const loaded = new Set()
  registerHooks(makeLoadHook(loaded))
  const { builtinScriptlets } = await import(entryPath)
  assert(Array.isArray(builtinScriptlets), 'scriptlets not an array.')
  return loaded
}

export function buildSyntheticDiff (paths) {
  return [...paths].map((p) =>
    `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@ -0,0 +1 @@\n+x\n`
  ).join('')
}

export function getReviewScope (filterdiffArgs, syntheticDiff) {
  assert(typeof filterdiffArgs === 'string' && filterdiffArgs.length > 0,
    '.github/pull-merge.json filterdiff_args missing/empty.')
  return new Promise((resolve, reject) => {
    const cp = spawn('filterdiff', ['--strip=1', '--list', ...filterdiffArgs.split(/\s+/).filter(Boolean)])
    const out = []
    const err = []
    cp.stdin.write(syntheticDiff)
    cp.stdout.on('data', (d) => out.push(d))
    cp.stderr.on('data', (d) => err.push(d))
    cp.stdin.end()
    cp.on('close', (code) => {
      if (code !== 0) return reject(new Error(Buffer.concat(err).toString()))
      resolve(new Set(Buffer.concat(out).toString().split('\n').filter(Boolean)))
    })
  })
}

export async function runChecks () {
  const loaded = await collectLoadedModules()

  const config = JSON.parse(fs.readFileSync(PULL_MERGE_CONFIG, 'utf8'))

  const syntheticDiff = buildSyntheticDiff(loaded)
  const reviewed = await getReviewScope(config.filterdiff_args, syntheticDiff)

  const unreviewed = [...loaded].filter((p) => !reviewed.has(p))
  assert(unreviewed.length === 0,
    `Loaded but not in LLM review scope (filterdiff_args):\n${unreviewed.join('\n')}`)

  console.log(`Verified ${loaded.size} files against filterdiff_args. All in review scope.`)
  console.log('All checks succeeded.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runChecks()
}