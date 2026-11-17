'use strict';
const production={ready:false,saving:false,responseId:null,version:0,email:'',pending:null,editingAllowed:false,meetingStartAt:null,editTimer:null};
const EDIT_CLOSED_MESSAGE='The intake form closed when your meeting started. Please contact us with any updates.';
function mayEdit(){return production.editingAllowed===true&&Number.isFinite(Date.parse(production.meetingStartAt))&&Date.now()<Date.parse(production.meetingStartAt);}
function syncEditWindow(){
 clearTimeout(production.editTimer);
 if(mayEdit()){production.editTimer=setTimeout(syncEditWindow,Math.min(2147483647,Math.max(1,Date.parse(production.meetingStartAt)-Date.now())));return;}
 if(!production.ready)return;
 next.disabled=true;next.hidden=true;back.hidden=true;document.getElementById('clear-draft').hidden=true;
 for(const fieldset of panel.querySelectorAll('fieldset'))fieldset.inert=true;
 for(const button of panel.querySelectorAll('button'))button.disabled=true;
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 if(!document.getElementById('edit-closed-note')){const note=el('p',EDIT_CLOSED_MESSAGE);note.id='edit-closed-note';note.setAttribute('role','status');panel.append(note);}
}
function applyEditWindow(data){
 if(typeof data.editingAllowed!=='boolean'||!Number.isFinite(Date.parse(data.meetingStartAt)))throw {code:'UNAVAILABLE'};
 production.editingAllowed=data.editingAllowed;production.meetingStartAt=data.meetingStartAt;
}

function productionError(error){
 const code=error&&error.code;
 if(code==='EDIT_WINDOW_CLOSED')return EDIT_CLOSED_MESSAGE;
 if(code==='ROUTING_HOLD')return 'We could not verify the appointment linked to this questionnaire. Please contact livinginraleighteam@gmail.com so we can help.';
 if(code==='UNAVAILABLE'||code==='SERVICE_NOT_READY')return 'The questionnaire is temporarily unavailable. Please try again shortly or contact livinginraleighteam@gmail.com.';
 if(code==='VERSION_CONFLICT')return 'Your answers were updated in another window. Your edits are still here. Open your original email link in a new tab to review the latest saved answers before continuing.';
 if(code==='UNAUTHORIZED'||code==='EXPIRED')return 'This questionnaire link is no longer valid. Please contact livinginraleighteam@gmail.com for help.';
 if(code==='VALIDATION')return 'Please check your answers and try Finish again. '+(error.message||'');
 return 'We could not confirm your answers were saved. Your answers are still here. Please try Finish again.';
}
function verifiedReceipt(data){return data&&data.ok===true&&typeof data.responseId==='string'&&data.responseId.length>0&&Number.isInteger(data.latestVersion)&&data.latestVersion>=0&&data.bookingVerified===true;}
function markAcceptedBooking(){try{localStorage.setItem('livrBookingReportedAt',new Date().toISOString());localStorage.removeItem('livrBookingFollowupAt');sessionStorage.removeItem('livrBookingFollowupAt');}catch(e){}}
async function productionBoot(){
 next.hidden=true;back.disabled=true;panel.replaceChildren(el('h2','Loading your questionnaire…'));document.getElementById('clear-draft').hidden=true;
 try{
  const data=await window.IntakeTransport.bootstrap();if(!verifiedReceipt(data)||!validEmail(data.email))throw {code:'UNAUTHORIZED'};
  applyEditWindow(data);
  Object.assign(production,{ready:true,responseId:data.responseId,version:data.latestVersion,email:data.email});
  DRAFT_PREFIX='lir-intake-production:'+data.responseId+':';DRAFT_LATEST=DRAFT_PREFIX+'latest';
  if(data.submitted){if(data.latestVersion<1||!data.answers||typeof data.answers!=='object')throw {code:'UNAUTHORIZED'};Object.assign(answers,data.answers,{email:data.email});newDraft();stepId='questions';markAcceptedBooking();complete();return;}
  Object.assign(answers,data.answers||{},{email:data.email});if(!mayEdit()){panel.replaceChildren(el('h2','Questionnaire closed'));syncEditWindow();return;}boot();syncEditWindow();
 }catch(error){production.ready=false;panel.replaceChildren(el('h2','Unable to open questionnaire'),el('p',error.code==='MISSING_TOKEN'?'Please open the private questionnaire link in the email we sent you.':productionError(error)));const retry=el('button','Try again');retry.type='button';retry.addEventListener('click',productionBoot);panel.append(retry);next.hidden=true;back.disabled=true;}
}
async function submitProduction(){
 if(production.saving||!production.ready)return;
 if(!mayEdit()){syncEditWindow();return;}
 const payload=activePayload(),fingerprint=JSON.stringify({version:production.version,answers:payload});
 if(!production.pending||production.pending.fingerprint!==fingerprint)production.pending={fingerprint,request:{responseId:production.responseId,expectedVersion:production.version,operationId:crypto.randomUUID(),answers:payload}};
 production.saving=true;panel.inert=true;form.setAttribute('aria-busy','true');next.disabled=true;back.disabled=true;next.textContent='Saving…';document.getElementById('clear-draft').hidden=true;draftStatus.textContent='Saving your answers…';
 try{
  const receipt=await window.IntakeTransport.submit(production.pending.request);
  if(!verifiedReceipt(receipt)||receipt.responseId!==production.responseId||receipt.latestVersion<1||!Number.isInteger(receipt.receiptVersion))throw {code:'INVALID_RECEIPT'};
  if(typeof receipt.editingAllowed==='boolean')applyEditWindow(receipt);
  else {try{const windowState=await window.IntakeTransport.bootstrap();if(verifiedReceipt(windowState)&&windowState.responseId===production.responseId)applyEditWindow(windowState);}catch(e){/* Retain the last verified cutoff; submission is already accepted. */}}
  if(receipt.receiptVersion!==receipt.latestVersion){const current=await window.IntakeTransport.bootstrap();if(!verifiedReceipt(current)||current.responseId!==production.responseId||!current.submitted)throw {code:'INVALID_RECEIPT'};for(const key of Object.keys(answers))delete answers[key];Object.assign(answers,current.answers,{email:production.email});production.version=current.latestVersion;applyEditWindow(current);}else production.version=receipt.latestVersion;
  production.pending=null;production.saving=false;panel.inert=false;form.removeAttribute('aria-busy');draftStatus.textContent='';draftDirty=true;saveDraft();markAcceptedBooking();complete();
 }catch(error){production.saving=false;panel.inert=false;form.removeAttribute('aria-busy');next.textContent='Finish';back.disabled=false;updateControls();draftStatus.textContent=productionError(error);if(error.code==='EDIT_WINDOW_CLOSED')production.editingAllowed=false;syncEditWindow();}
}
