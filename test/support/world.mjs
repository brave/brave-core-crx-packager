// World + global hermeticity hooks: fresh state per scenario, fake fetch,
// PATH shims, captured console/exit/env.
import { Before, After, setWorldConstructor, setDefaultTimeout } from '@cucumber/cucumber'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mockState, resetState } from './state.mjs'
import { hermeticFetch } from './fake-fetch.mjs'

const testBinDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin')

class CustomWorld {
  constructor ({ attach, parameters }) {
    this.attach = attach
    this.parameters = parameters
    this.state = mockState()
  }
}
setWorldConstructor(CustomWorld)
setDefaultTimeout(120000)

let savedFetch
let savedPath
const savedConsole = {}
let savedExit
let savedCwd
let envSnapshot

Before(function () {
  this.state = resetState()
  this.tmpDirs = []

  savedFetch = globalThis.fetch
  globalThis.fetch = hermeticFetch

  savedPath = process.env.PATH
  process.env.PATH = `${testBinDir}${path.delimiter}${savedPath}`

  for (const level of ['log', 'warn', 'error', 'info']) {
    savedConsole[level] = console[level]
    console[level] = (...args) => { this.state.logs.push({ level, args }) }
  }

  savedExit = process.exit
  process.exit = (code) => { this.state.scripts.exitCalls.push(code) }

  savedCwd = process.cwd()
  envSnapshot = { ...process.env }
})

After(function () {
  globalThis.fetch = savedFetch
  process.env.PATH = savedPath
  for (const level of Object.keys(savedConsole)) console[level] = savedConsole[level]
  process.exit = savedExit

  if (process.cwd() !== savedCwd) process.chdir(savedCwd)

  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key]
  }
  Object.assign(process.env, envSnapshot)

  for (const dir of this.tmpDirs || []) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.rmSync('build', { recursive: true, force: true })
})
