// Optional read-only Google Business Profile adapter. No listing edits or review replies.
// API content is cached temporarily at the edge, never committed to Git.
const SOURCES = [
  {id:'team',name:'The Official Living in Raleigh Team',url:'https://share.google/nPSah21Q8vWy5MJh0'},
  {id:'benjamin',name:'Benjamin Carver | eXp Raleigh Realtor',url:'https://share.google/QXlWEkw9pWY6wjAxQ'}
];
const RATINGS={ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5};
const KNOWN_AUTHORS={
  'fixapony':'114614813712268050391','colin bochicchio':'105628578114905946452',
  'jose o':'117382458136564869428','michael martin':'103440213885238931560',
  'jack hamm':'100190359839544832256','jarrod kolb':'110727222821765230078',
  'christine w':'103467476583474988420','ric culaton':'106319625271611546347',
  'cesar hernandez':'101871403183193360292','eve':'117307663441172920232',
  'daveion king':'100278633276313651213','nataly c':'106721562190446399462',
  'garima sharma':'102757373520111549910','arunkumar tj':'116298445592820894082',
  'jack parkison':'107036280150439530284','avinash mahamkali':'118324291768567452092'
};
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function projectReviews(pages) {
  const reviews=[];
  for(const source of SOURCES) for(const review of pages[source.id]||[]) {
    const author=review.reviewer?.displayName, text=review.comment;
    if(!author||!text||typeof text!=='string'||review.reviewer?.isAnonymous)continue;
    const words=text.trim().split(/\s+/), authorKey=KNOWN_AUTHORS[normalize(author)]||source.id+':'+review.reviewId;
    reviews.push({id:source.id+':'+review.reviewId,author,authorKey,
      authorUrl:KNOWN_AUTHORS[normalize(author)]?'https://www.google.com/maps/contrib/'+authorKey+'/reviews':undefined,
      source:source.id,rating:RATINGS[review.starRating],text:words.slice(0,25).join(' '),excerpt:words.length>25,
      updatedAt:review.updateTime||review.createTime});
  }
  reviews.sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0));
  return {version:1,mode:'google-business-profile',updatedAt:new Date().toISOString(),sources:SOURCES,reviews};
}
export async function readProfiles(env, fetcher=fetch) {
  if(!env.GBP_CLIENT_ID||!env.GBP_CLIENT_SECRET||(!env.GBP_REFRESH_TOKEN&&!env.GBP_REFRESH_TOKENS)) throw new Error('GOOGLE_CONNECTION_REQUIRED');
  const locations=JSON.parse(env.GBP_LOCATIONS||'{}');
  const refreshTokens=JSON.parse(env.GBP_REFRESH_TOKENS||'{}'), accessTokens=new Map();
  for(const s of SOURCES) if(!/^accounts\/\d+\/locations\/\d+$/.test(locations[s.id]||''))throw new Error('PROFILE_CONFIGURATION_REQUIRED');
  const pages={};
  for(const source of SOURCES){
    const refresh=refreshTokens[source.id]||env.GBP_REFRESH_TOKEN;
    if(!refresh)throw new Error('GOOGLE_CONNECTION_REQUIRED');
    if(!accessTokens.has(refresh)){
      const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GBP_CLIENT_ID,client_secret:env.GBP_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'}),signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('GOOGLE_AUTHORIZATION_UNAVAILABLE');
      const token=await response.json();if(!token.access_token)throw new Error('GOOGLE_AUTHORIZATION_UNAVAILABLE');
      accessTokens.set(refresh,token.access_token);
    }
    pages[source.id]=[];let next='';const seen=new Set();
    for(let n=0;n<20;n++){
      const url=new URL('https://mybusiness.googleapis.com/v4/'+locations[source.id]+'/reviews');
      url.search=new URLSearchParams({pageSize:'50',orderBy:'updateTime desc',...(next?{pageToken:next}:{})}).toString();
      const response=await fetcher(url.href,{headers:{Authorization:'Bearer '+accessTokens.get(refresh)},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('GOOGLE_REVIEWS_UNAVAILABLE');
      const data=await response.json();
      if(data.reviews!==undefined&&!Array.isArray(data.reviews))throw new Error('GOOGLE_REVIEWS_INVALID');
      pages[source.id].push(...(data.reviews||[]));
      next=data.nextPageToken||'';if(!next)break;
      if(seen.has(next)||n===19)throw new Error('GOOGLE_PAGINATION_INCOMPLETE');seen.add(next);
    }
  }
  return pages;
}
export default {
  async fetch(request,env,ctx){
    const origin=request.headers.get('Origin')||'';
    const allowed=new Set(['https://raleighncguide.com','https://www.raleighncguide.com']);
    const headers={'Content-Type':'application/json; charset=utf-8','Vary':'Origin','X-Content-Type-Options':'nosniff'};
    if(allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
    if(request.method!=='GET')return new Response(JSON.stringify({error:'METHOD_NOT_ALLOWED'}),{status:405,headers});
    if(new URL(request.url).pathname!=='/reviews')return new Response('{}',{status:404,headers});
    if(origin&&!allowed.has(origin))return new Response('{}',{status:403,headers});
    try{
      // Only raw provider responses are cached. The entire two-profile snapshot is replaced atomically.
      const cache=caches.default,key=new Request(new URL('/internal-cache/raw-reviews-v1',request.url).href);
      let raw=await cache.match(key), pages;
      if(raw)pages=await raw.json();
      else{
        pages=await readProfiles(env);
        ctx.waitUntil(cache.put(key,new Response(JSON.stringify(pages),{headers:{'Cache-Control':'max-age=86400'}})));
      }
      return new Response(JSON.stringify(projectReviews(pages)),{headers:{...headers,'Cache-Control':'public, max-age=3600'}});
    }catch(error){
      return new Response(JSON.stringify({error:/CONNECTION_REQUIRED|CONFIGURATION_REQUIRED/.test(error.message)?error.message:'GOOGLE_REVIEWS_UNAVAILABLE'}),{status:503,headers:{...headers,'Cache-Control':'no-store'}});
    }
  }
};
