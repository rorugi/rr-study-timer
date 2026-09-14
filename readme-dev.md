# RR Study Timer — Development

Build and contributor instructions. User documentation and storage keys are in [README.md](README.md).

## Repository source versus installation ZIP

The repository contains the editable source in `src/`, static metadata and assets in `public/`, tests, dependency files, and build configuration. The `public/` directory is part of the plugin source, not a separately deployed website.

Building creates `dist/` and `PluginZip.zip`. The archive contains compiled plugin files, the manifest, assets, and this README. Extracting an installation ZIP does not recreate the source project.

## Build from source

You need Node.js, npm, and Git. The test command uses Node's built-in test runner, so use a Node.js version that supports `node --test`.

Clone the repository and install dependencies:

```bash
git clone https://github.com/rorugi/rr-study-timer.git
cd rr-study-timer
npm ci
```

Start the development server:

```bash
npm run dev
```

Load this developer plugin URL in RemNote:

```text
http://localhost:8080
```

Check types and run the regression tests:

```bash
npm run check-types
npm test
```

Build the installation package:

```bash
npm run build
```

The build checks TypeScript types, runs the official RemNote manifest validator, compiles the plugin, and creates a fresh `PluginZip.zip`. Tests are a separate command and are not run automatically by the build.

**The validator requires a Git repository.** If you downloaded and extracted a source ZIP instead of cloning, run `git init` in the extracted project directory before building:

```bash
git init
npm ci
npm test
npm run build
```

## Verification

The regression tests cover inactivity clipping and resumption, hidden review surfaces, queue exit, local midnight, card attribution, lookback exclusion, serialized storage writes, retry deduplication, stable document/folder identity, Monday-based weeks, duplicate card events, delayed completion events, and recovery from stalled SDK calls.

Additional tests cover configurable positions, invalid settings, parent-folder totals, active-time Pomodoro pausing, completion notification deduplication, restart, and live layout changes without resetting the countdown.

These tests use mocked RemNote APIs. Client-specific widget placement and actual review behavior still require checks in RemNote. The historical live confirmation recorded for 0.5.6 is separate from automated test coverage.


## Updating a local development installation

For a localhost update, stop the previous server, update or re-extract the source, run `npm ci` and `npm run dev`, and keep using the existing `http://localhost:8080` connection. Fully reload RemNote afterward.
