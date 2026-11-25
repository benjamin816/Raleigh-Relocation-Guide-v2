/* Pure prospective routing. No network, clocks, enrollment or CRM side effects. */
var LirNurtureRouting = (function(){
  function decide(input){
    var state=input.state||{},profile=input.profile,events=input.events||[];
    if(!input.complete)return {action:'hold',reason:'incomplete_source_snapshot'};
    if(profile && profile.status!=='active')return {action:'suppressed',reason:'provider_suppressed'};
    var contact=events.some(function(e){return e.kind==='contact';});
    var permission=events.some(function(e){return e.permission===true && e.confirmedAt && !e.revokedAt;});
    if(contact || state.contactLatched){
      if(input.inBlitz)return {action:'stop',contactLatched:true,weeklyAllowed:permission};
      if(input.inWeekly)return {action:'weekly',contactLatched:true,mutation:false};
      return permission?{action:'join',route:'weekly',contactLatched:true}:{action:'hold',reason:'contact_without_marketing_permission',contactLatched:true};
    }
    if(input.inWeekly)return {action:'weekly',mutation:false};
    if(events.some(function(e){return e.kind==='unknown';}))return {action:'hold',reason:'unverified_source_intent'};
    // This is an irreversible assignment, including an uncertain provider write.
    if(state.firstBlitz)return {action:'retain',route:state.firstBlitz};
    if(input.inBlitz)return {action:'hold',reason:'unattributed_existing_blitz'};
    var eligible=events.filter(function(e){return e.permission===true && e.confirmedAt && !e.revokedAt && (e.kind==='relocation'||e.kind==='passive');});
    eligible.sort(function(a,b){return a.confirmedAt.localeCompare(b.confirmedAt)||a.id.localeCompare(b.id);});
    if(!eligible.length)return {action:'hold',reason:'no_verified_email_permission'};
    return {action:'join',route:eligible[0].kind==='relocation'?'relo':'general',evidenceId:eligible[0].id};
  }
  return {decide:decide};
})();
if(typeof module!=='undefined')module.exports=LirNurtureRouting;

