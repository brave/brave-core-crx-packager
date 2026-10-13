/* Copyright (c) 2026 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const root = path.join(import.meta.dirname, '..')

function readGitmodules () {
  return fs.readFileSync(path.join(root, '.gitmodules'), 'utf8')
}

function readWorkflow (name) {
  return YAML.parse(fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8'))
}

test('.gitmodules points uBlock at gorhill/uBlock', () => {
  const text = readGitmodules()
  const header = '[submodule "submodules/uBlock"]'
  const start = text.indexOf(header)
  assert.ok(start !== -1, 'submodules/uBlock section missing from .gitmodules')
  const rest = text.slice(start + header.length)
  const end = rest.indexOf('\n[') === -1 ? rest.length : rest.indexOf('\n[')
  const url = rest.slice(0, end).match(/url\s*=\s*(\S+)/)?.[1]
  assert.equal(url, 'https://github.com/gorhill/uBlock')
})

test('submodule-update workflow watches the uBlock submodule and reviews upstream gorhill commits', () => {
  const workflow = readWorkflow('submodule-update.yml')
  const job = workflow.jobs['submodule-sync']
  const step = job.steps.find((s) => String(s.uses || '').startsWith('mheap/submodule-sync-action'))
  assert.ok(step, 'submodule-sync step missing')
  // Action must stay pinned to an immutable commit SHA.
  assert.match(step.uses, /@([0-9a-f]{40})/)
  assert.equal(step.with.path, 'submodules/uBlock')
  assert.equal(step.with.ref, 'master')
  assert.equal(step.with.pr_branch, 'automated-submodule-update')
  assert.equal(step.with.target_branch, 'master')
  // The sync PR now points reviewers at upstream commits, not the fork.
  assert.match(step.with.pr_body, /gorhill\/uBlock/)
  assert.doesNotMatch(step.with.pr_body, /brave\/uBlock/)
})
