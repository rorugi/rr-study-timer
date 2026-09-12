import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation, PluginCommandMenuLocation } from '@remnote/plugin-sdk';
import { startTracking } from '../tracking_service';
import '../style.css';
import '../index.css';
let stopTracking: (() => Promise<void>) | undefined;
async function onActivate(plugin: ReactRNPlugin) {
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
  // Give each card its own host grid slot instead of nesting all cards in one column.
  await plugin.app.unregisterWidget('daily_statistics', WidgetLocation.LearningProgressPage);
  for (const widget of ['weekly_statistics', 'today_statistics', 'pomodoro_statistics']) {
    await plugin.app.registerWidget(widget, WidgetLocation.LearningProgressPage, {
      dimensions: { height: 'auto', width: '100%' } });
  }
  await plugin.app.registerWidget('daily_statistics', WidgetLocation.Pane, {
    dimensions: { height: 'auto', width: '100%' } });
  await plugin.app.registerCommand({ id: 'show-study-overview', name: 'Lernzeit anzeigen',
    action: async () => { await plugin.window.openWidgetInPane('daily_statistics'); } });
}
async function onDeactivate(_: ReactRNPlugin) {
  await stopTracking?.(); stopTracking = undefined;
}
declareIndexPlugin(onActivate, onDeactivate);
