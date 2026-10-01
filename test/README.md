# BDD test harness

The repository's executable specification lives in `test/features/*.feature`
(cucumber) with step definitions in `test/steps/*.mjs` and shared harness code
in `test/support/`. `pnpm test` runs the full suite under the c8 coverage
gate; `pnpm test:bdd` runs the specs without the coverage gate.

## Loading order

`cucumber.cjs` imports support code in a load-bearing order:

1. `test/support/state.mjs` — shared mock-state singleton (`Symbol.for` keyed;
   fresh per scenario via `resetState()`).
2. `test/support/mocks.mjs` — installs [quibble](https://www.npmjs.com/package/quibble)
   ESM interception at load time: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`
   and `@sentry/node` are replaced by recording fakes (`mock-s3.mjs`,
   `mock-dynamodb.mjs`, `mock-sentry.mjs`). Replies are scripted per scenario
   via `mockState().<sdk>.replies[CommandName] = { value | error }`.
3. `test/support/world.mjs` — the World plus global hooks: per-scenario state
   reset, hermetic `globalThis.fetch` swap, `PATH` prepended with `test/bin`,
   `console.*` captured into state, `process.exit` stubbed into
   `state.scripts.exitCalls`, env snapshot/restore, and `build/` + temp-dir
   cleanup.
4. `test/steps/*.mjs` — one step file per feature area.

Step text must be globally unique across step files; cucumber v11 also
enforces that a step definition's arity matches its captured parameters.

## External boundaries

- **Network** — `globalThis.fetch` is replaced by a deny-by-default fake
  (`test/support/fake-fetch.mjs`); every feature routes the URLs it needs,
  anything unrouted fails loudly.
- **Child processes** — never monkey-patched. Executable shims in `test/bin/`
  (`chrome`, `openssl`, `puffin`, `git`, `npm`, `aws`) are prepended to
  `PATH` and record their invocations as JSONL via the `CRX_PACKAGER_RECORD`
  env var.
- **AWS SDKs** — intercepted with quibble; constructor args and every sent
  command are recorded, replies scripted per scenario.
- **CLI entry points** — every `scripts/*.js` entry point exports
  `main(argv)` guarded by `import.meta.url === pathToFileURL(process.argv[1]).href`
  so specs can drive them in-process. Each `main()` parses argv on a fresh
  `new commander.Command()` (commander v2's default export is a singleton
  whose boolean flags leak between `parse()` calls).

## Coverage gate

`pnpm test` runs `c8 --check-coverage` at **80% for lines, statements,
functions and branches** over every file listed in `.c8rc.json`. The gate
scope ratchets up as more of `lib/` and `scripts/` gains specs.

## Commands

- `pnpm test:bdd` — cucumber specs only (no coverage gate)
- `pnpm test` — the gated run used by CI
- `pnpm lint` — eslint (neostandard)
