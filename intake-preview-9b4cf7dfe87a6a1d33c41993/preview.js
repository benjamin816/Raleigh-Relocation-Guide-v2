"use strict";
const answers=Object.create(null);
let stepId='intro', draftId=null, lastRevision=null, saveTimer=null, savePaused=false, draftDirty=true, countdownTimer=null, completed=false;
const DRAFT_PREFIX='lir-intake-preview-v1:', DRAFT_LATEST=DRAFT_PREFIX+'latest';
const panel=document.getElementById('panel'),form=document.getElementById('questionnaire'),back=document.getElementById('back'),next=document.getElementById('next'),draftStatus=document.getElementById('draft-status'),resetDialog=document.getElementById('reset-dialog');
const allQuestions=sections.flatMap((s,i)=>s.questions.map(q=>({...q,section:i,title:s.title})));
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function activeQuestions(a=answers){return allQuestions.filter(q=>{
  if(q.id==='lease')return a.sell==='No, I Rent';
  if(q.id==='cashSaleDependent')return a.finance==='Cash'&&a.sell==='Yes';
  if(q.id==='sellfirst')return a.finance!=='Cash'&&a.sell==='Yes';
  if(q.id==='lender')return a.finance==='Financing'||a.finance==='Could go either way';
  if(q.id==='video')return a.source==='YouTube';
  return true;
});}
function activeSteps(){return ['intro',...activeQuestions().map(q=>q.id)];}
function activePayload(){
  const result={schemaVersion:2};
  for(const q of activeQuestions()){
    if(q.id==='partner'){for(const id of ['partnerName','partnerPhone','partnerEmail'])result[id]=answers[id]||'';if(answers.partner)result.partnerLegacy=answers.partner;}
    else result[q.id]=answers[q.id]??(q.type==='checkbox'?[]:'');
  }
  if(answers.source==='Other')result.sourceOther=answers.sourceOther||'';
  if((result.contact||[]).includes('All of the Above!'))result.contact=['Text','Email','Call'];
  return result;
}
function newDraft(){draftId=crypto.randomUUID();lastRevision=null;savePaused=false;draftDirty=true;}
function saveDraft(){
  if(!draftId||savePaused||!draftDirty)return;
  try{
    const key=DRAFT_PREFIX+draftId,previous=JSON.parse(localStorage.getItem(key)||'null');
    if((previous&&previous.revision!==lastRevision)||(!previous&&lastRevision)){savePaused=true;draftStatus.textContent='Your draft changed in another tab. Reload to continue.';return;}
    lastRevision=crypto.randomUUID();
    localStorage.setItem(key,JSON.stringify({version:2,revision:lastRevision,updated:Date.now(),answers,stepId}));
    localStorage.setItem(DRAFT_LATEST,draftId);draftDirty=false;draftStatus.textContent='';
  }catch(e){draftStatus.textContent='Progress could not be saved. Keep this page open.';}
}
function scheduleSave(){draftDirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,200);}
function hasInformation(values=answers){return Object.values(values).some(value=>Array.isArray(value)?value.some(v=>String(v||'').trim()):typeof value==='string'&&value.trim());}
function validAnswer(q,a=answers){
  if(!q)return true;
  const value=a[q.id];
  if(q.id==='partner')return !String(a.partnerEmail||'').trim()||validEmail(a.partnerEmail);
  if(q.id==='source')return value!=='Other'||!!String(a.sourceOther||'').trim();
  if(!q.required)return true;
  if(q.id==='dream')return Array.isArray(value)&&value.filter(v=>String(v||'').trim()).length>=3;
  if(q.type==='email')return validEmail(value);
  if(q.options)return q.type==='checkbox'?Array.isArray(value)&&value.some(v=>q.options.includes(v)):q.options.includes(value);
  return typeof value==='string'&&!!value.trim();
}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim());}
function updateControls(){
  next.disabled=!validAnswer(allQuestions.find(q=>q.id===stepId));
  document.getElementById('clear-draft').hidden=completed||!hasInformation();
  const hint=document.getElementById('minimum-answers');
  if(hint){const n=(answers.dream||[]).filter(v=>String(v||'').trim()).length;hint.textContent=n>=3?'You can add up to 7 must-haves.': 'Please add at least 3 must-haves ('+n+' of 3).';}
}
function changed(){scheduleSave();updateProgress();updateControls();}
function updateProgress(){const steps=activeSteps(),position=Math.max(0,steps.indexOf(stepId));document.getElementById('step').textContent='Step '+(position+1)+' of '+steps.length;document.getElementById('progress').max=steps.length;document.getElementById('progress').value=position+1;}
function inputField(id,label,type='text'){const wrapper=el('label',null,'field-label');wrapper.append(el('span',label));const input=el('input');input.type=type;input.id=id;input.name=id;input.value=answers[id]||'';input.addEventListener('input',()=>{answers[id]=input.value;changed();});wrapper.append(input);return wrapper;}
let reorderIndex=0,ignoreHandleClick=false;
const reorderDialog=document.getElementById('reorder-dialog');
function updateReorderDialog(){document.getElementById('reorder-title').textContent='Move must-have '+(reorderIndex+1);document.getElementById('move-up').disabled=reorderIndex===0;document.getElementById('move-down').disabled=reorderIndex===6;}
function moveMustHave(from,to){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>6||to<0||to>6||from===to)return;
  const values=Array.from({length:7},(_,i)=>Array.isArray(answers.dream)?answers.dream[i]||'':'');
  const [value]=values.splice(from,1);values.splice(to,0,value);answers.dream=values;reorderIndex=to;render();
  const status=document.getElementById('reorder-status');if(status)status.textContent='Must-have moved from position '+(from+1)+' to '+(to+1)+'.';
  if(!reorderDialog.open)document.querySelector('[data-move-index="'+to+'"]')?.focus({preventScroll:true});
}
function dragHandle(index,row){
  const handle=el('button','⠿','drag-handle');handle.type='button';handle.dataset.moveIndex=index;handle.setAttribute('aria-label','Move must-have '+(index+1));handle.title='Drag to reorder. Click for move controls, or use the arrow keys.';
  let drag=null;
  const cleanup=()=>{for(const node of document.querySelectorAll('.answer-row'))node.classList.remove('dragging','drop-target');};
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,id:event.pointerId,to:index,moved:false};handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;
    if(!drag.moved)return;event.preventDefault();row.classList.add('dragging');
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.must-have-row');
    for(const node of document.querySelectorAll('.answer-row'))node.classList.remove('drop-target');
    if(target){drag.to=Number(target.dataset.index);if(drag.to!==index)target.classList.add('drop-target');}
  });
  handle.addEventListener('pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;const drop=drag;drag=null;if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);cleanup();if(drop.moved){ignoreHandleClick=true;setTimeout(()=>ignoreHandleClick=false,0);moveMustHave(index,drop.to);}else{reorderIndex=index;updateReorderDialog();reorderDialog.showModal();}});
  handle.addEventListener('pointercancel',()=>{drag=null;cleanup();});
  handle.addEventListener('click',event=>{if(event.detail!==0||ignoreHandleClick||reorderDialog.open)return;reorderIndex=index;updateReorderDialog();reorderDialog.showModal();});
  handle.addEventListener('keydown',event=>{let to=index;if(event.key==='ArrowUp'||event.key==='ArrowLeft')to--;else if(event.key==='ArrowDown'||event.key==='ArrowRight')to++;else if(event.key==='Home')to=0;else if(event.key==='End')to=6;else return;event.preventDefault();moveMustHave(index,Math.max(0,Math.min(6,to)));});
  return handle;
}
document.getElementById('move-up').addEventListener('click',()=>{moveMustHave(reorderIndex,reorderIndex-1);updateReorderDialog();});
document.getElementById('move-down').addEventListener('click',()=>{moveMustHave(reorderIndex,reorderIndex+1);updateReorderDialog();});
document.getElementById('move-done').addEventListener('click',()=>reorderDialog.close());
reorderDialog.addEventListener('close',()=>document.querySelector('[data-move-index="'+reorderIndex+'"]')?.focus({preventScroll:true}));
function renderOptions(q,group){
  const inputs=[];
  let other=null;
  const sync=()=>{
    for(const input of inputs){
      input.checked=q.type==='checkbox'?(answers[q.id]||[]).includes(input.value):answers[q.id]===input.value;
      const disabled=q.id==='contact'&&(answers.contact||[]).includes('All of the Above!')&&input.value!=='All of the Above!';
      input.disabled=disabled;input.parentElement.classList.toggle('disabled',disabled);
    }
    if(other)other.hidden=answers[q.id]!=='Other';
  };
  for(const option of q.options){
    const label=el('label',null,'option'),input=el('input');
    input.type=q.type;input.name=q.id;input.value=option;inputs.push(input);
    if(q.type==='radio'){
      input.addEventListener('change',()=>{if(input.checked){answers[q.id]=option;sync();changed();}});
      input.addEventListener('click',()=>{
        if(answers[q.id]===option)delete answers[q.id];else answers[q.id]=option;
        sync();changed();
      });
    }else{
      input.addEventListener('change',()=>{
        let selected=new Set(answers[q.id]||[]);
        if(input.checked)selected.add(option);else selected.delete(option);
        answers[q.id]=[...selected];sync();changed();
      });
    }
    label.append(input,el('span',option));group.append(label);
  }
  if(q.options.includes('Other')){
    other=inputField(q.id+'Other','Please tell us where you heard about us');
    other.classList.add('other-answer');group.append(other);
  }
  if(q.type==='radio'){
    const clear=el('button','Clear selection','clear');clear.type='button';
    clear.addEventListener('click',()=>{delete answers[q.id];sync();changed();});group.append(clear);
  }
  sync();
}
function render(){
  clearInterval(countdownTimer);completed=false;panel.replaceChildren();next.hidden=false;back.hidden=false;back.textContent='Back';
  const steps=activeSteps();if(!steps.includes(stepId))stepId='intro';
  const q=allQuestions.find(q=>q.id===stepId),heading=el('h2',q?q.title:'Client Questionnaire');
  heading.id='section-title';heading.tabIndex=-1;panel.dataset.section=q?q.section:0;panel.dataset.question=q?q.id:'';panel.classList.remove('completion');
  panel.append(heading);updateProgress();back.disabled=stepId==='intro';next.textContent=stepId===steps.at(-1)?'Finish':'Next';
  if(!q){
    panel.append(el('p','Tell us what matters most in your next home so we can make the most of our call. Thank you for taking the time to fill this out!'));
    panel.append(el('p','THE LIVING IN RALEIGH TEAM','signature'));
  }else{
    const group=el('fieldset');group.dataset.type=q.type;group.dataset.question=q.id;
    const label=q.id==='budget'&&answers.finance==='Cash'?'What purchase price or price range do you have in mind?':q.id==='budget'&&answers.finance==='Could go either way'?'What purchase price range or monthly mortgage payment do you have in mind?':q.label;
    group.append(el('legend',label+(q.required?'':' (optional)')));if(q.note)group.append(el('p',q.note,'help'));
    if(q.id==='dream'||q.id==='nice'){
      if(q.id==='dream'){const minimum=el('p',null,'help');minimum.id='minimum-answers';minimum.setAttribute('aria-live','polite');group.append(minimum);}const list=el('div',null,'seven-answers');
      for(let i=0;i<7;i++){const row=el('div',null,'answer-row');if(q.id==='dream'){row.classList.add('must-have-row');row.dataset.index=i;row.append(dragHandle(i,row),el('span',String(i+1)));}const input=el('input');input.type='text';input.name=q.id+'-'+(i+1);input.setAttribute('aria-label',(q.id==='dream'?'Must-have ':'Nice-to-have ')+(i+1));input.value=Array.isArray(answers[q.id])?answers[q.id][i]||'':'';input.addEventListener('input',()=>{if(!Array.isArray(answers[q.id]))answers[q.id]=Array(7).fill('');answers[q.id][i]=input.value;changed();});row.append(input);list.append(row);}group.append(list);if(q.id==='dream'){const status=el('p','Drag a handle to reorder, or tap it for move controls.','help reorder-help');status.id='reorder-status';status.setAttribute('aria-live','polite');group.append(status);}
    }else if(q.type==='partner'){
      const fields=el('div',null,'partner-fields');fields.append(inputField('partnerName','Name'),inputField('partnerPhone','Phone number','tel'),inputField('partnerEmail','Email','email'));group.append(fields);
      if(answers.partner)group.append(el('p','Your earlier answer: '+answers.partner,'help legacy-answer'));
    }else if(q.options)renderOptions(q,group);
    else{
      const input=el(q.type==='textarea'?'textarea':'input');if(q.type!=='textarea')input.type=q.type;
      input.id=q.id;input.name=q.id;input.setAttribute('aria-label',label);input.value=answers[q.id]||'';
      input.addEventListener('input',()=>{answers[q.id]=input.value;changed();});const textWrap=q.type==='textarea'?el('div',null,'textarea-wrap'):group;textWrap.append(input);if(q.type==='textarea')group.append(textWrap);
      if(q.type==='textarea'){
        const clear=el('button',null,'clear clear-text');clear.type='button';clear.setAttribute('aria-label','Clear this answer');clear.title='Clear this answer';
        clear.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        clear.addEventListener('click',()=>{delete answers[q.id];input.value='';input.focus();changed();});textWrap.append(clear);
      }
    }
    panel.append(group);
  }
  updateControls();heading.focus({preventScroll:true});draftDirty=true;saveDraft();
}
function markPreviewReturn(){try{sessionStorage.setItem('livrIntakePreviewReturnOnce',String(Date.now()));}catch(e){}}
document.querySelector('.consult-logo').addEventListener('click',()=>{if(completed)markPreviewReturn();});
function complete(){
  completed=true;document.getElementById('step').textContent='Complete';document.getElementById('progress').value=document.getElementById('progress').max;panel.replaceChildren();panel.dataset.section='0';panel.dataset.question='';panel.classList.add('completion');
  const heading=el('h2','Thank you!');heading.id='section-title';heading.tabIndex=-1;panel.append(heading);
  panel.append(el('p','Thank you so much for taking the time to fill this out. We look forward to meeting you!'));
  panel.append(el('p','If you need anything before our call, reach us by email or text.'));
  const contact=el('div',null,'completion-contact');
  const email=el('a','livinginraleighteam@gmail.com');email.href='mailto:livinginraleighteam@gmail.com';
  const text=el('a','(919) 737-7896');text.href='sms:+19197377896';text.className='phone-link';
  contact.append(email,text);panel.append(contact);
const summary=el('p','You can find a breakdown of our call in the email titled ','completion-summary');summary.append(el('strong','“What To Know Before Our Call (Living in Raleigh Team)”'),document.createTextNode('.'));panel.append(summary);
  const count=el('p',null,'countdown');panel.append(count);const redirectAt=Date.now()+30000;
  const tick=()=>{const remaining=Math.max(0,Math.ceil((redirectAt-Date.now())/1000));count.textContent='Redirecting to the home page in '+remaining+' seconds.';if(remaining===0){clearInterval(countdownTimer);markPreviewReturn();window.location.assign('/');}};tick();countdownTimer=setInterval(tick,1000);
  next.hidden=true;document.getElementById('clear-draft').hidden=true;back.disabled=false;back.textContent='Back to review';heading.focus({preventScroll:true});saveDraft();
}
form.addEventListener('submit',e=>{e.preventDefault();if(completed||!validAnswer(allQuestions.find(q=>q.id===stepId)))return;const steps=activeSteps(),index=steps.indexOf(stepId);if(index===steps.length-1){const missing=activeQuestions().find(q=>!validAnswer(q));if(missing){stepId=missing.id;render();}else complete();}else{stepId=steps[index+1];render();}});
back.addEventListener('click',()=>{if(completed){render();return;}const steps=activeSteps(),index=steps.indexOf(stepId);if(index>0){stepId=steps[index-1];render();}});
document.getElementById('clear-draft').addEventListener('click',()=>{resetDialog.showModal();document.getElementById('cancel-reset').focus();});
document.getElementById('cancel-reset').addEventListener('click',()=>resetDialog.close());
document.getElementById('confirm-reset').addEventListener('click',()=>{
  clearTimeout(saveTimer);clearInterval(countdownTimer);
  try{const target=draftId||localStorage.getItem(DRAFT_LATEST);if(target)localStorage.removeItem(DRAFT_PREFIX+target);if(localStorage.getItem(DRAFT_LATEST)===target)localStorage.removeItem(DRAFT_LATEST);}catch(e){}
  for(const key of Object.keys(answers))delete answers[key];stepId='intro';resetDialog.close();newDraft();render();
});
window.addEventListener('pagehide',saveDraft);
window.addEventListener('storage',e=>{if(draftId&&e.key===DRAFT_PREFIX+draftId){savePaused=true;draftStatus.textContent='Your draft changed in another tab. Reload to continue.';}});
function migrate(data){
  Object.assign(answers,data.answers);
  if(answers.else){answers.questions=[answers.questions,answers.else].filter(Boolean).join('\n\n');delete answers.else;}
  if(['FHA','VA','Conventional','USDA'].includes(answers.finance))answers.finance='Financing';
  else if(answers.finance==='Other')answers.finance='Could go either way';
  delete answers.upload;delete answers.down;
  const oldIds=[[],['name','partner','contact','times'],['dream','nice','schools','commute','condition'],['timeline','sell'],['lease'],['sellfirst'],['budget','lender','upload','finance','down'],['agent','source'],['video'],['questions','else']];
  stepId=data.version===2?data.stepId:oldIds[data.current]?.[data.questionIndex]||'intro';
  if(stepId==='else')stepId='questions';if(!activeSteps().includes(stepId))stepId='intro';
}
function boot(){
  let saved=null;
  try{const id=localStorage.getItem(DRAFT_LATEST),data=id&&JSON.parse(localStorage.getItem(DRAFT_PREFIX+id)||'null');if(data&&[1,2].includes(data.version)&&data.answers&&typeof data.answers==='object'&&!Array.isArray(data.answers))saved={id,data};}catch(e){}
  if(!saved){newDraft();render();return;}
  draftId=saved.id;lastRevision=saved.data.revision;
  panel.replaceChildren(el('h2','Welcome back'));panel.dataset.section='0';panel.append(el('p','Your progress is saved. Pick up where you left off.'));
  const resume=el('button','Resume saved answers');resume.type='button';resume.addEventListener('click',()=>{migrate(saved.data);render();});panel.append(resume);
  next.hidden=true;back.disabled=true;document.getElementById('clear-draft').hidden=!hasInformation(saved.data.answers);updateProgress();
}
boot();
