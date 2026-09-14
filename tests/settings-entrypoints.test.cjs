require('ts-node/register');
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('upgrading replaces the floating widget; review menu and slash command open the registered popup', async () => {
  const originalLoad = Module._load;
  const originalCss = require.extensions['.css'];
  let activate, deactivate, stops = 0;
  const locations = { FloatingWidget: 'FloatingWidget', Popup: 'Popup', QueueBelowTopBar: 'QueueBelowTopBar',
    LearningProgressPage: 'LearningProgressPage', Pane: 'Pane' };
  require.extensions['.css'] = () => {};
  Module._load = function(id, ...args) {
    if (id === '@remnote/plugin-sdk') return { WidgetLocation: locations,
      PluginCommandMenuLocation: { QueueMenu: 'QueueMenu' },
      declareIndexPlugin: (on, off) => { activate = on; deactivate = off; } };
    if (id === '../tracking_service') return { startTracking: async () => async () => { stops++; } };
    return originalLoad.call(this, id, ...args);
  };
  try { require('../src/widgets/index'); }
  finally { Module._load = originalLoad; if (originalCss) require.extensions['.css'] = originalCss; else delete require.extensions['.css']; }

  const widgets = new Map([['settings:FloatingWidget', { dimensions: { height: 'auto', width: 480 } }]]);
  const menus = new Map(), commands = new Map(), opened = [], registrationEvents = [];
  const plugin = {
    settings: { registerNumberSetting: async () => {} },
    app: {
      registerCSS: async (id, css) => { assert.equal(id, 'rr-study-timer-statistics-layout'); assert.match(css, /grid-column: 1 \/ -1/); },
      unregisterWidget: async (file, location) => { registrationEvents.push(['remove', file, location]); widgets.delete(`${file}:${location}`); },
      registerWidget: async (file, location, options) => { registrationEvents.push(['add', file, location]); widgets.set(`${file}:${location}`, options); },
      registerMenuItem: async item => menus.set(item.id, item),
      registerCommand: async command => commands.set(command.id, command),
    },
    widget: { openPopup: async (file, context) => {
      assert.ok(widgets.has(`${file}:Popup`), 'openPopup must target a widget registered at Popup');
      opened.push({ file, context });
    } },
    window: { openWidgetInPane: async () => {},
      openFloatingWidget: async (file, position, container, outside) => {
        assert.equal(file,'pomodoro_window'); assert.equal(outside,false);
        assert.ok(widgets.has(`${file}:FloatingWidget`)); opened.push({floating:file}); return 'timer-window';
      }, isFloatingWidgetOpen: async id => id === 'timer-window' },
  };
  await activate(plugin);
  assert.equal(widgets.has('daily_statistics:LearningProgressPage'), true);
  for (const card of ['weekly_statistics', 'today_statistics', 'pomodoro_statistics']) {
    assert.equal(widgets.has(`${card}:LearningProgressPage`), false);
  }
  assert.ok(widgets.has('daily_statistics:Pane'));
  assert.deepEqual(widgets.get('pomodoro_complete:Popup'), { dimensions: { height: 'auto', width: 420 } });
  assert.equal(widgets.has('settings:FloatingWidget'), false);
  assert.deepEqual(widgets.get('settings:Popup'), { dimensions: { height: 'auto', width: 480 } });
  const popupAdded = registrationEvents.findIndex(([action,file,location]) => action === 'add' && file === 'settings' && location === 'Popup');
  assert.ok(registrationEvents.findIndex(([action,file,location]) => action === 'remove' && file === 'settings' && location === 'FloatingWidget') < popupAdded);
  const menu = menus.get('rr-study-timer-settings');
  assert.equal(menu.name, 'RR Study Timer'); assert.equal(menu.location, 'QueueMenu');
  const command = commands.get('rrstudytimer');
  assert.equal(command.name, 'RR Study Timer: Settings'); assert.equal(command.quickCode, 'rrstudytimer');
  await menu.action(); await command.action();
  assert.deepEqual(opened, [{ file: 'settings', context: {} }, { file: 'settings', context: {} }]);
  const pomodoroCommand=commands.get('rrpomodoro'); assert.equal(pomodoroCommand.quickCode,'rrpomodoro');
  await pomodoroCommand.action(); await pomodoroCommand.action();
  assert.equal(opened.filter(item=>item.floating==='pomodoro_window').length,1);
  await deactivate(plugin); assert.equal(stops, 1);
});
