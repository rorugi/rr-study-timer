require('ts-node/register');
const test=require('node:test');const assert=require('node:assert/strict');
const {pomodoroScale,pomodoroIconSize}=require('../src/pomodoro_display');
test('duration sizing preserves the standard range and clamps short and long sessions',()=>{
 for(const [minutes,scale] of [[1,.5],[10,.5],[15,.75],[20,1],[25,1],[30,1],[37.5,1.25],[45,1.5],[120,1.5]])
   assert.equal(pomodoroScale(minutes*60000),scale);
 assert.equal(pomodoroIconSize(10*60000),20);assert.equal(pomodoroIconSize(45*60000),60);
 assert.equal(pomodoroIconSize(45*60000,24),36);
});
