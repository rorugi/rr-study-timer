import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation, PluginCommandMenuLocation } from '@remnote/plugin-sdk';
import { startTracking } from '../tracking_service';
import '../style.css';
import '../index.css';
let stopTracking: (() => Promise<void>) | undefined;
async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerNumberSetting({ id: 'idle-timeout-seconds',
    title: 'Pause after inactivity (seconds)', defaultValue: 30 });
  stopTracking = await startTracking(plugin);
  await plugin.app.registerWidget('study_timer', WidgetLocation.QueueBelowTopBar, {
    dimensions: { height: 'auto', width: '100%' } });
  await plugin.app.registerWidget('settings', WidgetLocation.FloatingWidget, {
    dimensions: { height: 'auto', width: 480 } });
  await plugin.app.registerMenuItem({ id: 'rr-study-timer-settings', name: 'RR Study Timer',
    location: PluginCommandMenuLocation.QueueMenu,
    action: async () => { await plugin.widget.openPopup('settings', undefined, false); } });
  // Verified in the user's desktop app. DeckPage did not render on Flashcard Home.
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
