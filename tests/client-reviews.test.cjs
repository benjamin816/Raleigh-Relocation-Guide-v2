const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {deduplicate,page}=require('../assets/js/client-reviews.js');
const seed=JSON.parse(fs.readFileSync('assets/data/client-reviews.json','utf8'));
test('both verified Google sources plus original testimonials produce 16 distinct reviewers',()=>{
  const legacy=['100278633276313651213','101871403183193360292','106721562190446399462'].map((authorKey,i)=>({authorKey,id:'legacy'+i,author:'Existing '+i,text:'Unique existing testimonial '+i,legacy:true}));
  assert.equal(deduplicate(seed.reviews.concat(legacy)).length,16);
  assert.equal(new Set(seed.reviews.map(x=>x.authorKey)).size,13);
  assert.equal(seed.sources.length,2);
  for(const r of seed.reviews)assert.ok(r.text.split(/\s+/).length<=25,r.author);
});
test('Google copies replace existing versions of the same person and copied text is not repeated',()=>{
  const rows=[{id:'google',authorKey:'person',author:'Full Name',text:'The current Google review',rating:5}, {id:'legacy',authorKey:'person',author:'F N',text:'An edited older testimonial',legacy:true},{id:'other',author:'Copy',text:'The current Google review!',rating:5}];
  assert.deepEqual(deduplicate(rows).map(x=>x.id),['google']);
});
test('desktop and mobile wrapping reach every review without duplicate cards',()=>{
  const rows=Array.from({length:16},(_,i)=>({id:i}));
  for(const size of [1,3]){
    let seen=new Set();for(let n=0;n<16;n++){const batch=page(rows,(n*size)%16,size);assert.equal(new Set(batch.map(x=>x.id)).size,size);batch.forEach(x=>seen.add(x.id));}
    assert.equal(seen.size,16);
  }
});
test('provider projection preserves attribution, rating, and legacy identity without exposing replies',async()=>{
  const {projectReviews}=await import('../scripts/google-reviews/worker.mjs');
  const result=projectReviews({team:[],benjamin:[{reviewId:'123',reviewer:{displayName:'Cesar Hernandez'},comment:'Very helpful.',starRating:'FIVE',reviewReply:{comment:'Should not be included'}}]});
  assert.equal(result.reviews[0].authorKey,'101871403183193360292');assert.equal(result.reviews[0].rating,5);
  assert.equal(result.reviews[0].reviewReply,undefined);
});
test('provider reads every page, rejects partial failures, and never writes a listing',async()=>{
  const {readProfiles}=await import('../scripts/google-reviews/worker.mjs');
  const calls=[];const env={GBP_CLIENT_ID:'test',GBP_CLIENT_SECRET:'test',GBP_REFRESH_TOKEN:'test',GBP_LOCATIONS:JSON.stringify({team:'accounts/1/locations/2',benjamin:'accounts/1/locations/3'})};
  const fetcher=async(url,options)=>{calls.push({url,options});if(String(url).includes('oauth2'))return {ok:true,json:async()=>({access_token:'owned-test-token'})};const next=String(url).includes('pageToken=');return {ok:true,json:async()=>({reviews:[{reviewId:next?'2':'1'}],...(!next?{nextPageToken:'next'}:{})})};};
  const result=await readProfiles(env,fetcher);assert.equal(result.team.length,2);assert.equal(result.benjamin.length,2);assert.equal(calls.length,5);
  for(const c of calls.slice(1))assert.equal(c.options.method,undefined);
  await assert.rejects(readProfiles(env,async(url)=>String(url).includes('oauth2')?{ok:true,json:async()=>({access_token:'test'})}:{ok:false}),/REVIEWS_UNAVAILABLE/);
});

test('five-star imports only and abbreviated names',()=>{
 const {displayName}=require('../assets/js/client-reviews.js');
 assert.equal(displayName('Jack Hamm'),'Jack H.');assert.equal(displayName('Eve'),'Eve');assert.equal(displayName('DAVEION K - HOLLY SPRINGS NC'),'DAVEION K.');
 assert.equal(deduplicate([{author:'A B',text:'Good',rating:4},{author:'C D',text:'Great',rating:5}]).length,1);
});
test('provider excludes lower and unknown ratings',async()=>{
 const {projectReviews}=await import('../scripts/google-reviews/worker.mjs');
 const result=projectReviews({team:['ONE','FOUR','FIVE',undefined].map((starRating,i)=>({reviewId:String(i),reviewer:{displayName:'Name '+i},comment:'Review '+i,starRating}))});
 assert.equal(result.reviews.length,1);assert.equal(result.reviews[0].rating,5);
});