/** Runs under the incumbent livingSenderSyncLeads trigger only. No new trigger. */
var LirSenderNurture = (function(){
  var BOOK='1V-4tnKUm22SXO9qTkBpC027gUU1eY_YwS6M2BplU8Uo';
  var GROUP={weekly:'dJ2y5D',relo:'b8xZP5',general:'dwA19g'};
  var SOURCE=['Website Direct Leads','2026 Relocation Guide - Kit','Appointments Booked Directly','Website Chat Leads','Chat Appointments'];
  var STAGE_HEADERS=['Email','Mailing State JSON','Updated At'];
  var AUDIT_HEADERS=['At','Email Hash','Attempt ID','Operation','Result','Provider Subscriber ID'];
  var STAFF=['benjamin.carver@exprealty.com','ricardo@triangleexperts.com'];
  function key(e){return String(e||'').trim().toLowerCase();}
  function digest(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v),Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
  function jsonRow(row){return JSON.stringify(row.map(function(v){return v instanceof Date?v.toISOString():v;}));}
  function protectedSheet(ss,name,headers){var s=ss.getSheetByName(name);if(!s){s=ss.insertSheet(name,ss.getNumSheets());s.getRange(1,1,1,headers.length).setValues([headers]);s.setFrozenRows(1);var p=s.protect().setDescription('System-owned mailing evidence/state; do not edit');p.removeEditors(p.getEditors().filter(function(x){return !['benjamin.raleighrealtor@gmail.com','livinginraleighteam@gmail.com'].includes(x.getEmail());}));if(p.canDomainEdit())p.setDomainEdit(false);}if(JSON.stringify(s.getRange(1,1,1,headers.length).getValues()[0])!==JSON.stringify(headers))throw Error('Unexpected '+name+' schema');return s;}
  function setup(){
    var lock=LockService.getScriptLock();lock.waitLock(10000);
    try{
      var ss=SpreadsheetApp.openById(BOOK),props=PropertiesService.getScriptProperties();
      if(props.getProperty('NURTURE_CONTROL'))throw Error('Already initialized; never reset a cutover');
      var watermarks={};SOURCE.forEach(function(n){var s=ss.getSheetByName(n);watermarks[n]=s?s.getLastRow():1;});
      protectedSheet(ss,'Mailing Stages',STAGE_HEADERS);protectedSheet(ss,'Mailing Audit',AUDIT_HEADERS);
      // Evidence is created by the same trusted receiver; never filled from Raw JSON.
      protectedSheet(ss,'Mailing Evidence',['Event ID','Email','Accepted At','Source Tab','Source Row','Source Hash','Kind','Capture','Notice','Permission','Token Hash','Expires At','Confirmed At','Revoked At','Confirmation State']);
      var control={version:1,mode:'QA',cutoffAt:new Date().toISOString(),watermarks:watermarks,staffApproved:false};
      props.setProperty('NURTURE_CONTROL',JSON.stringify(control));
      var configuration=protectedSheet(ss,'Mailing Configuration',['Key','Value']);configuration.getRange(2,1,1,2).setValues([['control',JSON.stringify(control)]]);
      Logger.log(JSON.stringify({ok:true,mode:'QA',cutoffAt:control.cutoffAt,watermarks:watermarks,triggerAdded:false,marketingWritten:false}));
      return control;
    }finally{lock.releaseLock();}
  }
  function readRows(sheet,limit){if(!sheet || sheet.getLastRow()>limit)throw Error('Source bounds exceeded or missing');return sheet.getDataRange().getValues();}
  function snapshot(ss,cfg){
    var rows=readRows(ss.getSheetByName('Mailing Evidence'),10000),by={},frontier={};
    SOURCE.concat(['Mailing Evidence']).forEach(function(n){var s=ss.getSheetByName(n);frontier[n]=s?s.getLastRow():1;});
    function add(email,e){if(!by[email])by[email]=[];by[email].push(e);}
    for(var i=1;i<rows.length;i++){
      var r=rows[i],email=key(r[1]);if(!email || Date.parse(r[2])<=Date.parse(cfg.cutoffAt))continue;
      if(!/^\S+@\S+\.\S+$/.test(email) || r[3]!=='Website Direct Leads' || Number(r[4])<=cfg.watermarks[r[3]])throw Error('Invalid accepted source evidence');
      var source=ss.getSheetByName(r[3]);
      if(!source || Number(r[4])>source.getLastRow() || digest(jsonRow(source.getRange(Number(r[4]),1,1,34).getValues()[0]))!==r[5])throw Error('Accepted source changed');
      add(email,{id:r[0],kind:r[6],permission:r[9]===true && r[8]==='lir-email-updates-v1',confirmedAt:r[12]||'',revokedAt:r[13]||''});
    }
    ['Appointments Booked Directly','Chat Appointments'].forEach(function(name){
      var s=ss.getSheetByName(name);if(!s)return;var last=frontier[name],start=cfg.watermarks[name]+1;
      if(last<cfg.watermarks[name] || last-start>2000)throw Error('Appointment source changed or too large');
      if(last<start)return;var header=s.getRange(1,1,1,s.getLastColumn()).getValues()[0],ix=function(n){return header.indexOf(n);};
      var data=s.getRange(start,1,last-start+1,s.getLastColumn()).getValues();
      data.forEach(function(r){var email=key(r[ix('Email')]),id=r[ix(name==='Chat Appointments'?'Calendar Event ID':'Event ID')];if(!email||!id)throw Error('Appointment missing exact identity');
        var status=String(r[ix('Status')]||'').toLowerCase();if(/cancel|delete/.test(status))return;
        var accepted=r[ix(name==='Chat Appointments'?'Booked At':'Logged At')];
        if(!(accepted instanceof Date) || accepted.getTime()<=Date.parse(cfg.cutoffAt))throw Error('Unverified appointment acceptance time');
        add(email,{id:name+':'+id,kind:'contact',permission:false,confirmedAt:'',revokedAt:''});
      });
    });
    ['2026 Relocation Guide - Kit','Website Chat Leads'].forEach(function(name){
      var s=ss.getSheetByName(name);if(!s)return;
      var start=cfg.watermarks[name]+1,last=frontier[name];
      if(last<cfg.watermarks[name]||last-start>2000)throw Error('Legacy source changed or too large');
      if(last<start)return;
      var header=s.getRange(1,1,1,s.getLastColumn()).getValues()[0].map(function(v){return String(v).toLowerCase();}),emailCol=header.indexOf('email');
      if(emailCol<0)throw Error('Missing legacy source identity');
      var data=s.getRange(start,1,last-start+1,s.getLastColumn()).getValues();
      data.forEach(function(r){var email=key(r[emailCol]);if(!email)return;
        // Observations are explicitly NOT accepted opt-in proof. They can only hold,
        // retain an existing assignment, or recognize existing weekly membership.
        add(email,{id:'observed:'+name+':'+digest(jsonRow(r)),kind:name==='Website Chat Leads'?'unknown':'relocation',permission:false,confirmedAt:'',revokedAt:''});
      });
    });
    return {by:by,frontier:frontier};
  }
  function unchanged(ss,snap){return Object.keys(snap.frontier).every(function(n){var s=ss.getSheetByName(n);return (s?s.getLastRow():1)===snap.frontier[n];});}
  function profile(email){var r=livingSenderRequest_('get','/subscribers/'+encodeURIComponent(email));if(r.code===404)return null;livingSenderRequireSuccess_(r,'read subscriber');var p=r.body.data;if(!p||key(p.email)!==email||!p.id)throw Error('Subscriber readback mismatch');return {id:p.id,email:email,status:String(p.status&&p.status.email||'').toLowerCase(),groups:(p.subscriber_tags||[]).map(function(g){return g.id;})};}
  function persist(sheet,row,email,state){var values=[email,JSON.stringify(state),new Date().toISOString()];if(row)sheet.getRange(row,1,1,3).setValues([values]);else{sheet.appendRow(values);row=sheet.getLastRow();}SpreadsheetApp.flush();var check=sheet.getRange(row,1,1,3).getValues()[0];if(check[0]!==email||check[1]!==values[1])throw Error('State readback mismatch');return row;}
  function audit(sheet,email,pending,result,subscriber){sheet.appendRow([new Date().toISOString(),digest(email),pending.id,pending.op,result,subscriber||'']);SpreadsheetApp.flush();}
  function effect(email,state,row,stages,audits,p,snap,ss,op,route){
    if(!unchanged(ss,snap))throw Error('New source arrived; rescan next scheduled run');
    var attempt={id:Utilities.getUuid(),op:op,route:route,at:new Date().toISOString(),subscriber:p&&p.id||''};
    state.pending=attempt;if(op==='add' && route!=='weekly' && !state.firstBlitz)state.firstBlitz=route;
    row=persist(stages,row,email,state);audit(audits,email,attempt,'CLAIMED',attempt.subscriber);
    var response;
    try{
      if(op==='create')response=livingSenderRequest_('post','/subscribers',{email:email,groups:[],trigger_automation:false});
      else if(op==='add')response=livingSenderRequest_('post','/subscribers/groups/'+GROUP[route],{subscribers:[email],trigger_automation:route!=='weekly'});
      else response=livingSenderRequest_('delete','/subscribers/groups/'+GROUP[route],{subscribers:[email],trigger_automation:false});
      livingSenderRequireSuccess_(response,'provider mutation');
      audit(audits,email,attempt,'ACKNOWLEDGED_NOT_YET_VERIFIED',attempt.subscriber);
    }catch(err){state.status='PROVIDER_OUTCOME_UNCONFIRMED';persist(stages,row,email,state);audit(audits,email,attempt,'UNKNOWN_DO_NOT_REPOST',attempt.subscriber);return false;}
    var actual=profile(email),present=actual&&actual.groups.includes(GROUP[route]);
    var verified=op==='create'?!!actual:op==='add'?present:actual&&!present;
    if(!verified){state.status='PROVIDER_OUTCOME_UNCONFIRMED';persist(stages,row,email,state);return false;}
    state.pending=null;state.providerId=actual.id;state.status=op==='remove'?'STOP_GROUP_REMOVED':op==='create'?'PROFILE_CREATED':route==='weekly'?'WEEKLY_VERIFIED':'BLITZ_ENTRY_REQUESTED';
    persist(stages,row,email,state);audit(audits,email,attempt,'INDEPENDENT_READBACK_VERIFIED',actual.id);return true;
  }
  function run(){
    var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {ok:false,reason:'busy'};
    try{
      var book=SpreadsheetApp.openById(BOOK),configuration=book.getSheetByName('Mailing Configuration');
      var raw=configuration&&configuration.getRange(2,2).getValue();
      if(!raw)return {ok:false,reason:'nurture_not_initialized_no_legacy_fallback'};
      var cfg=JSON.parse(raw);if(!['QA','LIVE'].includes(cfg.mode))return {ok:true,mode:cfg.mode,writes:0};
      var ss=SpreadsheetApp.openById(BOOK),snap=snapshot(ss,cfg),stages=ss.getSheetByName('Mailing Stages'),audits=ss.getSheetByName('Mailing Audit'),existing=readRows(stages,10000),map={};
      for(var i=1;i<existing.length;i++){var em=key(existing[i][0]);if(map[em])throw Error('Duplicate mailing state identity');map[em]={row:i+1,state:JSON.parse(existing[i][1])};}
      var count=0,emails=Object.keys(snap.by).sort(),offset=Number(PropertiesService.getScriptProperties().getProperty('NURTURE_SCAN_OFFSET')||0);
      if(!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid scan offset');
      for(var x=0;x<emails.length && count<10;x++){
        var email=emails[(offset+x)%emails.length],entry=map[email]||{row:0,state:{}},state=entry.state;
        var isQa=/^benjamin\.raleighrealtor\+sender-[a-z0-9-]+@gmail\.com$/.test(email);
        if(cfg.mode==='QA'&&!isQa || cfg.mode==='LIVE'&&isQa)continue;
        if(STAFF.includes(email))continue; // Four owner-authorized internal entries are installed separately.
        var p=profile(email),weekly=!!p&&p.groups.includes(GROUP.weekly),inBlitz=!!p&&(p.groups.includes(GROUP.relo)||p.groups.includes(GROUP.general));
        if(state.pending){
          var pending=state.pending,has=!!p&&p.groups.includes(GROUP[pending.route]);
          var matches=!!p&&(!pending.subscriber||p.id===pending.subscriber);
          if(matches&&(pending.op==='create'||pending.op==='add'&&has||pending.op==='remove'&&!has)){
            audit(audits,email,pending,'RECONCILED_FROM_INDEPENDENT_READBACK',p.id);state.pending=null;state.providerId=p.id;
          }else{state.status='PROVIDER_OUTCOME_UNCONFIRMED';entry.row=persist(stages,entry.row,email,state);continue;}
        }
        var decision=LirNurtureRouting.decide({complete:unchanged(ss,snap),profile:p,events:snap.by[email],state:state,inWeekly:weekly,inBlitz:inBlitz});
        if(cfg.mode==='QA'&&decision.action==='join'&&decision.route!=='weekly')decision={action:'hold',reason:'qa_weekly_only_no_production_blitz_entry'};
        if(decision.contactLatched)state.contactLatched=true;
        state.lastDecision=decision;state.status=decision.action.toUpperCase();
        entry.row=persist(stages,entry.row,email,state);
        if(decision.action==='stop'){
          for(var route of ['relo','general'])if(p.groups.includes(GROUP[route])){if(!effect(email,state,entry.row,stages,audits,p,snap,ss,'remove',route))break;p=profile(email);}
        }else if(decision.action==='join'){
          if(!p){effect(email,state,entry.row,stages,audits,p,snap,ss,'create',decision.route);count++;continue;}
          if(p.status==='active'&&!p.groups.includes(GROUP[decision.route]))effect(email,state,entry.row,stages,audits,p,snap,ss,'add',decision.route);
        }
        count++;
      }
      PropertiesService.getScriptProperties().setProperty('NURTURE_SCAN_OFFSET',String(emails.length?(offset+x)%emails.length:0));
      return {ok:true,checked:count,remaining:Math.max(0,emails.length-count)};
    }finally{lock.releaseLock();}
  }
  return {setup:setup,run:run,snapshot:snapshot};
})();
function initializeSenderNurtureQa(){return LirSenderNurture.setup();}

function verifySenderNurtureSetup(){
  var ss=SpreadsheetApp.openById('1V-4tnKUm22SXO9qTkBpC027gUU1eY_YwS6M2BplU8Uo');
  var result={triggers:ScriptApp.getProjectTriggers().map(function(t){return {handler:t.getHandlerFunction(),type:String(t.getEventType())};}),sheets:[]};
  ['Mailing Stages','Mailing Audit','Mailing Evidence','Mailing Configuration'].forEach(function(n){var s=ss.getSheetByName(n);result.sheets.push({name:n,rows:s.getLastRow(),protections:s.getProtections(SpreadsheetApp.ProtectionType.SHEET).map(function(p){return {warningOnly:p.isWarningOnly(),domain:p.canDomainEdit(),editors:p.getEditors().map(function(e){return e.getEmail();})};})});});
  Logger.log(JSON.stringify(result));return result;
}
