require('ts-node/register');
const test = require('node:test');
const assert = require('node:assert/strict');
const { TimerEngine } = require('../src/timer_engine');
const { defaultSettings } = require('../src/settings');
const { savePomodoro, getDailyPomodoros, pomodoroTiming } = require('../src/pomodoro_history');
const { getLocalDateKey } = require('../src/daily_stats');
const card={id:'card',entity:null};

test('history captures active duration and exact start/finish across pauses and midnight', () => {
  const start=new Date(2026,8,12,23,59,30).getTime();
  const engine=new TimerEngine(30000);
  engine.pomodoro.configure({...defaultSettings(),pomodoroEnabled:true,pomodoroMinutes:1});
  engine.load(card,start);engine.advance(start+90000);
  assert.equal(engine.pomodoro.completed.length,0);
  engine.reveal(start+90000);engine.advance(start+125000);
  const [record]=engine.pomodoro.completed;
  assert.equal(record.startedAt,start);assert.equal(record.completedAt,start+120000);
  assert.equal(record.durationMs,60000);assert.equal(getLocalDateKey(new Date(record.completedAt)),'2026-09-13');
  assert.match(pomodoroTiming(record),/1 min active/);
  engine.advance(start+200000);assert.equal(engine.pomodoro.completed.length,1);
  assert.equal(engine.pomodoro.restartCompleted(),true);
  assert.equal(engine.pomodoro.restartCompleted(),false);
  engine.activity(start+200000);engine.advance(start+230000);engine.reveal(start+230000);engine.advance(start+260000);
  assert.equal(engine.pomodoro.completed.length,2);
  assert.notEqual(engine.pomodoro.completed[0].id,engine.pomodoro.completed[1].id);
});

test('saved records survive reloading, retain earlier records, and deduplicate ambiguous retries',async()=>{
  const data=new Map();let failOnce=true;
  const plugin={storage:{getSynced:async k=>structuredClone(data.get(k)),setSynced:async(k,v)=>{
    data.set(k,structuredClone(v));if(failOnce){failOnce=false;throw Error('Response lost after write');}
  }}};
  const start=new Date(2026,8,13,10).getTime();
  const first={id:'first',startedAt:start,completedAt:start+1500000,durationMs:1500000};
  await assert.rejects(savePomodoro(plugin,first));
  await savePomodoro(plugin,first);
  const second={...first,id:'second',startedAt:start+1800000,completedAt:start+3300000};
  await Promise.all([savePomodoro(plugin,second),savePomodoro(plugin,second)]);
  const reloaded={storage:{getSynced:async k=>structuredClone(data.get(k))}};
  assert.deepEqual(await getDailyPomodoros(reloaded,'2026-09-13'),[first,second]);
  assert.deepEqual(await getDailyPomodoros(reloaded,'2026-09-12'),[]);
});


test('color changes preserve countdown and completions retain their own color', async () => {
  const { PomodoroTimer } = require('../src/pomodoro');
  const { normalizeSettings } = require('../src/settings');
  const { normalizePomodoroColor } = require('../src/pomodoro_colors');
  assert.equal(normalizeSettings({}).pomodoroColor, 'red');
  assert.equal(normalizePomodoroColor('invalid'), 'red');
  const timer = new PomodoroTimer();
  const settings = {...defaultSettings(), pomodoroEnabled:true, pomodoroMinutes:1};
  timer.configure(settings); timer.advance(30000, 30000);
  timer.configure({...settings, pomodoroColor:'blue'});
  assert.equal(timer.snapshot().remainingMs,30000);
  timer.advance(30000,60000);
  assert.equal(timer.completed[0].color,'blue');
  timer.configure({...settings,pomodoroColor:'purple'});
  assert.equal(timer.completed[0].color,'blue');
  assert.equal(timer.restartCompleted(),true);
  timer.advance(60000,120000);
  assert.equal(timer.completed[1].color,'purple');
  const data=new Map(); const plugin={storage:{getSynced:async k=>data.get(k),setSynced:async(k,v)=>data.set(k,v)}};
  await savePomodoro(plugin,timer.completed[0]); await savePomodoro(plugin,timer.completed[1]);
  assert.deepEqual((await getDailyPomodoros(plugin,getLocalDateKey(new Date(60000)))).map(r=>r.color),['blue','purple']);
});

test('all SVG variants change only the supplied body path', () => {
  const fs=require('node:fs'),path=require('node:path');
  require('../scripts/pomodoro-colors.cjs');
  const source=fs.readFileSync(path.join(__dirname,'../public/pomodoro-tomato-comic-final.svg'),'utf8');
  const body=source.match(/<path\b(?=[^>]*\bid="path74")[^>]*\/>/)[0];
  const {POMODORO_COLORS}=require('../src/pomodoro_colors');
  for(const [name,,color] of POMODORO_COLORS) {
    const svg=fs.readFileSync(path.join(__dirname,`../public/pomodoro-colors/${name}.svg`),'utf8');
    assert.equal(svg,source.replace(body,body.replace('fill:#f92015',`fill:${color}`)));
  }
});
