const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('admin/portal.js','utf8');
const calls = [], timers = new Map();
let timer = 0;
const scope = { armedTransfer:null, clearTimeout:id=>timers.delete(id), setTimeout:fn=>{timers.set(++timer,fn); return timer;},
  status(){},loadAppointments(){},admin:(action,data)=>{calls.push({action,data});return Promise.resolve();} };
vm.createContext(scope);
vm.runInContext(source.slice(source.indexOf('  function resetTransfer()'),source.indexOf('  function cancelAppointment(')),scope);
function button(label) {return {textContent:label,disabled:false,attributes:{},classList:{add(){},remove(){}},setAttribute(key,value){this.attributes[key]=value;}};}
const appt={id:'test',host:'Both'}, ricardo=button('Transfer to Ricardo'), benjamin=button('Transfer to Benjamin');
scope.changeHost(appt,'Ricardo',ricardo);
assert.equal(calls.length,0); assert.match(ricardo.textContent,/Click one more time/);
scope.changeHost(appt,'Benjamin',benjamin);
assert.equal(ricardo.textContent,'Transfer to Ricardo'); assert.equal(calls.length,0);
[...timers.values()][0](); assert.equal(benjamin.textContent,'Transfer to Benjamin');
scope.changeHost(appt,'Ricardo',ricardo);scope.changeHost(appt,'Ricardo',ricardo);scope.changeHost(appt,'Ricardo',ricardo);
assert.equal(calls.length,1);assert.equal(calls[0].action,'assignment');assert.equal(calls[0].data.host,'Ricardo');assert.equal(calls[0].data.expectedHost,'Both');
assert.equal(calls[0].data.confirm,true);
assert.match(source,/confirmText: \$\('confirm-text'\)\.value/);
assert.match(source, /Type CANCEL to confirm/);
console.log('Transfers arm on first click, submit once on second click, reset on timeout/another choice, and retain typed cancellation.');
