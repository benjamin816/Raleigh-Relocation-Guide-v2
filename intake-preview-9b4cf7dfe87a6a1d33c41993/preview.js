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
function changed(){scheduleSave();updateProgress();}
function updateProgress(){const steps=activeSteps(),position=Math.max(0,steps.indexOf(stepId));document.getElementById('step').textContent='Step '+(position+1)+' of '+steps.length;document.getElementById('progress').max=steps.length;document.getElementById('progress').value=position+1;}
function inputField(id,label,type='text'){const wrapper=el('label',null,'field-label');wrapper.append(el('span',label));const input=el('input');input.type=type;input.id=id;input.name=id;input.value=answers[id]||'';input.addEventListener('input',()=>{answers[id]=input.value;changed();});wrapper.append(input);return wrapper;}
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
    panel.append(el('p','Tell us what matters most in your next home so we can make the most of our call. Every question is optional. Thank you for taking the time to fill this out!'));
    panel.append(el('p','THE LIVING IN RALEIGH TEAM','signature'));
  }else{
    const group=el('fieldset');group.dataset.type=q.type;group.dataset.question=q.id;
    const label=q.id==='budget'&&answers.finance==='Cash'?'What purchase price or price range do you have in mind?':q.label;
    group.append(el('legend',label));if(q.note)group.append(el('p',q.note,'help'));
    if(q.id==='dream'||q.id==='nice'){
      const list=el('div',null,'seven-answers');
      for(let i=0;i<7;i++){const row=el('label',null,'answer-row');if(q.id==='dream')row.append(el('span',String(i+1)));const input=el('input');input.type='text';input.name=q.id+'-'+(i+1);input.setAttribute('aria-label',(q.id==='dream'?'Must-have ':'Nice-to-have ')+(i+1));input.value=Array.isArray(answers[q.id])?answers[q.id][i]||'':'';input.addEventListener('input',()=>{if(!Array.isArray(answers[q.id]))answers[q.id]=Array(7).fill('');answers[q.id][i]=input.value;changed();});row.append(input);list.append(row);}group.append(list);
    }else if(q.type==='partner'){
      const fields=el('div',null,'partner-fields');fields.append(inputField('partnerName','Name'),inputField('partnerPhone','Phone number','tel'),inputField('partnerEmail','Email','email'));group.append(fields);
      if(answers.partner)group.append(el('p','Your earlier answer: '+answers.partner,'help legacy-answer'));
    }else if(q.options)renderOptions(q,group);
    else{
      const input=el(q.type==='textarea'?'textarea':'input');if(q.type!=='textarea')input.type=q.type;
      input.id=q.id;input.name=q.id;input.setAttribute('aria-label',label);input.value=answers[q.id]||'';
      input.addEventListener('input',()=>{answers[q.id]=input.value;changed();});group.append(input);
      if(q.type==='textarea'){
        const clear=el('button',null,'clear clear-text');clear.type='button';clear.setAttribute('aria-label','Clear this answer');clear.title='Clear this answer';
        clear.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        clear.addEventListener('click',()=>{delete answers[q.id];input.value='';input.focus();changed();});group.append(clear);
      }
    }
    panel.append(group);
  }
  heading.focus({preventScroll:true});draftDirty=true;saveDraft();
}
function complete(){
  completed=true;panel.replaceChildren();panel.dataset.section='0';panel.dataset.question='';panel.classList.add('completion');
  const heading=el('h2','Thank you!');heading.id='section-title';heading.tabIndex=-1;panel.append(heading);
  panel.append(el('p','Thank you so much for taking the time to fill this out. We look forward to meeting you!'));
  const contact=el('p','If you need anything before our call, reach us by ');
  const email=el('a','livinginraleighteam@gmail.com');email.href='mailto:livinginraleighteam@gmail.com';const text=el('a','(919) 737-7896');text.href='sms:+19197377896';contact.append(email,document.createTextNode(' or '),text,document.createTextNode('.'));panel.append(contact);
  panel.append(el('p','You can find a breakdown of our call in the email titled “What To Know Before Our Call (Living in Raleigh Team)”.'));
  const count=el('p',null,'countdown');panel.append(count);const redirectAt=Date.now()+30000;
  const tick=()=>{const remaining=Math.max(0,Math.ceil((redirectAt-Date.now())/1000));count.textContent='Redirecting to the home page in '+remaining+' seconds.';if(remaining===0){clearInterval(countdownTimer);window.location.assign('/');}};tick();countdownTimer=setInterval(tick,1000);
  next.hidden=true;back.disabled=false;back.textContent='Back to review';heading.focus({preventScroll:true});saveDraft();
}
form.addEventListener('submit',e=>{e.preventDefault();if(completed)return;const steps=activeSteps(),index=steps.indexOf(stepId);if(index===steps.length-1)complete();else{stepId=steps[index+1];render();}});
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
  next.hidden=true;back.disabled=true;updateProgress();
}
boot();
