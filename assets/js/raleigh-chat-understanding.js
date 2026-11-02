(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RaleighChatUnderstanding=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function scrub(text){return String(text||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'[email]').replace(/(?:\+?\d[\d ().-]{7,}\d)/g,function(match){return match.replace(/\D/g,'').length>=10?'[phone]':match;});}
  function directMeaning(text,context,engine){
    if(context.booking||context.awaitingFirstName||context.contact||context.ended)return null;
    var value=String(text).trim().replace(/[’]/g,"'");
    if(/^(?:hi|hello|hey|good (?:morning|afternoon|evening)|how(?:'s| is) it going|how are you(?: doing)?|what(?:'s| is) up)[.!?\s]*$/i.test(value))return 'hello';
    if(/^(?:(?:i(?:'m| am)?|we(?:'re| are)?)\s+)?(?:(?:looking|want|hoping)\s+to\s+)?(?:buy|buying|purchase|purchasing|sell|selling|buy and sell|sell and buy|both)(?:\s+(?:a|my|our|the)\s+(?:home|house|property))?[.!\s]*$/i.test(value))return value;
    if(/^(?:budget|priorityBudget)$/.test(context.question||'')&&!engine.asksQuestion(value)&&engine.extractBudget(value))return value;
    return null;
  }
  function eligible(text,context,engine){
    if(context.awaitingFirstName||context.contact||context.ended||context.booking&&context.booking!=='choose')return false;
    if(engine.classifySafety(text)||engine.endsConversation(text)||engine.declinesScheduling(text)||engine.declinesContact(text)||/^(?:forget|forget me|clear chat|delete chat history)$/i.test(text.trim()))return false;
    // Contact values and explicit time selections never need an AI rewrite.
    if(/@|(?:\d[ ().+-]*){10,}/.test(text))return false;
    if(context.booking && /\d|\b(?:first|second|former|latter|one|two|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|morning|afternoon|evening|midday|noon|weekend)\b/i.test(text))return false;
    return true;
  }
  function canonical(frame,original,context,engine){
    var direct=directMeaning(original,context,engine);if(direct!==null)return direct;
    if(!frame||typeof frame.certain!=='boolean'||typeof frame.canonical!=='string'||frame.canonical.length>600)return original;
    if(engine.classifySafety(original)||engine.declinesScheduling(original)||engine.declinesContact(original))return original;
    if(frame.kind==='clarify')return 'huh';
    if(!frame.certain)return context.booking?original:'huh';
    if(frame.kind==='unknown')return 'huh';
    if(frame.kind==='preamble')return 'I have a question';
    if(frame.kind==='goodbye')return 'Goodbye';
    if(frame.kind==='greeting')return 'hello';
    if(frame.kind==='human'){
      if(/\bricardo\b/i.test(original)&&/\b(?:benjamin|ben)\b/i.test(original))return original;
      var name=/\bricardo\b/i.test(original)?'Ricardo':/\b(?:benjamin|ben)\b/i.test(original)?'Benjamin':'a team member';
      return /\b(?:number|phone number|direct line)\b/i.test(original)?'What phone number can I reach '+name+' at?':'Can I speak with '+name+'?';
    }
    if(context.booking)return original;
    if(!['answer','question'].includes(frame.kind)||!frame.canonical.trim()||/https?:|<[^>]+>/.test(frame.canonical))return original;
    var rentalPrefix=!/^(?:tenure|originHousing)$/.test(context.question||'') ?
      ({rent_then_buy:'I plan to rent temporarily before buying. ',rent_only:'I am only looking to rent. ',renting:'I am looking to rent. '}[frame.intent]||'') : '';
    if(frame.kind==='answer'){
      if(engine.extractBudget(original))return rentalPrefix+original;
      var beforePlan=engine.transactionPlan(original),afterPlan=engine.transactionPlan(frame.canonical);
      if(beforePlan.noPurchase && afterPlan.id==='buying')return original;
      if(beforePlan.id && afterPlan.id && beforePlan.id!==afterPlan.id && !beforePlan.combined && !afterPlan.combined)return original;
      var funding=engine.financingType(original),updatedFunding=engine.financingType(frame.canonical);
      if(funding && funding!==updatedFunding && !/\b(?:not sure|unsure|no idea|idk|don't know|do not know|depends|maybe|either|undecided)\b/i.test(original))return original;
      if(context.question==='preapproval' && /\b(?:no|not|haven't|have not)\b/i.test(original) && !/\b(?:no|not|haven't|have not)\b/i.test(frame.canonical))return original;
    }
    var numbers=original.match(/\d+(?:[.,]\d+)*/g)||[];
    if((frame.canonical.match(/\d+(?:[.,]\d+)*/g)||[]).some(function(n){return !numbers.includes(n);}))return original;
    if(frame.kind==='answer'){
      if(rentalPrefix)return rentalPrefix+frame.canonical.trim();
      if(frame.intent==='investing'&&!/\b(?:not|no longer)\s+(?:interested in\s+)?invest/i.test(original))return 'I am interested in investing. '+frame.canonical.trim();
      if(!context.intent){
        var goalPrefix={buying:'I want to buy a home. ',selling:'I want to sell a home. ',combined:'I want to sell and buy a home. '}[frame.intent];
        if(goalPrefix)return goalPrefix+frame.canonical.trim();
      }
    }
    return frame.canonical.trim();
  }
  function create(options){
    var fetcher=options.fetch||fetch,controllers=new Set(),failures=0,cooldownUntil=0;
    return {
      cancel:function(){controllers.forEach(function(c){c.abort();});controllers.clear();},
      interpret:async function(text,context){
        if(!eligible(text,context,options.engine))return {mode:'rules',reason:'protected_field'};
        var direct=directMeaning(text,context,options.engine);
        if(direct!==null)return {mode:'rules',reason:'clear_message',canonical:direct};
        if(Date.now()<cooldownUntil)return {mode:'fallback',reason:'cooldown'};
        var controller=new AbortController();controllers.add(controller);
        var timer=setTimeout(function(){controller.abort();},options.timeout||2500);
        try{
          var known={};['originCode','currentArea','familyArea','remoteWork','retired','usingFinancing','preApproved','requestedHost'].forEach(function(key){if(context.known&&context.known[key]!==undefined)known[key]=context.known[key];});
          var payload={message:scrub(text),context:{intent:context.intent||'none',question:context.question||'',booking:!!context.booking},known:known,
            history:(context.history||[]).slice(-4).map(function(t){return {role:t.byUser?'user':'assistant',content:scrub(t.text).slice(0,400)};})};
          var response=await fetcher(options.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'});
          var body=await response.json();
          if(!response.ok||!body.ok||!body.interpretation)throw new Error(body.reason||'unavailable');
          failures=0;
          return {mode:'ai',canonical:canonical(body.interpretation,text,context,options.engine),kind:body.interpretation.kind,model:body.model};
        }catch(error){
          failures++;if(failures>=2||/rate_limit/.test(error.message))cooldownUntil=Date.now()+60000;
          return {mode:'fallback',reason:error.name==='AbortError'?'timeout':error.message==='rate_limit'?'rate_limit':'unavailable'};
        }finally{clearTimeout(timer);controllers.delete(controller);}
      }
    };
  }
  return {create:create,eligible:eligible,canonical:canonical,scrub:scrub,directMeaning:directMeaning};
});
