import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerNumberSetting({
    id: 'idle-timeout-seconds',
    title: 'Pause after inactivity (seconds)',
    defaultValue: 30,
  });

  await plugin.app.registerWidget('study_timer', WidgetLocation.QueueToolbar, {
    dimensions: {
      height: 'auto',
      width: 'auto',
    },
  });

  // Home/start page. RemNote does not expose a supported widget slot inside
  // its native Daily Goal card; Index is the supported home-page location.
  await plugin.app.registerWidget('home_summary', WidgetLocation.Index, {
    dimensions: {
      height: 'auto',
      width: '100%',
    },
  });

  // Flashcard overview / learning-progress page.
  await plugin.app.registerWidget('daily_statistics', WidgetLocation.LearningProgressPage, {
    dimensions: {
      height: 'auto',
      width: '100%',
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
