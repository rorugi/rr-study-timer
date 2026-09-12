require('ts-node/register');
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const originalLoad=Module._load;
const events={QueueEnter:'queue.enter',QueueExit:'queue.exit',QueueLoadCard:'queue.load-card',
  RevealAnswer:'queue.reveal-answer',QueueCompleteCard:'queue.complete-card'};
Module._load=function(id,...args){if(id==='@remnote/plugin-sdk')return {QueueEvent:events};return originalLoad.call(this,id,...args)};
const {startTracking,TIMER_STATE_KEY}=require('../src/tracking_service');
Module._load=originalLoad;
const {getDailyStudyStats,getLocalDateKey}=require('../src/daily_stats');
const {SETTINGS_KEY,POMODORO_RESTART_KEY,defaultSettings}=require('../src/settings');
const {getDailyPomodoros}=require('../src/pomodoro_history');

test('live settings reach the status row and completion produces one service notification',async()=>{
  const realNow=Date.now;let now=new Date(2026,8,12,12).getTime();Date.now=()=>now;
  const listeners=new Map(),data=new Map(),session=new Map(),notifications=[],popups=[];
  let config={...defaultSettings(),pomodoroEnabled:true,pomodoroMinutes:1};
  const plugin={settings:{getSetting:async()=>300},
    app:{toast:async message=>notifications.push(message)},
    widget:{openPopup:async (...args)=>popups.push(args)},
    event:{addListener:(e,k,cb)=>listeners.set(e,cb),removeListener:e=>listeners.delete(e)},
    queue:{getCurrentCard:async()=>({_id:'a',remId:'doc'}),inLookbackMode:async()=>false},
    rem:{findOne:async id=>({_id:id,text:[id],isFolder:async()=>false,isDocument:async()=>true})},
    richText:{toString:async text=>text[0]},
    storage:{getSynced:async key=>key===SETTINGS_KEY?structuredClone(config):structuredClone(data.get(key)),
      setSynced:async(key,value)=>data.set(key,structuredClone(value)),getSession:async key=>session.get(key),
      setSession:async(key,value)=>session.set(key,structuredClone(value))}};
  const settle=()=>new Promise(resolve=>setTimeout(resolve,35));let stop;
  try {
    stop=await startTracking(plugin,{rpcTimeoutMs:20,pollIntervalMs:5});await settle();
    now+=15000;await settle();
    assert.equal(session.get(TIMER_STATE_KEY).pomodoro.remainingMs,45000);
    config={...config,positions:['document','pomodoro','group']};await settle();
    assert.deepEqual(session.get(TIMER_STATE_KEY).settings.positions,config.positions);
    assert.equal(session.get(TIMER_STATE_KEY).pomodoro.remainingMs,45000);
    now+=45000;await settle();
    assert.equal(session.get(TIMER_STATE_KEY).pomodoro.finished,true);assert.equal(notifications.length,1);
    assert.deepEqual(popups,[['pomodoro_complete',{},false]]);
    now+=5000;await settle();assert.equal(notifications.length,1);assert.equal(popups.length,1);
    const previousSessionMs=session.get(TIMER_STATE_KEY).sessionMs;
    session.set(POMODORO_RESTART_KEY,{id:'clicked-timer'});await settle();
    assert.equal(session.get(TIMER_STATE_KEY).sessionMs,previousSessionMs);
    assert.equal(session.get(TIMER_STATE_KEY).pomodoro.remainingMs,60000);
    now+=1000;await settle();assert.equal(session.get(TIMER_STATE_KEY).pomodoro.remainingMs,59000);
    now+=59000;await settle();assert.equal(notifications.length,2);assert.equal(popups.length,2);
    await stop();stop=null;
    const history=await getDailyPomodoros(plugin);assert.equal(history.length,2);
    assert.ok(history.every(record=>record.durationMs===60000));
    assert.ok(history[1].startedAt>history[0].completedAt);
  }finally{if(stop)await stop();Date.now=realNow;}
});
test('index service handles global events, first-card bootstrap and async card changes without widgets',async()=>{
  const realNow=Date.now;let now=new Date(2026,8,11,12).getTime();Date.now=()=>now;
  global.document={hidden:false,addEventListener(){},removeEventListener(){}};
  const listeners=new Map(),data=new Map(),session=new Map();
  let current={_id:'a',remId:'ra'};
  const plugin={
    settings:{getSetting:async()=>30},
    event:{addListener(event,key,cb){assert.equal(key,undefined);listeners.set(event,cb)},removeListener(event,key,cb){assert.equal(listeners.get(event),cb);listeners.delete(event)}},
    queue:{getCurrentCard:()=>Promise.resolve(current),inLookbackMode:async()=>false,
      getCurrentQueueScreenType(){throw Error('Must not query screen during completion')}},
    rem:{findOne:async id=>({_id:id,text:[id],isFolder:async()=>false,isDocument:async()=>true})},
    richText:{toString:async t=>t[0]},
    storage:{getSession:async()=>undefined,getSynced:async k=>structuredClone(data.get(k)),setSynced:async(k,v)=>data.set(k,structuredClone(v)),
      setSession:async(k,v)=>session.set(k,structuredClone(v))}
  };
  let stop;
  try {
    stop=await startTracking(plugin);
    now+=2000;listeners.get(events.RevealAnswer)();
    now+=1000;current=undefined;listeners.get(events.QueueCompleteCard)();
    current={_id:'b',remId:'rb'};listeners.get(events.QueueLoadCard)();
    now+=4000;current=undefined;listeners.get(events.QueueCompleteCard)();
    listeners.get(events.QueueExit)();
    await stop();stop=null;
    const stats=await getDailyStudyStats(plugin,getLocalDateKey(new Date(now)));
    assert.equal(stats.totalCardsCompleted,2);assert.equal(stats.totalActiveMs,7000);
    assert.equal(stats.entities.ra.activeMs,3000);assert.equal(stats.entities.rb.activeMs,4000);
    assert.equal(session.get(TIMER_STATE_KEY).cards,2);assert.equal(listeners.size,0);
  } finally {if(stop)await stop();Date.now=realNow;delete global.document;}
});

