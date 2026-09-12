# RR Study Timer

**RR Study Timer** tracks active flashcard study time in RemNote, with a compact timer during review and daily and weekly statistics.

See how long you have studied, how many card reviews you have completed, and which documents or folders received your attention. Tracking starts automatically during flashcard review and pauses after detected inactivity.

Author: Roland Russwurm · Plugin ID: `rr-study-timer`

## What's new in 0.5.9

- Updated plugin logo and a clearer, user-facing description.
- The plugin manifest now identifies the plugin as **0.5.9**.
- The tracking behavior and overview placement from 0.5.8 remain unchanged.

**Version note:** `public/manifest.json` currently declares 0.5.9, while `package.json` still declares 0.5.8. The installation package includes the plugin manifest. This README describes the current repository; the version numbers in the source metadata have not yet been aligned.

## Changed in 0.5.8

- Restored the daily and weekly overview to RemNote's flashcard statistics page, where it had already worked in the desktop app.
- Added `Lernzeit anzeigen` (Show study time) to RemNote's command search, opening the overview in a separate pane.
- Removed the `DeckPage` registration used in 0.5.7, which did not display the overview in the desktop app.
- Retained the responsive layout and simplified review row from 0.5.7.

## Changed in 0.5.7

- Added a responsive arrangement for the weekly and daily panels.
- Reduced the review row to time, completed cards, and average time.
- Removed the diagnostic feature.
- Tried placing the overview on `DeckPage`; 0.5.8 replaced this placement after it did not appear in the desktop app.

## Verified in 0.5.6

- Active time tracking was confirmed in live use.
- Delayed card-completion events were assigned using the card ID, including when RemNote loaded the next card before reporting completion of the previous one.

The 0.5.6 and 0.5.7 notes summarize the history recorded in the 0.5.8 documentation; they are not complete release logs. Older DEBUG documents, if encountered in previous packages, describe earlier investigations rather than current usage.

## Main features

- **Automatic study timer** during flashcard review.
- **Inactivity pausing**, with a configurable timeout.
- **Session statistics** showing active time, completed card reviews, and average active time per completed review.
- **Daily totals** for active study time and completed card reviews.
- **Time per document or folder**, sorted by time spent.
- **Weekly overview** from Monday through Sunday, with a bar chart, total time, and average time per study day.
- **Rename-safe history** linked to stable RemNote IDs.
- **Local calendar days**, including splitting study time at midnight.
- **Persistent daily statistics** through RemNote's synchronized plugin storage.
- Mobile support enabled in the plugin manifest.

## Getting started

1. Install or load the built RR Study Timer plugin package in RemNote.
2. Start a flashcard review. The timer row appears below the queue's top bar.
3. Review as usual: load cards, reveal answers, and grade them. No separate start button is needed.
4. Open the flashcard statistics page to see today's totals and the current week.
5. Alternatively, search RemNote's commands for `Lernzeit anzeigen` (Show study time) to open the overview in its own pane.

The current plugin interface uses German labels. This README explains them in English; use the exact German command above when searching.

## Flashcard review row

The review row contains three values:

| Display | Meaning |
| --- | --- |
| ⏱ / ⏸ and time | Active time in the current review session, displayed as minutes:seconds. The pause symbol indicates a hidden or inactive state. |
| `Karten` | Completed card reviews in the current session. |
| `Ø` | Average active time per completed card review, in seconds. A dash appears before the first completion. |

A new queue session resets the session counters. The daily totals remain stored and accumulate across sessions.

The average includes active time up to grading, including time spent viewing the answer. It is calculated from completed reviews only. Time already spent on an unfinished card can appear in the session and daily totals without appearing in that average.

Repeated reviews of the same card count again. These numbers represent completed review attempts, not unique cards or a count of permanently mastered cards.

### Example

If you complete four reviews with eight seconds of active time each, the row shows four cards and an average of **8.0 s**. If you then spend five seconds on the next card without grading it, total active time increases, while the completed-card count and average stay unchanged.

## How active time is measured

Time is counted while a review card is active and the review surface is not reported as hidden.

The default inactivity limit is **30 seconds**. Loading a new card, revealing an answer, or grading a card provides activity signals. Once the limit is reached, additional time is excluded until activity resumes. Background polling of an unchanged card does not keep the timer running.

For example, if you load a card and leave it untouched for two minutes, the default setting counts the first 30 seconds. The remaining 90 seconds are excluded. Revealing the answer resumes tracking without adding the excluded interval.

The timer also stops when you leave the review queue. RemNote's lookback mode is excluded. Visibility detection comes from the review widget, so behavior depends on the visibility information exposed by the RemNote client.

### Inactivity setting

Open RR Study Timer's settings in RemNote and adjust:

| Setting | Default | Minimum | Applies |
| --- | --- | --- | --- |
| `Pause after inactivity (seconds)` | 30 seconds | 5 seconds | After restarting the plugin |

Choose a longer timeout if you regularly spend more than 30 seconds thinking about a card before revealing or grading it. The plugin detects review activity; it cannot tell whether you are still thinking silently.

## Daily statistics

The **Heute** (Today) panel shows:

- **Karten gelernt** — completed card reviews today.
- **aktive Lernzeit** — active study time today.
- **Zeit pro Dokument / Ordner** — today's study time grouped by document or folder.

The document/folder list is sorted by active time, highest first. Time that cannot be assigned to a document or folder is included in the overall total and displayed under **Sonstige / ohne Dokument** (Other / no document).

Statistics use your device's local date. Active time crossing midnight is split between the two dates; a completed review is counted on the date when completion is reported.

The overview refreshes automatically, but saved totals can trail the live timer by a few seconds.

## Weekly overview

The **Lernzeit diese Woche** (Study time this week) panel covers the current **Monday–Sunday** week.

