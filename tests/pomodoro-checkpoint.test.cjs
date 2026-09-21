require('ts-node/register');
const test=require('node:test'),assert=require('node:assert/strict');
const {PomodoroTimer}=require('../src/pomodoro');
const {defaultSettings}=require('../src/settings');
const settings={...defaultSettings(),pomodoroEnabled:true,pomodoroMinutes:25,pomodoroName:'Spanish',pomodoroColor:'blue'};
test('checkpoint retains remaining time, interval identity and start time across runtimes',()=>{
 const first=new PomodoroTimer();first.configure(settings);first.advance(90000,100000);
 const checkpoint=JSON.parse(JSON.stringify(first.checkpoint()));
 const second=new PomodoroTimer();second.configure(settings);assert.equal(second.restore(checkpoint),true);
 assert.equal(second.snapshot().remainingMs,1410000);
 second.advance(1410000,2000000);
 assert.equal(second.completed[0].id,checkpoint.intervalId);
 assert.equal(second.completed[0].startedAt,10000);
 assert.equal(second.completed[0].name,'Spanish');assert.equal(second.completed[0].color,'blue');
 const third=new PomodoroTimer();third.configure(settings);third.restore(second.checkpoint());
 assert.equal(third.snapshot().remainingMs,0);assert.equal(third.takeNotification(),false);
 assert.deepEqual(third.completed,second.completed);
 third.restartCompleted();assert.notEqual(third.checkpoint().intervalId,checkpoint.intervalId);
});
test('invalid or obsolete checkpoints cannot override a reset or new duration',()=>{
 const timer=new PomodoroTimer();timer.configure(settings);const cp=timer.checkpoint();
 for(const value of [null,{}, {...cp,remainingMs:-1},{...cp,remainingMs:Infinity},{...cp,remainingMs:1e9},{...cp,version:2},{...cp,completed:[{}]}]) assert.equal(timer.restore(value),false);
 timer.configure({...settings,restartToken:'new'});assert.equal(timer.restore(cp),false);
 timer.configure({...settings,pomodoroMinutes:10});assert.equal(timer.restore(cp),false);
});
