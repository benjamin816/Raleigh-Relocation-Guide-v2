const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
let now=Date.parse('2026-10-29T23:00:00Z');const records={};
class Clock extends Date{constructor(value){super(value===undefined?now:value);}static now(){return now;}}
const properties={getProperty:k=>records[k]||null,setProperty:(k,v)=>{records[k]=v;},deleteProperty:k=>{delete records[k];},getProperties:()=>({...records})};
const scope={Date:Clock,PropertiesService:{getScriptProperties:()=>properties},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_algorithm,text)=>[...crypto.createHash('sha256').update(text).digest()]}};
vm.createContext(scope);vm.runInContext(fs.readFileSync('scripts/google-apps-script/chat-booking/AdminPortalService.gs','utf8'),scope);
const viewer={email:'benjamin.raleighrealtor@gmail.com',name:'Benjamin'};
let session=scope.adminCreateDeviceSession_(viewer);assert.match(session.token,/^ps1\.[a-f0-9]{64}$/);assert.equal(session.expiresAt-now,30*86400000);
assert(!JSON.stringify(records).includes(session.token),'Only a hash of the bearer token is stored on server');
now+=2*3600000;assert.equal(scope.adminVerifyToken_(session.token,'appointments',{}).email,viewer.email);
assert.throws(()=>scope.adminVerifyToken_(session.token.slice(0,-1)+(session.token.endsWith('a')?'b':'a')),/sign in again/i);
assert.equal(scope.adminPortalRequest(session.token,'logout',{}).ok,true);assert.throws(()=>scope.adminVerifyToken_(session.token),/sign in again/i);
session=scope.adminCreateDeviceSession_(viewer);now+=31*86400000;assert.throws(()=>scope.adminVerifyToken_(session.token),/expired/i);assert.equal(Object.keys(records).length,0);
for(let i=0;i<12;i++){now+=1000;scope.adminCreateDeviceSession_(viewer);}assert.equal(Object.keys(records).length,10);
session=scope.adminCreateDeviceSession_(viewer);vm.runInContext("ADMIN_ALLOWED_EMAILS.splice(ADMIN_ALLOWED_EMAILS.indexOf('benjamin.raleighrealtor@gmail.com'),1)",scope);
assert.throws(()=>scope.adminVerifyToken_(session.token),/sign in again/i);
console.log('Device sessions: survive Google-token expiry, expire at 30 days, reject forgery, store token hashes only, revoke on logout/account removal, bound device count.');