test('timer survives stalled storage, publication timeout and missed load after idle',async()=>{
  const realNow=Date.now, realError=console.error;
  let now=new Date(2026,8,11,12).getTime();Date.now=()=>now;
  console.error=()=>{};
  global.document={hidden:false,addEventListener(){},removeEventListener(){}};
  const listeners=new Map();let state;let firstPublish=true;
  let current={_id:'a',remId:'ra'};
  const never=new Promise(()=>{});
  const plugin={
    settings:{getSetting:async()=>30},
    event:{addListener:(e,k,cb)=>listeners.set(e,cb),removeListener:e=>listeners.delete(e)},
    queue:{getCurrentCard:async()=>current,inLookbackMode:async()=>false},
    rem:{findOne:async id=>({_id:id,text:[id],isFolder:async()=>false,isDocument:async()=>true})},
    richText:{toString:async t=>t[0]},
    storage:{getSession:async()=>undefined,getSynced:()=>never,setSynced:async()=>{},setSession:async(k,v)=>{
      if(firstPublish){firstPublish=false;return never;}if(k===TIMER_STATE_KEY)state=structuredClone(v);
    }}
  };
  const settle=()=>new Promise(resolve=>setTimeout(resolve,45));
  let stop;
  try {
    stop=await startTracking(plugin,{rpcTimeoutMs:10,pollIntervalMs:5});await settle();
    now+=14000;await settle();assert.equal(state.sessionMs,14000);
    now+=3000;await settle();assert.equal(state.sessionMs,17000);
    now+=20000;await settle();assert.equal(state.sessionMs,30000);assert.equal(state.paused,true);
    // Same-card polling did not restart inactivity; a missed next-card event recovers.
    current={_id:'b',remId:'rb'};await settle();assert.equal(state.paused,false);
    now+=2000;await settle();assert.equal(state.sessionMs,32000);assert.equal(state.cardId,'b');
    listeners.get(events.QueueCompleteCard)();await settle();
    now+=1000;await settle();assert.equal(state.sessionMs,32000);assert.equal(state.cards,1);
    // Explicit next load can use the same card ID for another repetition.
    listeners.get(events.QueueLoadCard)();await settle();now+=1000;await settle();
    assert.equal(state.sessionMs,33000);
  } finally {if(stop)await stop();Date.now=realNow;console.error=realError;delete global.document;}
});


