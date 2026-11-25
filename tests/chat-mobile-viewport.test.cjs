const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('assets/js/raleigh-chat.js','utf8');
const part=src.slice(src.indexOf('  var mobileChat ='),src.indexOf('  root.addEventListener("touchmove"'));
function fixture(){
 const vars={},classes=new Set(),frames=[],timers=new Map(),scrolls=[];let next=1;
 const input={},log={scrollHeight:1000,scrollTop:800,clientHeight:200};
 const context={Number,Math,input,log,panel:{hidden:false,setAttribute(){}},mobileChat:null,
 root:{style:{setProperty:(k,v)=>vars[k]=v},classList:{toggle:(k,v)=>{}}},
 document:{activeElement:null,documentElement:{clientWidth:390,classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}}},
 scrollToLatest:()=>{log.scrollTop=log.scrollHeight-log.clientHeight},
 window:{scrollY:430,innerWidth:390,innerHeight:800,visualViewport:{height:800,width:390,offsetTop:0,addEventListener(){}},
 matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>(frames.push(fn),frames.length),cancelAnimationFrame(){},
 setTimeout:fn=>{timers.set(next,fn);return next++},clearTimeout:id=>timers.delete(id),addEventListener(){},scrollTo:position=>scrolls.push(position)}};
 vm.createContext(context);vm.runInContext(part,context);return {c:context,vars,classes,scrolls,flush:()=>{while(frames.length)frames.shift()()},timers};
}
test('opening chat does not focus input or change viewport meta and restores page position',()=>{let f=fixture();f.c.setMobileChat(true);f.flush();assert.equal(f.c.document.activeElement,null);assert.equal(f.vars['--rchat-height'],'800px');assert.ok(f.classes.has('rchat-mobile-open'));f.c.setMobileChat(false);assert.equal(f.scrolls.at(-1).top,430);assert.equal(f.timers.size,0);});
test('keyboard resize keeps composer inside visible viewport and latest messages in view',()=>{let f=fixture();f.c.setMobileChat(true);f.flush();f.c.document.activeElement=f.c.input;Object.assign(f.c.window.visualViewport,{height:410,offsetTop:44});f.c.fitMobileChat();f.flush();assert.equal(f.vars['--rchat-height'],'410px');assert.equal(f.vars['--rchat-top'],'44px');assert.equal(f.c.log.scrollTop,800);});
test('transient zero keyboard height cannot collapse chat and resize bursts share one frame',()=>{let f=fixture();f.c.setMobileChat(true);f.flush();f.c.window.visualViewport.height=0;for(let i=0;i<10;i++)f.c.fitMobileChat();f.flush();assert.equal(f.vars['--rchat-height'],'800px');});
test('stale Safari offset is cleared on keyboard dismissal; layout width stays stable',()=>{let f=fixture();f.c.document.activeElement=f.c.input;Object.assign(f.c.window.visualViewport,{height:410,width:360,offsetTop:80});f.c.setMobileChat(true);f.flush();f.c.document.activeElement=null;f.c.window.visualViewport.height=800;f.c.fitMobileChat();f.flush();assert.equal(f.vars['--rchat-top'],'0px');assert.equal(f.vars['--rchat-width'],'390px');});
test('missing visual viewport still supports fullscreen chat',()=>{let f=fixture();f.c.window.visualViewport=null;f.c.setMobileChat(true);f.flush();assert.equal(f.vars['--rchat-height'],'800px');});

test('iOS viewport pan survives when innerHeight is already keyboard-reduced',()=>{let f=fixture();f.c.setMobileChat(true);f.flush();f.c.window.innerHeight=410;Object.assign(f.c.window.visualViewport,{height:410,offsetTop:390});f.c.root.scrollTop=390;f.c.panel.scrollTop=390;f.c.fitMobileChat();f.flush();assert.equal(f.vars['--rchat-top'],'390px');assert.equal(f.c.root.scrollTop,0);assert.equal(f.c.panel.scrollTop,0);f.c.window.visualViewport.height=800;f.c.fitMobileChat();f.flush();assert.equal(f.vars['--rchat-top'],'0px');});
