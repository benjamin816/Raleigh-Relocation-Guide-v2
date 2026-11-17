const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(), server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url.split('?')[0].endsWith('/'))f=path.join(f,'index.html');try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end('missing')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'chrome'});
 try{for(const variant of ['none','fresh','expired','future','invalid']){
  const p=await browser.newPage(); await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await p.clock.install();
  await p.goto(base+'/robots.txt');await p.evaluate(v=>{if(v!=='none')sessionStorage.setItem('livrIntakePreviewReturnOnce',v==='invalid'?'bad':String(Date.now()+(v==='expired'?-360000:v==='future'?360000:0)));},variant);
  await p.goto(base+'/');await p.clock.fastForward(11000);
  const hidden=await p.locator('.lead-popup-modal').evaluate(e=>e.hidden);assert.equal(hidden,variant==='fresh',variant);
  assert.equal(await p.evaluate(()=>sessionStorage.getItem('livrIntakePreviewReturnOnce')),null);assert.equal(await p.evaluate(()=>localStorage.getItem('livrBookingReportedAt')),null);
  if(variant==='fresh'){await p.reload();await p.clock.fastForward(11000);assert.equal(await p.locator('.lead-popup-modal').evaluate(e=>e.hidden),false,'one arrival only');}
  await p.close();console.log(variant+': PASS');
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
