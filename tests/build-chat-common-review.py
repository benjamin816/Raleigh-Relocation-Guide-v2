"""Produce quick grouped findings plus immutable first-pass and repaired transcripts."""
import hashlib,html,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
escape=lambda x:html.escape(str(x))
issues=[
(7,'A','Clarification and answer relevance','F7-21',['I do not understand'],'Recognize confusion, rephrase the current question and do not store it as a home requirement.'),
(7,'A','Clarification and answer relevance','F7-23',['I just had tacos for lunch'],'An unrelated sentence must not advance qualification. Re-ask; repeated unclear answers offer the team number without treating ordinary confusion as hate or spam.'),
(7,'B','Question preambles','F7-26',['Can I ask one thing?'],"Invite the question, then resume the same talk track. The tax FAQ itself was safe; the original team/call wording assertion was too narrow."),
(7,'C','Human handoff articles','F7-27',['Can I speak with an agent?'],'Recognize an agent as a human request and provide 919-737-7896 before resuming.'),
(7,'D','Keyboard spam warning accounting','F7-30',['asdfghjkl','hshsjsk'],'Count the first keyboard mash as a warning and end after repeated gibberish. Do not use a spam strike for mild profanity.'),
(7,'E','Day plus daypart acceptance','F7-40',['The Friday evening option'],'Select the uniquely matching offered time instead of reloading the calendar.'),
(8,'A','Unknown or deferred budget','F8-09',['Whatever we qualify for'],'Accept uncertainty, explain the lender connection and continue cash/financing and the remaining questions.'),
(8,'A','Unknown or deferred budget','F8-10',['I would rather discuss budget on the call'],'Do not interpret postponing one answer as an immediate booking request. This was found by transcript review, not the original automated grader.'),
(8,'B','Human handoff nouns','F8-27',['Can I speak with a realtor?'],'Recognize realtor and real estate agent as human requests and provide the team number.'),
(9,'A','Funding uncertainty','F9-12',['No idea yet'],'Accept no idea as unknown financing; reassure the visitor and continue to timing.'),
(9,'B','Exploration timing versus refusal','F9-13',['Not sure, we are just researching'],'At the timing question this is an exploration-stage answer, not consent to stop all qualification. Ask this year or next while preserving explicit no-call refusals.'),
(9,'C','Future rental intent','F9-26',['We own a home in Denver and will rent in Raleigh for a year.'],'Recognize will rent, retain the origin and ask whether the existing home will be sold. If sold, use the 15-minute phone referral path. Local sellers stay on their sale path.'),
(9,'D','Direct human request','F9-35',['I need a human'],'Provide the team phone number rather than treating the request as an unclear home answer.'),
(9,'E','Farewell variants','F9-39',['Goodbye for now'],'Finish the conversation and stop qualification; do not create a booking afterward.'),
(9,'F','Polite offered-time acceptance','F9-43',['Saturday morning please'],'Use the named day and daypart to select the unique offered time, rather than rechecking it indefinitely.'),
(9,'G','Host and schedule preference persistence','F9-44',['Arrange a Saturday video consult with Ricardo about selling.'],'Preserve the requested host and Saturday preference throughout the long seller track. Verify preferredHost=Ricardo in the final booking request, independent of the mocked display name.')
]
data={}
for n in [7,8,9]:
 folder=root/f'output/chat-bounded-round{n}'
 data[n]={kind:json.loads((folder/file).read_text(encoding='utf-8')) for kind,file in [('first','first-pass.json'),('repaired','permanent-regression-replay.json')]}
