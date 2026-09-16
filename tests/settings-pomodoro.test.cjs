require('ts-node/register');
const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultSettings, normalizeSettings, METRICS } = require('../src/settings');
const { TimerEngine } = require('../src/timer_engine');
const { PomodoroTimer } = require('../src/pomodoro');
const card = { id: 'a', entity: { id: 'doc', title: 'Document', kind: 'document' } };

test('default layout is preserved; all metrics and duplicates survive settings round-trip', () => {
  assert.deepEqual(normalizeSettings(undefined), { positions: ['session', 'cards', 'average'], pomodoroEnabled: false, pomodoroMinutes: 25, pomodoroColor: 'red', pomodoroName: '', restartToken: '' });
  const positions = [...METRICS.map(([id]) => id), 'document'];
  assert.deepEqual(normalizeSettings({ positions }).positions, positions);
  assert.deepEqual(normalizeSettings({ positions: ['invalid'] }).positions, defaultSettings().positions);
  for (const invalid of [0, -2, NaN, Infinity, '25', 1441]) {
    assert.equal(normalizeSettings({ pomodoroMinutes: invalid }).pomodoroMinutes, 25);
  }
});

test('Pomodoro excludes idle, hidden surfaces, lookback and queue exit; new sessions retain progress', () => {
  const e = new TimerEngine(10000);
  e.pomodoro.configure({ ...defaultSettings(), pomodoroEnabled: true, pomodoroMinutes: 1 });
  e.load(card, 1000); e.advance(31000);
  assert.equal(e.pomodoro.snapshot().remainingMs, 50000);
  e.reveal(31000); e.visibility(true, 35000); e.advance(90000);
  assert.equal(e.pomodoro.snapshot().remainingMs, 46000);
  e.visibility(false, 90000); e.exit(93000); e.advance(150000);
  assert.equal(e.pomodoro.snapshot().remainingMs, 43000);
  e.enter(150000); e.load({ ...card, lookback: true }, 150000); e.advance(170000);
  assert.equal(e.pomodoro.snapshot().remainingMs, 43000);
  e.load(card, 170000); e.complete(175000);
  assert.equal(e.pomodoro.snapshot().remainingMs, 38000);
});

test('completion clamps to zero, notifies once and waits for explicit restart', () => {
  const p = new PomodoroTimer();
  const settings = { ...defaultSettings(), pomodoroEnabled: true, pomodoroMinutes: 1 };
  p.configure(settings); p.advance(65000);
  assert.equal(p.snapshot().remainingMs, 0); assert.equal(p.snapshot().finished, true);
  assert.equal(p.takeNotification(), true); assert.equal(p.takeNotification(), false);
  p.advance(60000); p.configure({ ...settings, positions: ['today'] });
  assert.equal(p.snapshot().finished, true); assert.equal(p.takeNotification(), false);
  p.configure({ ...settings, restartToken: 'restart-1' });
  assert.equal(p.snapshot().remainingMs, 60000); assert.equal(p.snapshot().finished, false);
  p.advance(60000); assert.equal(p.takeNotification(), true);
});

test('enable and duration changes start fresh; disabled timers do not advance', () => {
  const p = new PomodoroTimer();
  p.advance(900000); assert.equal(p.snapshot().remainingMs, 1500000);
  p.configure({ ...defaultSettings(), pomodoroEnabled: true }); p.advance(10000);
  p.configure({ ...defaultSettings(), pomodoroEnabled: true, positions: ['group'] });
  assert.equal(p.snapshot().remainingMs, 1490000);
  p.configure({ ...defaultSettings(), pomodoroEnabled: true, pomodoroMinutes: 5 });
  assert.equal(p.snapshot().remainingMs, 300000);
  p.configure(defaultSettings()); p.advance(30000);
  assert.equal(p.snapshot().enabled, false); assert.equal(p.snapshot().remainingMs, 1500000);
});
