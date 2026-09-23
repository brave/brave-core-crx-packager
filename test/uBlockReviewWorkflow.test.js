/* Copyright (c) 2026 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

/* eslint-disable no-template-curly-in-string -- asserts literal GitHub Actions expressions */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const root = path.join(import.meta.dirname, '..')
const workflow = YAML.parse(
  fs.readFileSync(path.join(root, '.github/workflows/uBlock-review.yml'), 'utf8')
)
const pullMergeConfig = JSON.parse(
  fs.readFileSync(path.join(root, '.github/pull-merge.json'), 'utf8')
)

const CARRIER = '.github/uBlock-sync-review.diff'

test('uBlock review workflow triggers on submodule PRs', () => {
  const on = workflow[true] ?? workflow.on // YAML 1.1 parsers coerce bare `on`
  assert.ok(on?.pull_request, 'pull_request trigger missing')
  assert.ok(on.pull_request.paths.includes('submodules/uBlock'))
  for (const type of ['opened', 'synchronize', 'reopened']) {
    assert.ok(on.pull_request.types.includes(type))
  }
  assert.ok('workflow_dispatch' in on)
})

test('check-imports job keeps the fork gate semantics', () => {
  const job = workflow.jobs['check-imports']
  assert.ok(job, 'check-imports job missing')
  const runs = job.steps.map((s) => s.run ?? '')
  const all = runs.join('\n')
  // gate files must come from master, never from the PR being reviewed;
  // .gitmodules too, so the submodule URL cannot be swapped mid-PR
  assert.match(all, /git diff --name-only origin\/master\.\.HEAD -- \.github\/braveCheckImports\.js \.github\/pull-merge\.json \.gitmodules/)
  assert.match(all, /git checkout origin\/master -- \.github\/braveCheckImports\.js \.github\/pull-merge\.json/)
  assert.match(all, /apt-get install -y patchutils/)
  assert.match(all, /git submodule update --init/)
  // sandboxed: no network for the checker
  assert.match(all, /sudo unshare -n node \.github\/braveCheckImports\.js/)
  assert.ok(job.permissions.contents === 'read')
})

test('sync-diff attaches a scoped upstream diff to the PR branch', () => {
  const job = workflow.jobs['sync-diff']
  assert.ok(job, 'sync-diff job missing')
  const runs = job.steps.map((s) => s.run ?? '').join('\n')
  assert.match(runs, /filterdiff/)
  assert.equal(job.env.CARRIER, CARRIER)
  assert.match(runs, /\$CARRIER/)
  // no self-trigger loop: skip the commit when the carrier is unchanged
  assert.match(runs, /git diff --exit-code --quiet/)
  assert.match(runs, /git push/)
  // fork-only old pin must not wedge the diff (empty-tree fallback)
  assert.match(runs, /git cat-file -e/)
  assert.equal(job.permissions.contents, 'write')
  // scoped to exactly the watch globs declared in pull-merge.json
  const envGlobs = job.env.WATCH_GLOBS.split(/\s+/).filter(Boolean)
    .map((a) => a.replace(/^--include=/, ''))
  const configGlobs = pullMergeConfig.filterdiff_args.split(/\s+/)
    .map((a) => a.replace(/^--include=/, ''))
  for (const glob of envGlobs) {
    assert.ok(configGlobs.includes(glob), `sync-diff glob not in pull-merge.json scope: ${glob}`)
  }
})

test('pull-merge runs the LLM review on the gated PR', () => {
  const job = workflow.jobs['pull-merge']
  const step = job.steps.find((s) => String(s.uses || '').startsWith('brave/pull-merge'))
  assert.ok(step, 'brave/pull-merge step missing')
  assert.equal(step.with.github_token, '${{ secrets.GITHUB_TOKEN }}')
  assert.equal(step.with.anthropic_api_key, '${{ secrets.ANTHROPIC_API_KEY }}')
  assert.deepEqual(job.needs, ['check-imports', 'sync-diff'])
})

test('failures page the reviewers on Slack', () => {
  const job = workflow.jobs['on-failure']
  const step = job.steps.find((s) => String(s.uses || '').startsWith('8398a7/action-slack'))
  assert.ok(step, 'action-slack step missing')
  // Slack action must stay pinned to an immutable commit SHA.
  assert.match(step.uses, /@([0-9a-f]{40})/)
  assert.equal(step.env.SLACK_WEBHOOK_URL, '${{ secrets.SLACK_WEBHOOK_URL }}')
  assert.match(step.with.text, /UBLOCK_SYNC_REVIEWERS_SLACK_GROUP_ID/)
})

test('every third-party action is pinned to a commit SHA', () => {
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps) {
      const uses = step.uses
      if (!uses || uses.startsWith('./')) continue
      if (uses.startsWith('brave/pull-merge@')) continue // first-party, tracks main like the fork
      assert.match(uses, /@([0-9a-f]{40})(\s|#|$)/, `${jobName}: unpinned action ${uses}`)
    }
  }
})
