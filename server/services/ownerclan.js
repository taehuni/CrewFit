// Credentials and provider tokens never leave this server module.
export function createOwnerclan({fetcher=fetch, env=process.env, now=Date.now}={}) {
  let token, expires=0, pending, tail=Promise.resolve(), lastRequest=0;
  const failure=()=>Object.assign(new Error('상품 공급처에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'),{status:502});
  async function authenticate(){
    if(token && expires>now()) return token;
    if(!pending) pending=(async()=>{
      if(!env.OWNERCLAN_USERNAME||!env.OWNERCLAN_PASSWORD) throw Object.assign(new Error('상품 연결을 준비 중이에요.'),{status:503});
      const r=await fetcher('https://auth.ownerclan.com/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:'ownerclan',userType:'seller',username:env.OWNERCLAN_USERNAME,password:env.OWNERCLAN_PASSWORD}),signal:AbortSignal.timeout(15000)});
      if(!r.ok) throw failure();
      const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
      token=typeof data==='string'?data:data.token||data.access_token||data.accessToken;
      if(typeof token!=='string'||!token) throw failure();
      // Renew daily, well before the provider's one-month lifetime.
      expires=now()+86400000;return token;
    })().finally(()=>{pending=null;});
    return pending;
  }
  async function execute(query,variables={}){
    try{
      for(let attempt=0;attempt<3;attempt++){
        const auth=await authenticate();
        const wait=Math.max(0,1500-(now()-lastRequest));
        if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
        lastRequest=now();
        const r=await fetcher('https://api.ownerclan.com/v1/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth}`},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(45000)});
        if(r.status===401&&attempt===0){token=null;expires=0;continue;}
        if(r.status===429&&attempt<2){await new Promise(resolve=>setTimeout(resolve,3000));continue;}
        if(!r.ok)throw failure();const data=await r.json();
        if(data.errors?.some(e=>/too many requests/i.test(e.message))&&attempt<2){await new Promise(resolve=>setTimeout(resolve,3000));continue;}
        if(data.errors||!data.data)throw failure();return data.data;
      }
      throw failure();
    }catch(e){if(e.status===503)throw e;throw failure();}
  }
  return function query(query,variables={}){
    const work=tail.then(()=>execute(query,variables));tail=work.catch(()=>{});return work;
  };
}
export const ownerclanQuery=createOwnerclan();
