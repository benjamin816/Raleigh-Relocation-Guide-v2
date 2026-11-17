const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=process.cwd(),route='/intake-preview-9b4cf7dfe87a6a1d33c41993/';
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url.split('?')[0].endsWith('/'))file=path.join(file,'index.html');try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end('missing');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,channel:"chrome"});
 const results=[];
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());let errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(base+route);
 const go=async id=>page.evaluate(id=>{stepId=id;render()},id);
 await go('partner');assert.equal(await page.locator('.partner-fields input').count(),3);await page.locator('#partnerName').fill('Test Spouse');await page.locator('#partnerPhone').fill('9195550101');await page.locator('#partnerEmail').fill('test@example.com');
 await go('contact');await page.getByLabel('Text',{exact:true}).check();await page.getByLabel('All of the Above!',{exact:true}).check();assert(await page.getByLabel('Text',{exact:true}).isDisabled());await page.getByLabel('All of the Above!',{exact:true}).uncheck();assert(!(await page.getByLabel('Text',{exact:true}).isDisabled()));assert(await page.getByLabel('Text',{exact:true}).isChecked());
 await go('condition');let opt=page.getByLabel('Need Move-in Ready',{exact:true});await opt.click();assert(await opt.isChecked());await opt.click();assert(!(await opt.isChecked()));await opt.click();await page.getByText('Clear selection',{exact:true}).click();assert(!(await opt.isChecked()));
 await go('times');await page.locator('textarea').fill('Test answer');await page.getByRole('button',{name:'Clear this answer'}).click();assert.equal(await page.locator('textarea').inputValue(),'');
 await go('sell');assert.equal(await page.locator('input[type=radio]').count(),4);
 const matrix=await page.evaluate(()=>{
  const out=[];for(const sell of ['Yes','No, I Rent','I Own and Intend to Rent It Out','No, I have short-term housing or am staying with family (no lease concerns)',undefined])for(const finance of ['Cash','Financing','Could go either way',undefined])for(const source of ['YouTube','Other','Google',undefined]){
    const a={sell,finance,source};const qs=activeQuestions(a).map(q=>q.id);out.push({sell,finance,source,qs});
  }return out;
 });
 for(const x of matrix){
 assert.equal(x.qs.includes('lease'),x.sell==='No, I Rent');assert.equal(x.qs.includes('cashSaleDependent'),x.finance==='Cash'&&x.sell==='Yes');assert.equal(x.qs.includes('sellfirst'),x.finance!=='Cash'&&x.sell==='Yes');assert.equal(x.qs.includes('lender'),['Financing','Could go either way'].includes(x.finance));assert.equal(x.qs.includes('video'),x.source==='YouTube');assert(x.qs.indexOf('finance')<x.qs.indexOf('budget'));assert(!x.qs.includes('down')&&!x.qs.includes('upload'));
 }
 await page.evaluate(()=>{answers.sell='Yes';answers.finance='Cash';stepId='finance';render()});await page.locator('#next').click();assert.equal(await page.locator('#panel').getAttribute('data-question'),'cashSaleDependent');await page.locator('#next').click();assert((await page.locator('legend').innerText()).includes('purchase price'));assert(!(await page.locator('legend').innerText()).includes('mortgage'));
 await page.locator('#back').click();await page.locator('#back').click();await page.getByRole('radio',{name:'Financing',exact:true}).click();await page.locator('#next').click();assert.equal(await page.locator('#panel').getAttribute('data-question'),'sellfirst');await page.locator('#next').click();assert((await page.locator('legend').innerText()).includes('mortgage'));
 await go('source');assert(!(await page.locator('.other-answer').isVisible()));await page.getByLabel('Other',{exact:true}).click();assert(await page.locator('.other-answer').isVisible());await page.locator('.other-answer input').fill('Event');await page.getByRole('radio',{name:'YouTube',exact:true}).click();assert(!(await page.locator('.other-answer').isVisible()));await page.locator('#next').click();assert.equal(await page.locator('#panel').getAttribute('data-question'),'video');await page.locator('#back').click();await page.getByRole('radio',{name:'YouTube',exact:true}).click();await page.locator('#next').click();assert.equal(await page.locator('#panel').getAttribute('data-question'),'questions');
 await go('partner');await page.waitForTimeout(300);await page.reload();await page.getByRole('button',{name:'Resume saved answers'}).click();assert.equal(await page.locator('#partnerName').inputValue(),'Test Spouse');
 await page.getByRole('button',{name:'Start the form from scratch'}).click();assert(await page.locator('dialog').isVisible());await page.getByRole('button',{name:'Keep my answers'}).click();assert.equal(await page.locator('#partnerName').inputValue(),'Test Spouse');await page.getByRole('button',{name:'Start the form from scratch'}).click();await page.getByRole('button',{name:'Yes, start from scratch'}).click();assert.equal(await page.locator('#panel').getAttribute('data-section'),'0');assert.deepEqual(await page.evaluate(()=>Object.keys(answers)),[]);await page.reload();await page.getByRole('button',{name:'Resume saved answers'}).click();assert.equal(await page.locator('#panel').getAttribute('data-section'),'0');
 await go('questions');await page.locator('#next').click();assert(await page.getByRole('heading',{name:'Thank you!'}).isVisible());assert.equal(await page.locator('a[href^="mailto:"]').getAttribute('href'),'mailto:livinginraleighteam@gmail.com');assert((await page.locator('.countdown').innerText()).includes('30'));await page.locator('#back').click();assert(!(await page.locator('.countdown').count()));
 results.push('80 branch combinations; spouse fields; contact all/uncheck; radio deselect; paragraph clear; finance backtracking; conditional Other/YouTube; draft resume; cancel and confirm full reset; completion contacts/countdown/back: PASS');
 // migrate older draft without losing original data
 await page.evaluate(()=>{localStorage.clear();localStorage.setItem('lir-intake-preview-v1:latest','old');localStorage.setItem('lir-intake-preview-v1:old',JSON.stringify({version:1,revision:'r',answers:{partner:'Jane, 555-0101',questions:'Q',else:'Extra',finance:'VA'},current:6,questionIndex:3}));});await page.reload();await page.getByRole('button',{name:'Resume saved answers'}).click();assert(await page.getByRole('radio',{name:'Financing',exact:true}).isChecked());assert.equal(await page.evaluate(()=>answers.questions),'Q\n\nExtra');
 results.push('Old draft migration: PASS');
 const overflow=[];
 fs.mkdirSync('intake-qa',{recursive:true});
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:375,height:667},{width:320,height:568}]){
 await page.setViewportSize(viewport);
 for(const id of ['intro',...await page.evaluate(()=>allQuestions.map(q=>q.id))]){
 await page.evaluate(id=>{answers.sell='Yes';answers.finance='Cash';answers.source='YouTube';if(id==='lease')answers.sell='No, I Rent';if(id==='lender'||id==='sellfirst')answers.finance='Financing';stepId=id;render()},id);
 const dims=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight}));if(dims.sw>dims.w+1||dims.sh>dims.h+1)overflow.push({viewport,id,...dims});
 }
 for(const id of ['partner','sell','dream','condition']){await go(id);await page.screenshot({path:'intake-qa/'+viewport.width+'-'+id+'.png',fullPage:true});}
 }
 results.push({overflow});
 await page.evaluate(()=>{answers.sell='No, I have short-term housing or am staying with family (no lease concerns)';answers.finance='Cash';answers.source='Google';answers.lease='stale';answers.lender='stale';answers.video='stale';answers.contact=['Text','All of the Above!'];});
const payload=await page.evaluate(()=>activePayload());assert(!('lease' in payload));assert(!('lender' in payload));assert(!('video' in payload));assert(!('sourceOther' in payload));assert.deepEqual(payload.contact,['Text','Email','Call']);
await page.clock.install();await page.evaluate(()=>{stepId='questions';render();complete()});await page.clock.fastForward(30000);await page.waitForURL(base+'/');
results.push('Effective payload excludes inactive branches; 30-second homepage redirect: PASS');
assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify(results,null,2));
 } finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});


