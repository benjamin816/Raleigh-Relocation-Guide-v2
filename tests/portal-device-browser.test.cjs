const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('admin/portal.js','utf8');
const bootstrap=source.slice(source.indexOf('  var credential ='),source.indexOf('  var recoveringSignIn'));
const unlock=source.slice(source.indexOf('  function unlock('),source.indexOf('  function signOut('));
const signOut=source.slice(source.indexOf('  function signOut('),source.indexOf("  $('signout').addEventListener"));
const token='ps1.'+'a'.repeat(64),expiry=Date.now()+30*86400000;
function storage(values={}){const map=new Map(Object.entries(values));return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function page(local,tab){const elements={};const context={Date,JSON,localStorage:local,sessionStorage:tab,viewerEmail:'',recoveringSignIn:false,location:{hash:'#analytics'},selectTab:name=>context.selected=name,resetTransfer:()=>{},document:{querySelector:()=>context.frame},frame:{src:'about:blank',getAttribute(){return this.src;}},$:id=>elements[id]||(elements[id]={hidden:true,textContent:''})};vm.createContext(context);vm.runInContext(bootstrap+unlock+signOut,context);return context;}
const local=storage();let c=page(local,storage({lirAdminCredential:'short-google-token'}));
c.unlock({viewer:{email:'benjamin.raleighrealtor@gmail.com'},session:{token,expiresAt:expiry}});
assert.equal(c.credential,token);assert.equal(JSON.parse(local.getItem('lirAdminSession')).token,token);assert.equal(c.sessionStorage.getItem('lirAdminCredential'),token);assert.equal(c.selected,'analytics');
c=page(local,storage());assert.equal(c.credential,token,'New tab recovers device token without Google');
c.unlock({viewer:{email:'benjamin.raleighrealtor@gmail.com'},session:{token,expiresAt:expiry}});assert.equal(c.$('workspace').hidden,false);assert.equal(c.$('signin').hidden,true);
c.signOut();assert.equal(local.getItem('lirAdminSession'),null);assert.equal(c.sessionStorage.getItem('lirAdminCredential'),null);assert.equal(c.$('workspace').hidden,true);
const expired=storage({lirAdminSession:JSON.stringify({token,expiresAt:Date.now()-1})});c=page(expired,storage());assert.equal(c.credential,'');assert.equal(expired.getItem('lirAdminSession'),null);
const forged=storage({lirAdminSession:JSON.stringify({token:'not-a-session',expiresAt:expiry})});c=page(forged,storage());assert.equal(c.credential,'');assert.equal(forged.getItem('lirAdminSession'),null);
console.log('Portal browser session persistence: Google login exchange, new-tab restoration, tab sharing, sign-out cleanup, expired/malformed session rejection passed.');
