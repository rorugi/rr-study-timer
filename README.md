# RR Study Timer

RR Study Timer tracks your active flashcard study time in RemNote, shows daily and weekly progress, and provides a Pomodoro timer for review and other learning tasks.

## What's new in 0.8.0

- Choose a Pomodoro color and see completed sessions in their saved colors.

## Getting started

1. Start a flashcard review. The study timer appears below the top bar and starts automatically.
2. Review as usual. The row shows active time, completed reviews, and average time per completed review.
3. Open **Flashcards → Stats** for your daily and weekly overview, or search for **Lernzeit anzeigen** (Show study time).
4. Open **RR Study Timer: Settings** from command search to customize the row and enable Pomodoro.

You can also open settings with `/rrstudytimer` or **… → RR Study Timer** during review. Some statistics labels and commands are in German.

## Study time and statistics

The timer counts active review time and pauses after inactivity or when you leave the review queue. The default inactivity limit is **30 seconds**. Loading a card, revealing an answer, or grading it resumes tracking.

If you need more time to think, increase **Pause after inactivity (seconds)** in the plugin settings and restart the plugin. Silent thinking does not produce a new activity signal.

The overview includes:

- **Today** — active study time, completed reviews, and time per document or folder.
- **This week** — a Monday–Sunday chart, total study time, and average time per study day.
- **Pomodoro** — a tomato for each completed interval today; hover for its timing details.

Session counters reset for a new review session; daily totals accumulate across sessions. Repeated reviews of the same card count again. Average time per card includes only completed reviews, so it can differ from total session time divided by the card count.

Statistics follow your device's local date. Renaming a document or folder preserves its recorded history. Saved totals may trail the live timer by a few seconds.

## Status bar settings

Choose which values appear and in what order:

| Option | Display |
| --- | --- |
| Session time | Active time in the current review session. |
| Number of cards | Completed reviews in the current session. |
| Average time per card | Average active time per completed review. |
| Total time today | Active study time across today's sessions. |
| Document time today | Today's time for the current card's document. |
| Group time today | Today's time in its nearest parent folder, including subfolders. |
| Pomodoro time | Remaining time in the current interval. |

Use **Add position** to add a value or **×** to remove one. **Restore default layout** returns to session time, card count, and average time without changing your Pomodoro settings. Save to apply changes.

Hover over a value for details. A dash means the corresponding document or folder is unavailable, or its total is still loading.

## Pomodoro timer

Enable **Pomodoro Timer** in settings and choose a duration, starting with the default **25 minutes**.

In flashcard-activity mode, the countdown advances only during active review and pauses with inactivity. Add **Pomodoro time** to the status bar to see the countdown; a shrinking blue line shows progress.

When an interval finishes, a notification and tomato celebration appear. Click the blinking countdown to start another interval, or select **Restart Pomodoro on Save** in settings. Breaks and repeats do not start automatically.

### Floating Pomodoro window

Use `/rrpomodoro` or search for **RR Pomodoro** to open the floating timer. You can also show or hide it with **… → RR Pomodoro** in a document or **… → RR Study Timer - Pomodoro** during review.

- **Start / Resume** runs the timer independently, including outside flashcards.
- **Pause** pauses the Pomodoro.
- **Use flashcard activity** makes the countdown follow active review again.
- **Settings** opens Pomodoro preferences; **Info** explains the timing modes.
- Drag the title bar to move the window. Use **−** to minimize it to a small clock; click the clock to restore it.

Click the main tomato to choose **red** (default), **gray**, **orange**, **yellow**, **green**, **black**, **white**, **blue**, or **purple**. Only the body color changes. Changing color keeps the current countdown; the color selected at completion is saved with that session. Previous sessions retain their colors, and older records appear red.

The floating window and review row share one timer. Hiding or minimizing the window does not pause it. Independent timing does not add time to your flashcard study statistics.

Completed intervals are saved. Reloading RemNote starts a fresh countdown and returns to flashcard-activity mode; a partially completed interval does not synchronize between devices.

## Privacy and saved data

Study statistics and completed Pomodoros are saved through RemNote's synchronized plugin storage. Records include study dates, durations, review counts, and document or folder references. The plugin does not send data directly to an external analytics service.

Only activity recorded while the plugin is running appears in the statistics. Abruptly closing RemNote can lose the latest unsaved activity. To avoid conflicting totals, study in one RemNote instance at a time.

## About

Created by Roland Russwurm. Licensed under the MIT License.

