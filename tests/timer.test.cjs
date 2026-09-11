require('ts-node/register');
const test = require('node:test');
const assert = require('node:assert/strict');
const { TimerEngine } = require('../src/timer_engine');
const { addDailyStudyTime, getDailyStudyStats, resolveTrackedEntityFromRemId, resolveCurrentTrackedEntity,
  getCurrentWeekDates, getLocalDateKey } = require('../src/daily_stats');
const card = {id:'card-a',entity:{id:'doc-a',kind:'document',title:'Old name'}};
const sum = e => e.pending.reduce((s,p)=>s+p.ms,0);

test('idle is clipped, reveal resumes without crediting idle gap', () => {
  const e=new TimerEngine(30000);e.load(card,1000);e.advance(61000);
  assert.equal(sum(e),30000);e.reveal(61000);e.complete(66000);
  assert.equal(sum(e),35000);assert.equal(e.snapshot(66000).cards,1);
  e.complete(67000);assert.equal(e.snapshot(67000).cards,1);
});
test('background and system screens receive no time; exit retains unfinished time',()=>{
  const e=new TimerEngine();e.load(card,1000);e.visibility(true,6000);
  e.advance(50000);e.visibility(false,60000);e.exit(63000);e.advance(90000);
  assert.equal(sum(e),8000);assert.equal(e.snapshot(90000).cards,0);
  e.load(null,91000);e.complete(94000);assert.equal(sum(e),8000);
});
test('time splits at local midnight; completion belongs to new day',()=>{
  const start=new Date(2026,8,11,23,59,55).getTime();
  const e=new TimerEngine();e.load(card,start);e.complete(start+10000);
  assert.deepEqual(e.pending.map(p=>[p.date,p.ms,p.cards]),[
    ['2026-09-11',5000,0],['2026-09-12',5000,0],['2026-09-12',0,1]]);
});
test('card attribution survives fast switches and lookback is excluded',()=>{
  const e=new TimerEngine();e.load(card,1000);e.complete(3000);
  e.load({id:'b',entity:{id:'folder-b',title:'Folder',kind:'folder'}},3000);e.complete(7000);
  assert.deepEqual(e.pending.filter(p=>p.ms).map(p=>[p.entity.id,p.ms]),[['doc-a',2000],['folder-b',4000]]);
  e.load({...card,lookback:true},8000);e.complete(10000);assert.equal(e.snapshot(10000).cards,2);
});
function storage() {
  const data = new Map();
  return { data, plugin:{ storage:{getSynced:async k=>structuredClone(data.get(k)),
    setSynced:async(k,v)=>{data.set(k,structuredClone(v));}}}};
}
test('serialized writes preserve rapid completions and existing v1 history',async()=>{
  const {plugin}=storage();
  await addDailyStudyTime(plugin,1000,card.entity,1,'2026-09-11');
  await Promise.all(Array.from({length:20},(_,i)=>addDailyStudyTime(plugin,100,card.entity,1,'2026-09-11',String(i))));
  const s=await getDailyStudyStats(plugin,'2026-09-11');assert.equal(s.totalActiveMs,3000);assert.equal(s.totalCardsCompleted,21);
});
test('retry after ambiguous storage response does not duplicate credit',async()=>{
  const {plugin}=storage();const write=plugin.storage.setSynced;let fail=true;
  plugin.storage.setSynced=async(k,v)=>{await write(k,v);if(fail){fail=false;throw Error('response lost');}};
  await assert.rejects(addDailyStudyTime(plugin,1200,card.entity,1,'2026-09-11','retry-1'));
  await addDailyStudyTime(plugin,1200,card.entity,1,'2026-09-11','retry-1');
  const s=await getDailyStudyStats(plugin,'2026-09-11');assert.equal(s.totalActiveMs,1200);assert.equal(s.totalCardsCompleted,1);
});
test('stable folder identity takes precedence over document flag and refreshes title',async()=>{
  let title='Folder';const folder={_id:'f',get text(){return [title]},isFolder:async()=>true,isDocument:async()=>true};
  const plugin={rem:{findOne:async id=>id==='f'?folder:{isFolder:async()=>false,isDocument:async()=>false,getParentRem:async()=>folder}},richText:{toString:async t=>t[0]}};
  const entity=await resolveTrackedEntityFromRemId(plugin,'r');assert.equal(entity.kind,'folder');assert.equal(entity.id,'f');
  title='Renamed';const current=await resolveCurrentTrackedEntity(plugin,{entityId:'f',kind:'folder',title:'Folder'});
  assert.equal(current.id,'f');assert.equal(current.title,'Renamed');
});
test('current week starts Monday, including Sunday and year boundary',()=>{
  assert.deepEqual(getCurrentWeekDates(new Date(2027,0,3)).map(d=>getLocalDateKey(d)),
    ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
});

test('duplicate same-card load preserves recall and average for four eight-second cards',()=>{
  const e=new TimerEngine();
  for(let i=0;i<4;i++){
    const start=1000+i*8000, c={...card,id:'card-'+i};
    e.load(c,start);
    e.advance(start+7000);
    e.load(c,start+7900); // re-announced just before answer / rating
    e.reveal(start+7900);
    e.load(c,start+7950); // answer render must not erase frozen recall either
    assert.equal(e.snapshot(start+7950).recallMs,7900);
    e.complete(start+8000);
  }
  const s=e.snapshot(33000);
  assert.equal(s.cards,4);assert.equal(s.sessionMs,32000);
  assert.equal(s.averageMs,8000);assert.equal(s.recallMs,7900);
  assert.equal(s.averageMs*s.cards,s.sessionMs);
});

test('duplicate loads do not keep an idle card artificially active',()=>{
  const e=new TimerEngine();e.load(card,1000);
  for(let i=1;i<=60;i++) e.load(card,1000+i*1000);
  assert.equal(e.snapshot(61000).sessionMs,30000);
  assert.equal(e.snapshot(61000).paused,true);
  e.reveal(61000);e.complete(64000);assert.equal(e.snapshot(64000).sessionMs,33000);
});

test('replays desktop trace: load B precedes completion A by 196ms',()=>{
  const e=new TimerEngine();
  const a={id:'card-1',entity:{id:'doc-1',kind:'document',title:'A'}};
  const b={id:'card-2',entity:{id:'doc-2',kind:'document',title:'B'}};
  e.load(a,17789);
  e.reveal(23473,'card-1');
  e.advance(26008);
  e.load(b,26911);
  e.advance(27005);
  e.complete(27107,'card-1');
  let s=e.snapshot(27107);
  assert.equal(s.cards,1);assert.equal(s.averageMs,9122);
  assert.equal(s.active,true);assert.equal(s.cardId,'card-2');
  assert.equal(s.cardMs,196);assert.equal(s.recallMs,null);
  e.reveal(36476,'card-2');
  s=e.snapshot(36476);
  assert.equal(s.sessionMs,18687);assert.equal(s.recallMs,9565);
  e.complete(37000,'card-2');
  s=e.snapshot(37000);
  assert.equal(s.cards,2);assert.equal(s.averageMs,9605.5);
  assert.equal(s.averageMs*s.cards,s.sessionMs);
  const completed=e.pending.filter(p=>p.cards);
  assert.deepEqual(completed.map(p=>p.entity.id),['doc-1','doc-2']);
  e.complete(38000,'card-1');e.complete(39000,'card-2');
  assert.equal(e.snapshot(39000).cards,2);
});

test('delayed completion of a previous card does not clear a checkpoint or later recall',()=>{
  const e=new TimerEngine();e.load(card,1000);e.reveal(3000,card.id);
  e.load(null,5000);e.complete(5200,card.id);
  assert.equal(e.snapshot(5200).averageMs,4000);assert.equal(e.snapshot(5200).cards,1);
  e.load({id:'b',entity:null},6000);e.reveal(6500,card.id);
  assert.equal(e.snapshot(6500).recallMs,null);
  e.reveal(9000,'b');assert.equal(e.snapshot(9000).recallMs,3000);
});
