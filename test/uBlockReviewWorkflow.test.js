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

const UBLOCK_URL = 'https://github.com/gorhill/uBlock'
const WATCH_GLOBS = [
  '**/assets/assets.json',
  '**/src/web_accessible_resources/*',
  '**/src/js/resources/*',
  '**/src/js/redirect-resources.js',
  '**/src/js/jsonpath.js',
  '**/src/js/arglist-parser.js',
  '**/src/js/urlskip.js'
]

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

test('pull-merge job feeds pull-merge the submodule repo and pins', () => {
  const job = workflow.jobs['pull-merge']
  assert.ok(job, 'pull-merge job missing')
  const runs = job.steps.map((s) => s.run ?? '').join('\n')
  // pins are resolved from the checked-out merge ref: the submodule gitlink
  // at the PR head and at origin/master
  assert.match(runs, /git rev-parse HEAD:submodules\/uBlock/)
  assert.match(runs, /git rev-parse "origin\/master:submodules\/uBlock"/)
  const step = job.steps.find((s) => String(s.uses || '').startsWith('brave/pull-merge'))
  assert.ok(step, 'brave/pull-merge step missing')
  assert.equal(step.uses, 'brave/pull-merge@extra-diff-repository')
  assert.equal(step.with.extra_diff_repository, UBLOCK_URL)
  assert.equal(step.with.extra_diff_head, '${{ steps.pins.outputs.head }}')
  assert.equal(step.with.extra_diff_prev, '${{ steps.pins.outputs.prev }}')
  assert.equal(step.with.github_token, '${{ secrets.GITHUB_TOKEN }}')
  assert.equal(step.with.anthropic_api_key, '${{ secrets.ANTHROPIC_API_KEY }}')
  assert.equal(step.with.owner, '${{ github.repository_owner }}')
  assert.equal(step.with.repo, '${{ github.event.repository.name }}')
  assert.equal(step.with.prnum, '${{ github.event.number }}')
  assert.equal(step.with.debug, 'true')
  // the fetched upstream diff is scoped by filterdiff_args (no local filterdiff)
  assert.doesNotMatch(runs, /filterdiff/)
  assert.deepEqual(job.needs, ['check-imports'])
})

test('pull-merge.json review scope covers the gitlink and every watched path', () => {
  const scope = pullMergeConfig.filterdiff_args.split(/\s+/)
    .map((a) => a.replace(/^--include=/, ''))
  // the gitlink hunk must stay in scope so puLL-Merge reviews the bump
  assert.ok(scope.includes('**/submodules/uBlock'))
  // the import checker (braveCheckImports.js) asserts every module the
  // scriptlets import graph loads lands in this same scope — keep the
  // upstream-relative watch list intact
  for (const glob of WATCH_GLOBS) {
    assert.ok(scope.includes(glob), `watched path missing from pull-merge.json scope: ${glob}`)
  }
  // review-scope data lives in the repo, never in workflow-generated state
  assert.doesNotMatch(pullMergeConfig.filterdiff_args, /uBlock-sync-review/)
  // puLL-Merge must see the full PR diff plus the appended upstream diff
  assert.equal(pullMergeConfig.include_diff, 'true')
})

test('system prompt explains the appended upstream diff', () => {
  assert.match(pullMergeConfig.system_prompt, /upstream diff between the old and new submodule pins/)
  assert.match(pullMergeConfig.system_prompt, /UNTRUSTED DATA/)
  assert.match(pullMergeConfig.system_prompt, /### Verdict/)
})

test('failures page the reviewers on Slack', () => {
  const job = workflow.jobs['on-failure']
  const step = job.steps.find((s) => String(s.uses || '').startsWith('8398a7/action-slack'))
  assert.ok(step, 'action-slack step missing')
  // Slack action must stay pinned to an immutable commit SHA.
  assert.match(step.uses, /@([0-9a-f]{40})/)
  assert.equal(step.env.SLACK_WEBHOOK_URL, '${{ secrets.SLACK_WEBHOOK_URL }}')
  assert.match(step.with.text, /UBLOCK_SYNC_REVIEWERS_SLACK_GROUP_ID/)
  assert.deepEqual(job.needs, ['check-imports', 'pull-merge'])
})

test('every third-party action is pinned to a commit SHA', () => {
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps) {
      const uses = step.uses
      if (!uses || uses.startsWith('./')) continue
      if (uses.startsWith('brave/pull-merge@')) continue // first-party, tracks its feature branch like the fork tracked main
      assert.match(uses, /@([0-9a-f]{40})(\s|#|$)/, `${jobName}: unpinned action ${uses}`)
    }
  }
})