test('hidden index does not freeze time at 26 seconds while queue remains visible',async()=>{
  const realNow=Date.now;let now=new Date(2026,8,11,12).getTime();Date.now=()=>now;
  global.document={hidden:false,addEventListener(){},removeEventListener(){}};
  const listeners=new Map(),data=new Map();let state;let visible=true;
  let current={_id:'a',remId:'ra'};
  const plugin={
    settings:{getSetting:async()=>30},
    event:{addListener:(e,k,cb)=>listeners.set(e,cb),removeListener:e=>listeners.delete(e)},
    queue:{getCurrentCard:async()=>current,inLookbackMode:async()=>false},
    rem:{findOne:async id=>({_id:id,text:[id],isFolder:async()=>false,isDocument:async()=>true})},
    richText:{toString:async t=>t[0]},
    storage:{getSession:async()=>({visible,at:now}),getSynced:async k=>structuredClone(data.get(k)),
      setSynced:async(k,v)=>data.set(k,structuredClone(v)),setSession:async(k,v)=>{if(k===TIMER_STATE_KEY)state=structuredClone(v)}}
  };
  const settle=()=>new Promise(resolve=>setTimeout(resolve,30));let stop;
  try {
    stop=await startTracking(plugin,{rpcTimeoutMs:10,pollIntervalMs:5});await settle();
    now+=26000;await settle();assert.equal(state.sessionMs,26000);
    document.hidden=true; // Host hides the index iframe, not the queue.
    listeners.get(events.QueueCompleteCard)();await settle();
    for(let i=0;i<4;i++){
      current={_id:'b'+i,remId:'rb'};listeners.get(events.QueueLoadCard)();await settle();
      now+=5000;listeners.get(events.RevealAnswer)();await settle();
      now+=1000;listeners.get(events.QueueCompleteCard)();await settle();
    }
    assert.equal(state.cards,5);assert.equal(state.sessionMs,50000);
    current={_id:'idle',remId:'rb'};listeners.get(events.QueueLoadCard)();await settle();
    now+=35000;await settle();assert.equal(state.sessionMs,80000);assert.equal(state.paused,true);
    // Repeated visible heartbeats MUST NOT defeat inactivity.
    now+=10000;await settle();assert.equal(state.sessionMs,80000);
    listeners.get(events.RevealAnswer)();await settle();now+=2000;await settle();
    assert.equal(state.sessionMs,82000);assert.equal(state.paused,false);
    visible=false;await settle();now+=10000;await settle();assert.equal(state.sessionMs,82000);
    visible=true;await settle();now+=2000;await settle();assert.equal(state.sessionMs,84000);
  } finally {if(stop)await stop();Date.now=realNow;delete global.document;}
});


test('SDK service replays observed load B / complete A order with delayed load response',async()=>{
  const realNow=Date.now;let now=17789;Date.now=()=>now;
  const listeners=new Map(),stored=new Map();let state;
  let current={_id:'card-1',remId:'doc-1'};let deferred;let blockNext=false;
  const plugin={
    settings:{getSetting:async()=>30},
    event:{addListener:(e,k,cb)=>listeners.set(e,cb),removeListener:e=>listeners.delete(e)},
    queue:{getCurrentCard:()=>{const snapshot=current;if(blockNext){blockNext=false;return new Promise(resolve=>{deferred=()=>resolve(snapshot)});}return Promise.resolve(snapshot);},inLookbackMode:async()=>false},
    rem:{findOne:async id=>({_id:id,text:[id],isFolder:async()=>false,isDocument:async()=>true})},
    richText:{toString:async t=>t[0]},
    storage:{getSession:async()=>undefined,getSynced:async k=>structuredClone(stored.get(k)),
      setSynced:async(k,v)=>stored.set(k,structuredClone(v)),setSession:async(k,v)=>{if(k===TIMER_STATE_KEY)state=structuredClone(v)}}
  };
  const settle=()=>new Promise(resolve=>setTimeout(resolve,30));let stop;
  try {
    stop=await startTracking(plugin,{rpcTimeoutMs:500,pollIntervalMs:5});await settle();
    now=23473;listeners.get(events.RevealAnswer)({cardId:'card-1'});await settle();
    now=26911;current={_id:'card-2',remId:'doc-2'};blockNext=true;
    listeners.get(events.QueueLoadCard)({cardId:'card-2'});
    now=27107;listeners.get(events.QueueCompleteCard)({cardId:'card-1',score:1});
    now=27507;deferred();await settle();
    assert.equal(state.cards,1);assert.equal(state.averageMs,9122);
    assert.equal(state.cardId,'card-2');assert.equal(state.active,true);
    now=36476;listeners.get(events.RevealAnswer)({cardId:'card-2'});await settle();
    assert.equal(state.recallMs,9565);assert.equal(state.sessionMs,18687);
    await stop();stop=null;
    const credits=[...stored.values()];
    assert.equal(credits.reduce((n,v)=>n+v.totalCardsCompleted,0),1);
    assert.equal(credits[0].entities['doc-1'].cardsCompleted,1);
    assert.equal(credits[0].entities['doc-2'].cardsCompleted,0);
  } finally {if(stop)await stop();Date.now=realNow;}
});
