(function(){
  const SYNC_PREFIXES=['magizh'];
  const nativeSet=localStorage.setItem.bind(localStorage);
  const nativeRemove=localStorage.removeItem.bind(localStorage);
  let syncing=false;
  const pending=new Map();

  function shouldSync(key){
    return SYNC_PREFIXES.some(p=>String(key||'').startsWith(p));
  }

  async function push(key,value){
    if(syncing||!shouldSync(key))return false;
    pending.set(key,value);
    try{
      const r=await fetch('/api/state',{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key,value})
      });
      if(!r.ok)throw new Error('HTTP '+r.status);
      pending.delete(key);
      return true;
    }catch(e){
      return false;
    }
  }

  async function flushPending(){
    if(!pending.size)return;
    const entries=Array.from(pending.entries());
    for(const [key,value] of entries)await push(key,value);
  }

  async function pull(){
    try{
      const r=await fetch('/api/state',{cache:'no-store'});
      if(!r.ok)return;
      const j=await r.json();
      if(!j.state)return;

      syncing=true;
      Object.entries(j.state).forEach(([k,v])=>{
        // Never overwrite a local change that has not yet been confirmed by the server.
        if(pending.has(k))return;
        if(v===null)nativeRemove(k);
        else nativeSet(k,typeof v==='string'?v:JSON.stringify(v));
      });
      syncing=false;

      window.dispatchEvent(new Event('magizhServerSync'));
    }catch(e){
      syncing=false;
    }
  }

  localStorage.setItem=function(key,value){
    nativeSet(key,value);
    if(!syncing&&shouldSync(key))push(key,String(value));
  };

  localStorage.removeItem=function(key){
    nativeRemove(key);
    if(!syncing&&shouldSync(key))push(key,null);
  };

  window.magizhServerSync={pull,push};

  pull();
  setInterval(flushPending,3000);
  setInterval(pull,5000);
})();
