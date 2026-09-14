require('ts-node/register');
const test = require('node:test');
const assert = require('node:assert/strict');
const { TimerEngine } = require('../src/timer_engine');
const { defaultSettings } = require('../src/settings');
const configure = e => e.pomodoro.configure({...defaultSettings(),pomodoroEnabled:true,pomodoroMinutes:1});

test('independent timer runs without cards, pauses, resumes and records one completion',()=>{
  const e=new TimerEngine(); configure(e);
  e.setPomodoroMode('running',1000); e.advance(11000);
  assert.equal(e.pomodoro.snapshot().remainingMs,50000);
  assert.equal(e.snapshot(11000).sessionMs,0); assert.equal(e.pending.length,0);
  e.setPomodoroMode('paused',11000); e.advance(51000);
  assert.equal(e.pomodoro.snapshot().remainingMs,50000);
  e.setPomodoroMode('running',51000); e.advance(101000); e.advance(111000);
  assert.equal(e.pomodoro.completed.length,1);
  assert.deepEqual([e.pomodoro.completed[0].startedAt,e.pomodoro.completed[0].completedAt,e.pomodoro.completed[0].durationMs],[1000,101000,60000]);
});

test('parallel flashcards do not double count; mode transitions preserve remaining time',()=>{
  const e=new TimerEngine(5000); configure(e);
  e.load({id:'a',entity:null},1000); e.setPomodoroMode('running',1000); e.advance(11000);
  assert.equal(e.pomodoro.snapshot().remainingMs,50000);
  assert.equal(e.snapshot(11000).sessionMs,5000);
  e.setPomodoroMode('paused',11000); e.activity(11000); e.advance(14000);
  assert.equal(e.pomodoro.snapshot().remainingMs,50000);
  assert.equal(e.snapshot(14000).sessionMs,8000);
  e.setPomodoroMode('flashcards',14000); e.advance(21000);
  assert.equal(e.pomodoro.snapshot().remainingMs,48000);
  e.exit(21000); e.advance(31000); assert.equal(e.pomodoro.snapshot().remainingMs,48000);
  e.setPomodoroMode('running',31000); e.enter(35000); e.advance(41000);
  assert.equal(e.pomodoro.snapshot().remainingMs,38000);
});