quick=[];manifest=[]
for n in [7,8,9]:
 first=data[n]['first'];raw=sum(not c['issues'] for c in first);found=[i for i in issues if i[0]==n];groups=len(set(i[1] for i in found))
 quick.append(f'<h2>Batch {n-6}: {raw}/50 automated first-pass passes; {len(found)} problem conversations, grouped into {groups} causes</h2>')
 if n==7:quick.append('<p class="note">Seven automated flags. Goodbye was a correct completion. The tax answer was safe, but manual review found the preceding question-preamble error in that same conversation. Six conversations needed a product change.</p>')
 if n==8:quick.append('<p class="note">Two automated flags plus one additional manual finding: the budget-defer reply skipped ahead to booking. All three are listed below.</p>')
 if n==9:quick.append('<p class="note">Seven flagged conversations, all requiring a product change. No further fresh round was started.</p>')
 for _,group,label,cid,visitors,change in found:
  before=next(c for c in data[n]['first'] if c['sessionId']==cid);after=next(c for c in data[n]['repaired'] if c['sessionId']==cid)
  def excerpts(case):
   turns=[t for t in case['transcript'] if t['user'] in visitors]
   result=''.join('<div class="visitor"><b>Visitor</b><p>'+escape(t['user'])+'</p></div><div class="sam"><b>Sam</b><p>'+escape(t['bot'])+'</p></div>' for t in turns)
   if cid=='F9-44':
    offers=[t['bot'] for t in case['transcript'] if 'We have ' in t['bot']]
    books=[c['args'][0] for c in case['serviceCalls'] if c['method']=='book']
    result+='<p><b>Later calendar offer:</b> '+escape(offers[0] if offers else 'None')+'</p><p><b>Booking request preferredHost:</b> '+escape(books[0].get('preferredHost') if books else 'No booking request')+'</p>'
   return result
  quick.append(f'<article><h3>{group}. {escape(label)} — {cid}</h3><p><b>Change:</b> {escape(change)}</p><div class="columns"><div><h4>Original</h4>{excerpts(before)}</div><div><h4>After repair</h4>{excerpts(after)}</div></div></article>')
 folder=root/f'output/chat-bounded-round{n}';fixture=root/f'tests/fixtures/chat-bounded-round{n}.json'
 manifest.append({'round':n,'automated_first_pass_passes':raw,'reviewed_problem_conversations':len(found),'grouped_causes':groups,'visitor_turns_first_pass':sum(len(c['transcript']) for c in first),'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'first_pass_sha256':hashlib.sha256((folder/'first-pass.json').read_bytes()).hexdigest(),'original_runtime_manifest':json.loads((folder/'first-pass-manifest.json').read_text(encoding='utf-8'))})
full=[]
for n in [7,8,9]:
 for kind,title in [('first','Original first pass'),('repaired','Final regression replay')]:
  full.append(f'<h2>Full transcripts: batch {n-6}, {title}</h2>')
  for case in data[n][kind]:
   status=', '.join(case['issues']) or 'No automated check failures'
   if case['sessionId']=='F7-33':status+=' — reviewed: completed=true is the correct farewell state'
   if case['sessionId']=='F7-26':status+=' — reviewed: safe tax FAQ; preamble fix verified separately'
   turns=''.join('<div class="visitor"><b>Visitor</b><p>'+escape(t['user'])+'</p></div><div class="sam"><b>Sam</b><p>'+escape(t['bot'])+'</p></div>' for t in case['transcript'])
   full.append('<details><summary>'+escape(case['sessionId']+' · '+case['label']+' — '+status)+'</summary>'+turns+'</details>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chatbot common scenarios — grouped findings</title><style>body{font:17px/1.55 system-ui;max-width:1200px;margin:32px auto;padding:0 20px;color:#173a30;background:#fafbf9}h1,h2,h3{line-height:1.25}h2{margin-top:42px}article,details{margin:16px 0;padding:18px;background:white;border:1px solid #ccd6d1;border-radius:8px}summary{cursor:pointer;font-weight:600}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.visitor,.sam{padding:10px 16px;margin:8px 0;border-radius:8px}.visitor{background:#edf0f3}.sam{background:#fff5cc}p{white-space:pre-wrap}.note{border-left:5px solid #d6ae31;padding:15px;background:#fff8dc}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:800px){.columns{grid-template-columns:1fr}}</style><h1>Common-scenario testing: what failed, why, and what changed</h1><p class="note">Three fresh batches of 50, frozen before execution. Original automated scores: 43/50, 48/50, 43/50. Transcript review identified 6, 3 and 7 conversations needing changes, grouped into 5, 2 and 7 causes within each batch. Some are recurring categories across batches, especially human handoff and uncertainty, rather than entirely new systems problems.</p><p>All repaired outcomes now pass reviewed assertions, including 450 retained frozen journeys and 19 chatbot test suites. No fresh batch was completely clean. Work stopped at the three-round limit. Regression checking also caught and repaired a downstream local-seller/rental problem and ensured budget uncertainty does not skip the funding question.</p><p>These are automated conversations using real local conversation functions and adaptive scripted visitors. Calendar, lead, email and upload operations are mocked or blocked. This is not 150 manual browser sessions, a guarantee of perfect language, or a real invitation/email test. The live booking hold remains in place. Changes remain local on Test; Main has not received this chatbot patch.</p><p>The spaced slash in transcript exports separates individual message bubbles. It is report formatting, not text sent to visitors. The mock always displays Benjamin in its booking response; named-host correctness is checked against the actual preferredHost request payload.</p>'''+''.join(quick)+'''<h2>Reviewed test expectations</h2><p>F7-33 checked ended=true, which is reserved for safety termination. The farewell correctly sets completed=true and browsingEnded=true; the permanent assertion now verifies completion and absence of a booking. F7-26 demanded the words team or call in a valid bounded property-tax FAQ response; the permanent test verifies the safe FAQ and, separately, the corrected question preamble. F8-10 was an additional manual finding that the initial completion grader missed. Original files remain unchanged.</p>'''+''.join(full)+'<h2>Evidence and runtime hashes</h2><pre>'+escape(json.dumps(manifest,indent=2))+'</pre></html>'
out=root/'output/chat-common-review';out.mkdir(parents=True,exist_ok=True)
(out/'report-and-transcripts.html').write_text(page,encoding='utf-8');(out/'findings.json').write_text(json.dumps([dict(round=n,group=g,label=l,case=c,visitor=v,change=fix) for n,g,l,c,v,fix in issues],indent=2),encoding='utf-8');(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(out/'report-and-transcripts.html')
