'use strict';
// Filled only after the deployed endpoint passes authenticated end-to-end tests.
const INTAKE_ENDPOINT='https://script.google.com/macros/s/AKfycbySHCYli60aMWFdnuJ83RDCNpgdaZKv5xPN1N3LMmu6E2fXz-Dr0N7dpApkfEv12xkYUw/exec';
const intakeLinkToken=(()=>{let token=new URLSearchParams(location.hash.slice(1)).get('token');try{if(token)sessionStorage.setItem('livrIntakePrivateSession',token);else token=sessionStorage.getItem('livrIntakePrivateSession');}catch(e){}if(location.hash)history.replaceState(null,'',location.pathname+location.search);return token;})();
window.IntakeTransport={
 async request(action,request={}){
  const token=intakeLinkToken;
  if(!token)throw {code:'MISSING_TOKEN'};
  if(!INTAKE_ENDPOINT)throw {code:'UNAVAILABLE'};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch(INTAKE_ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,token,...request}),redirect:'follow',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});if(!response.ok)throw {code:'NETWORK'};const result=await response.json();if(!result.ok)throw result.error||result;return result;}finally{clearTimeout(timeout);}
 },
 bootstrap(){return this.request('bootstrap')},
 submit(request){return this.request('submit',request)}
};
