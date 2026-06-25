// C19RM Impact Evaluation — chat relay (Netlify Function)
// Holds ANTHROPIC_API_KEY server-side; grounds answers in the bundled knowledge base.
const KB = require('./kb.json');
const MODEL = 'claude-sonnet-4-6';
const TOPK = 5;
const STOP = new Set('the a an and or of to in for on at by is are was were be as with from this that these those it its their our we you they he she them his her was c19rm nigeria'.split(' '));

function tokens(s){return (s.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!STOP.has(w));}
// precompute document frequency once (module scope, reused across warm invocations)
const DF={}; for(const c of KB){const seen=new Set(tokens(c.t+' '+c.x));seen.forEach(w=>DF[w]=(DF[w]||0)+1);}
const N=KB.length;
function retrieve(q, mod){
  const qt=tokens(q); if(!qt.length) return [];
  const idf=w=>Math.log(1+N/(1+(DF[w]||0)));
  const scored=KB.map(c=>{
    const text=(c.t+' '+c.t+' '+c.x).toLowerCase(); let s=0;
    for(const w of qt){ if(!text.includes(w)) continue; const tf=(text.split(w).length-1); s+=Math.min(tf,4)*idf(w); }
    if(mod && c.mod===mod) s*=1.25;            // prefer the open module
    return {c,s};
  }).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).slice(0,TOPK);
  return scored.map(o=>o.c);
}
const SYS = `You are the Jhpiego Chatbot, the assistant for the impact evaluation of the Global Fund COVID-19 Response Mechanism (C19RM) in Nigeria, prepared for the Government of Nigeria and the Global Fund. Answer ONLY from the CONTEXT provided with each question (drawn from the evaluation report, the End-of-Project documentation, the methodology and the investment register). If the answer is not in the context, say so plainly and suggest where in the report it might sit; never invent figures or quotes.
House rules you must follow:
- The three Principal Recipients — NACA, NTBLCP and Lagos State Ministry of Health — are kept separate and are never summed or blended.
- Do not state monetary amounts (naira or dollar). Report counts and reach only.
- Frame contribution, not attribution. Present the mandate-money split (NCDC's statutory mandate vs zero-cash role) as a structural finding, not an accusation.
- Keep any quotes de-identified, by stakeholder category and level only.
- Use British spelling and the % symbol. Avoid jargon.
Answering style (important):
- Answer the question directly in the FIRST sentence. Do not preface with background.
- Be concise: 2 to 4 short sentences, about 70 words. Only go longer if the person explicitly asks for detail or a list.
- Synthesise in your own words. Do NOT paste or list large blocks from the context, and do not dump everything you found; use only what answers the question.
- Use a list only if the person asks to list things; otherwise write short prose.
- For questions about what was invested or delivered, LEAD with the number, then the breakdown. Single count: give the number first and any split, e.g. "95 oxygen plants \u2014 73 newly procured, 22 repaired." Several items: give a short list, one per line, e.g. "22 warehouses across 21 states; 1,548 motorbikes; 2,086 UPS units." Use only the figures present in the context; never invent or estimate a number.
- Warm, clear and welcoming for a non-technical stakeholder audience. You may end by naming the module or source in a few words.`;

exports.handler = async (event) => {
  const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS') return {statusCode:204,headers:H,body:''};
  if(event.httpMethod!=='POST') return {statusCode:405,headers:H,body:JSON.stringify({error:'POST only'})};
  try{
    const {question='', module='', history=[]} = JSON.parse(event.body||'{}');
    if(!question.trim()) return {statusCode:400,headers:H,body:JSON.stringify({error:'No question'})};
    if(question.length>1000) return {statusCode:400,headers:H,body:JSON.stringify({error:'Question too long'})};
    const hits=retrieve(question, module);
    const context=hits.map((c,i)=>`[${i+1}] (${c.src}${c.t?' — '+c.t:''})\n${c.x}`).join('\n\n');
    const msgs=[...(Array.isArray(history)?history.slice(-6):[]),
      {role:'user',content:`CONTEXT:\n${context||'(no matching passages found)'}\n\nQUESTION: ${question}`}];
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
      headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:MODEL,max_tokens:400,system:SYS,messages:msgs})});
    const data=await r.json();
    if(!r.ok) return {statusCode:502,headers:H,body:JSON.stringify({error:data.error?.message||'Upstream error'})};
    const answer=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
    const sources=[...new Set(hits.map(c=>c.src+(c.t?' — '+c.t:'')))].slice(0,4);
    return {statusCode:200,headers:H,body:JSON.stringify({answer,sources})};
  }catch(e){return {statusCode:500,headers:H,body:JSON.stringify({error:String(e)})};}
};