It shows:

- Total active study time for the week.
- One bar per day, with today highlighted.
- Daily values in minutes, rounded for display.
- **Ø … / Lerntag** — average time across days with recorded active study time.

The study-day average excludes days with no recorded time. For example, 20 minutes on Monday and 40 minutes on Wednesday produce a weekly total of one hour and an average of 30 minutes per study day.

The weekday initials are German: **M, D, M, D, F, S, S**, corresponding to Monday through Sunday. A day's tooltip provides its date and duration.

The current overview shows today and the current week; it does not provide a date picker for browsing earlier weeks.

## Document and folder tracking

For each card, the plugin walks up its RemNote hierarchy and uses the nearest document or folder it finds. If an item is both a folder and a document, it is treated as a folder.

Each interval is assigned to one container. The list is not a recursive roll-up that also credits every parent folder.

Tracking uses stable RemNote IDs rather than names:

- Renaming a document or folder preserves its recorded values.
- The overview looks up its current title when possible.
- If an item can no longer be resolved, its saved title remains visible with **nicht mehr vorhanden** (no longer available).
- If no container can be resolved, the time still contributes to the daily total.

Historical records retain their assigned container IDs; the plugin does not rebuild earlier statistics from the current document hierarchy.

## Where the overview appears

The daily and weekly panels are registered on RemNote's **flashcard statistics page** and can also open in a separate pane using `Lernzeit anzeigen`.

With at least **654 px** of available width, the two panels appear side by side. In narrower spaces, they stack vertically. RemNote determines the width allocated to the plugin, so a large app window does not necessarily mean the panels will be side by side.

Direct placement on the newer flashcard home page is not confirmed. The earlier `DeckPage` placement is no longer used.

Mobile support is enabled, but placement and visibility behavior should be checked in the specific RemNote mobile client.

## Installation and updates

Use a **built plugin ZIP** with RemNote's plugin developer installation/update controls. GitHub's **Download ZIP** provides source code and is not an installable plugin package.

There are currently no published GitHub Releases in this repository. If you do not already have a built package, follow [Build from source](#build-from-source) below.

When updating:

1. Load the new built ZIP as an update to the existing plugin.
2. Keep the existing installation and its data; do not uninstall it or clear its storage.
3. Fully reload RemNote.
4. Check the installed plugin version and confirm that your daily totals are still visible.

Previous instructions referred to a versioned package named `PluginZip-v0.5.8.zip`. The repository's build command produces `PluginZip.zip`; the manifest inside the archive identifies the plugin version.

For a localhost update, stop the previous server, update or re-extract the source, run `npm ci` and `npm run dev`, and keep using the existing `http://localhost:8080` connection. Fully reload RemNote afterward.

## Data and privacy

Daily statistics use RemNote's synchronized plugin storage. Records include dates, active durations, completed-review counts, document/folder IDs, and cached titles.

The tracking code makes no direct requests to an external analytics service. It reads card and document information through the RemNote SDK and relies on RemNote for storage and synchronization. The manifest requests read access to RemNote data so it can resolve cards and their document/folder hierarchy.

Data is saved periodically, approximately every five seconds, and on card transitions, completion, and queue exit. A normal plugin shutdown also attempts to save pending values. An abrupt app close can lose the most recent unsaved interval.

Existing daily records continue to be read. Time that was never recorded cannot be reconstructed from past reviews.

Simultaneous study in multiple RemNote instances does not have atomic merging of daily values. To avoid competing writes to the same day's totals, study in one instance at a time.

## Troubleshooting

### The overview is missing

Open the flashcard statistics page, or use `Lernzeit anzeigen` from command search. Do not rely on the newer flashcard home page. After an update, fully reload RemNote.

### The timer pauses while I am still thinking

Increase `Pause after inactivity (seconds)` and restart the plugin. Silent thinking produces no new review event, so it can reach the inactivity limit.

### The daily total differs from the review row

The review row covers the current session; the daily total includes earlier sessions today. There can also be a short delay before live time is saved and displayed in the overview.

### The card count is higher than the number of different cards studied

Each completed attempt counts, including repeated reviews of the same card.

### Some time appears under Other / no document

The plugin could not resolve a document or folder for those intervals. The time remains included in the daily total.

### The average does not equal total session time divided by cards

The average uses only time associated with completed reviews. Session time can also include unfinished or skipped cards.

### Old study time is missing

Only time recorded while the plugin was running is available. Unrecorded history cannot be recovered, and clearing plugin data or abruptly closing before a save can remove or lose values.

## Development

### Repository source versus installation ZIP

The repository contains the editable source in `src/`, static metadata and assets in `public/`, tests, dependency files, and build configuration. The `public/` directory is part of the plugin source, not a separately deployed website.

Building creates `dist/` and `PluginZip.zip`. The archive contains compiled plugin files, the manifest, assets, and this README. Extracting an installation ZIP does not recreate the source project.

### Build from source

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

### Storage keys

Persistent daily statistics:

```text
rr-study-timer:daily:v1:<YYYY-MM-DD>
```

Session timer state:

```text
rr-study-timer:session:v2
```

Review-widget visibility:

```text
rr-study-timer:queue-visibility:v1
```

### Verification

The regression tests cover inactivity clipping and resumption, hidden review surfaces, queue exit, local midnight, card attribution, lookback exclusion, serialized storage writes, retry deduplication, stable document/folder identity, Monday-based weeks, duplicate card events, delayed completion events, and recovery from stalled SDK calls.

These tests use mocked RemNote APIs. Client-specific widget placement and actual review behavior still require checks in RemNote. The historical live confirmation recorded for 0.5.6 is separate from automated test coverage.

## Author

Roland Russwurm

## License

MIT, as declared in `package.json`.
