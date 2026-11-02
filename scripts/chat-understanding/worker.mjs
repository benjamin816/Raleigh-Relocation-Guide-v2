import knowledge from './knowledge.mjs';
const ORIGINS=new Set(['https://raleighncguide.com','https://www.raleighncguide.com','http://127.0.0.1:8777','http://localhost:8777']);
const KINDS=['answer','question','human','goodbye','clarify','preamble','greeting','unknown'];
const INTENTS=['buying','selling','combined','relocating','investing','renting','rent_then_buy','rent_only','none'];
const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const TOPICS=['none',...knowledge.answerTopics.map(item=>item.id)];
export function redact(value){return String(value||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'[email]').replace(/(?:\+?\d[\d ().-]{7,}\d)/g,match=>match.replace(/\D/g,'').length>=10?'[phone]':match);}
function response(origin,body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS, GET','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}:{})}});}
const schema={type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:KINDS},intent:{type:'string',enum:INTENTS},certain:{type:'boolean'},answersQuestion:{type:'boolean'},topic:{type:'string',enum:TOPICS},canonical:{type:'string'}},required:['kind','intent','certain','answersQuestion','topic','canonical']};
export function validateFrame(frame,original,context={}){
 if(!frame||!KINDS.includes(frame.kind)||!INTENTS.includes(frame.intent)||typeof frame.certain!=='boolean'||typeof frame.answersQuestion!=='boolean'||typeof frame.canonical!=='string'||frame.canonical.length>600)return null;
 if(frame.topic!==undefined&&!TOPICS.includes(frame.topic))return null;
 if(/https?:|<[^>]+>|\[email\]|\[phone\]/i.test(frame.canonical))return null;
 // No added or changed numeric facts. Numeric conversions fall back to the
 // original deterministic parser rather than risking a fabricated budget/time.
 const sourceNumbers=String(original).match(/\d+(?:[.,]\d+)*/g)||[];
 if((frame.canonical.match(/\d+(?:[.,]\d+)*/g)||[]).some(n=>!sourceNumbers.includes(n)))return null;
 if(context.booking && !['question','human','goodbye','clarify','preamble','greeting','unknown'].includes(frame.kind))return {kind:'answer',intent:'none',certain:false,canonical:''};
 if(/\b(?:confirmed|booked|available at|calendar invite|appointment created)\b/i.test(frame.canonical))return null;
 if(frame.kind==='answer' && /\?\s*$/.test(frame.canonical))frame={...frame,kind:'question',answersQuestion:false};
 if(context.question && frame.kind==='answer' && frame.intent==='none' && !frame.answersQuestion)return {kind:'unknown',intent:'none',certain:false,canonical:''};
 return {kind:frame.kind,intent:frame.intent,certain:frame.certain,answersQuestion:frame.answersQuestion,topic:frame.kind==='question'&&frame.certain?(frame.topic||'none'):'none',canonical:frame.canonical.trim()};
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin')||'',url=new URL(request.url);
 if(!ORIGINS.has(origin))return response(origin,{ok:false,error:'Website origin required.'},403);
 if(request.method==='OPTIONS')return response(origin,{ok:true});
 if(url.pathname==='/status'&&request.method==='GET')return response(origin,{ok:true,enabled:env.AI_ENABLED==='true',version:knowledge.version,model:MODEL,scope:'living-in-raleigh',bookingAuthority:false});
 if(url.pathname!=='/interpret'||request.method!=='POST')return response(origin,{ok:false,error:'Not found.'},404);
 const fallback=reason=>response(origin,{ok:false,fallback:true,reason});
 if(env.AI_ENABLED!=='true'||!env.AI)return fallback('disabled');
 const raw=await request.text();if(raw.length>10000)return response(origin,{ok:false,error:'Too large.'},413);
 let body;try{body=JSON.parse(raw);}catch{return response(origin,{ok:false,error:'Invalid JSON.'},400);}
 if(typeof body?.message!=='string'||!body.message.trim()||body.message.length>2000)return response(origin,{ok:false,error:'Invalid message.'},400);
 if(env.CHAT_RATE_LIMIT && !(await env.CHAT_RATE_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return fallback('rate_limit');
 const context={intent:INTENTS.includes(body.context?.intent)?body.context.intent:'none',question:String(body.context?.question||'').slice(0,40),booking:!!body.context?.booking};
 // The service deliberately has no booking credentials, sheet IDs or fetch
 // route to the calendar service. Invalid output cannot authorize an action.
 const history=(Array.isArray(body.history)?body.history:[]).slice(-4).map(t=>({role:t.role==='assistant'?'assistant':'user',content:redact(t.content).slice(0,400)}));
 const known={};for(const key of ['originCode','currentArea','familyArea','remoteWork','retired','usingFinancing','preApproved','requestedHost']){
  const value=body.known?.[key];if(typeof value==='boolean'||typeof value==='string'&&value.length<=80)known[key]=value;
 }
 const system='You are a message classifier and spelling normalizer, NOT the chatbot. Output the meaning and speech act of ONLY the latest visitor message. answersQuestion=true ONLY if it supplies information asked by currentQuestion, or states a real-estate goal when no currentQuestion exists. An understandable but unrelated statement is kind=unknown, answersQuestion=false, certain=false. Do not invent a motivation or home requirement from an unrelated remark. kind=human means ANY request for a human, agent, real person or direct contact. kind=preamble means asking permission to ask a question. kind=goodbye means ending the conversation. kind=clarify means the visitor does not understand our question. kind=question means an actual information question. kind=answer means a real answer or stated real-estate goal. kind=unknown means unrelated or unintelligible.\n'+JSON.stringify({role:knowledge.role,rules:knowledge.rules,currentQuestion:knowledge.questions[context.question]||'',answerTopics:knowledge.answerTopics,examples:knowledge.examples})+'\nReturn ONLY JSON matching this schema: '+JSON.stringify(schema)+'. canonical is a brief faithful rewrite of the visitor message, never a reply. Questions stay questions; do not put answers in canonical. certain=false only if you cannot understand the message. An understandable statement of uncertainty is certain=true. Never mistake uncertainty about buying for uncertainty about the sentence meaning.';
 try{
  const result=await env.AI.run(MODEL,{messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({context,known,history,latest:redact(body.message)})}],temperature:0,max_tokens:220,response_format:{type:'json_schema',json_schema:schema}});
  let frame=result?.response;if(typeof frame==='string')frame=JSON.parse(frame.replace(/^```(?:json)?\s*|\s*```$/g,''));
  frame=validateFrame(frame,body.message,context);
  if(!frame)return fallback('invalid_output');
  return response(origin,{ok:true,version:knowledge.version,model:MODEL,interpretation:frame,usage:result.usage||null});
 }catch{return fallback('unavailable');}
}};
