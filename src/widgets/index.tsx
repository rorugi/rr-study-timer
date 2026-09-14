import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation, PluginCommandMenuLocation } from '@remnote/plugin-sdk';
import { startTracking } from '../tracking_service';
import { statisticsHostCSS } from '../statistics_layout';
import '../style.css';
import '../index.css';
let stopTracking: (() => Promise<void>) | undefined;
async function onActivate(plugin: ReactRNPlugin) {
  let pomodoroWindowId: string | undefined;
  let openingPomodoro = false;
  await plugin.app.registerWidget('pomodoro_window', WidgetLocation.FloatingWidget, {
    dimensions: { height: 'auto', width: 320 } });
  await plugin.app.registerCommand({ id: 'rrpomodoro', name: 'RR Pomodoro', quickCode: 'rrpomodoro',
    description: 'Open the shared Pomodoro countdown in a floating window.',
    action: async () => {
      if (openingPomodoro) return;
      openingPomodoro = true;
      try {
        if (pomodoroWindowId && await plugin.window.isFloatingWidgetOpen(pomodoroWindowId)) return;
        pomodoroWindowId = await plugin.window.openFloatingWidget('pomodoro_window', { top: 80, right: 24 },
          'rr-pomodoro-floating-window', false);
      } finally { openingPomodoro = false; }
    } });
  await plugin.settings.registerNumberSetting({ id: 'idle-timeout-seconds',
    title: 'Pause after inactivity (seconds)', defaultValue: 30 });
  await plugin.app.registerWidget('pomodoro_complete', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: 420 } });
  stopTracking = await startTracking(plugin);
  await plugin.app.registerWidget('study_timer', WidgetLocation.QueueBelowTopBar, {
    dimensions: { height: 'auto', width: '100%' } });
  // Match RR Smart TTS: openPopup requires a Popup registration, not FloatingWidget.
  await plugin.app.unregisterWidget('settings', WidgetLocation.FloatingWidget);
  await plugin.app.unregisterWidget('settings', WidgetLocation.Popup);
  await plugin.app.registerWidget('settings', WidgetLocation.Popup, {
    dimensions: { height: 'auto', width: 480 } });
  const openSettings = async () => { await plugin.widget.openPopup('settings', {}); };
  await plugin.app.registerMenuItem({ id: 'rr-study-timer-settings', name: 'RR Study Timer',
    location: PluginCommandMenuLocation.QueueMenu,
    action: openSettings });
  await plugin.app.registerCommand({ id: 'rrstudytimer', name: 'RR Study Timer: Settings',
    quickCode: 'rrstudytimer', keywords: 'RR Study Timer settings pomodoro status bar',
    description: 'Open RR Study Timer settings.', action: openSettings });
  // Verified in the user's desktop app. DeckPage did not render on Flashcard Home.
  await plugin.app.registerCSS('rr-study-timer-statistics-layout', statisticsHostCSS);
  // All widgets at this location share one host outlet. Use one responsive grid
  // within it, and remove the separate registrations left by version 0.6.4.
  for (const widget of ['weekly_statistics', 'today_statistics', 'pomodoro_statistics']) {
    await plugin.app.unregisterWidget(widget, WidgetLocation.LearningProgressPage);
  }
  await plugin.app.registerWidget('daily_statistics', WidgetLocation.LearningProgressPage, {
    dimensions: { height: 'auto', width: '100%' } });
  await plugin.app.registerWidget('daily_statistics', WidgetLocation.Pane, {
    dimensions: { height: 'auto', width: '100%' } });
  await plugin.app.registerCommand({ id: 'show-study-overview', name: 'Lernzeit anzeigen',
    action: async () => { await plugin.window.openWidgetInPane('daily_statistics'); } });
}
async function onDeactivate(_: ReactRNPlugin) {
  await stopTracking?.(); stopTracking = undefined;
}
declareIndexPlugin(onActivate, onDeactivate);
