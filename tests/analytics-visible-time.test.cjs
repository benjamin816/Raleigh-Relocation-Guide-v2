const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../assets/js/script.js'), 'utf8');
const begin = source.indexOf('var analyticsTracker = (function () {');
const end = source.indexOf('window.__livrAnalyticsTracker', begin);
let now = 100000, interval;
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
function storage() { const values = new Map(); return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}; }
const handlers = {}, sent = [];
const document = {title:'Test page',referrer:'',body:{classList:[]},visibilityState:'visible',addEventListener:(name,fn)=>handlers[name]=fn};
const window = {location:{pathname:'/',href:'https://raleighncguide.com/'},sessionStorage:storage(),localStorage:storage(),
  innerWidth:1200,innerHeight:800,setTimeout:()=>1,clearTimeout(){},setInterval:fn=>interval=fn,
  addEventListener:(name,fn)=>handlers[name]=fn,fetch:(_url,options)=>{sent.push(JSON.parse(options.body));return Promise.resolve();}};
const scope={window,document,navigator:{},Date:Clock,console};
vm.createContext(scope); vm.runInContext(source.slice(begin,end),scope);
now+=10000;document.visibilityState='hidden';handlers.visibilitychange();
Promise.resolve().then(()=>{
  now+=600000;interval(); // background tabs must not accrue time or send heartbeat events
  document.visibilityState='visible';handlers.visibilitychange();now+=5000;
  scope.analyticsTracker.track('metric_probe',{});scope.analyticsTracker.flush(false);
  const events=sent.flatMap(batch=>batch.events);
  assert.equal(events.find(event=>event.event_name==='metric_probe').engaged_time_ms,15000);
  assert.equal(events.filter(event=>event.event_name==='engagement_heartbeat').length,1);
  assert.equal(events.find(event=>event.event_name==='engagement_heartbeat').engaged_time_ms,10000);
  assert.equal(events.find(event=>event.event_name==='engagement_heartbeat').interaction_source,'metrics_v2');
  console.log('Visible time excludes ten minutes spent in a hidden tab.');
});
