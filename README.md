# RR Study Timer

Version 0.5.8 · Roland Russwurm · Plugin ID `rr-study-timer`

Track active study time, daily card counts, daily study time by document/folder, and a weekly overview from Monday to Sunday. The queue row shows only time, cards, and average time per card. Mobile support is enabled.

## Open the overview

The two panels are back on the flashcard statistics page. Registering them on `DeckPage` in 0.5.7 did not display them in the desktop app. Direct embedding on the new flashcard home page is currently unconfirmed and is not promised in this version.

You can also run `Lernzeit anzeigen` (Show study time) from RemNote's command search to open the overview in a separate pane. When at least 654 px of width is available, the weekly and daily panels appear side by side; in narrower views, they are stacked vertically. The width RemNote allocates to the plugin on the statistics page determines the actual layout.

## Update

Upload the built `PluginZip-v0.5.8.zip` as an update through the plugin developer section. Do not uninstall the existing installation or delete its data. Then fully reload RemNote and check that version 0.5.8 is running.

For localhost development: stop the previous server, extract the source ZIP again, and run `npm ci` followed by `npm run dev` in the `rr-study-timer` folder. Keep using the existing connection to http://localhost:8080 and fully reload RemNote.

To build from a freshly extracted source ZIP:

```sh
git init
npm ci
npm test
npm run build
```

The official RemNote validator requires a Git repository. The build checks the TypeScript types and manifest, then creates a fresh `PluginZip.zip`.

## Behavior and data

Time tracking and the assignment of delayed completion events by card ID remain unchanged from the behavior verified live in 0.5.6. By default, tracking pauses after 30 seconds without loading a card, showing an answer, or grading a card. The `Pause after inactivity (seconds)` setting takes effect after restarting the plugin; the minimum is five seconds. Visibility is reported by the queue widget.

Document/folder IDs remain the permanent keys, so renaming a document or folder does not change its historical values. Existing daily values continue to be read. Repeated reviews of the same card count again. Time that was never recorded cannot be reconstructed retroactively.

Data is saved periodically and when cards change or are completed. Closing the app abruptly may lose the most recent unsaved interval. Studying in multiple instances at the same time still does not support atomic merging of synchronized daily values.

## Changes in 0.5.8

The overview is once again registered on `LearningProgressPage`, where it already worked in the desktop app. It can also be opened as a pane using `Lernzeit anzeigen` (Show study time). `DeckPage` is no longer used. The responsive layout, simplified queue row, and removal of the diagnostic feature introduced in 0.5.7 are retained. Historical DEBUG files document earlier versions and are not current user instructions.
