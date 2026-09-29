(function(){
  // Reliable client/server sync for the Magizh Cafe demo.
  // Local changes render immediately. Server writes are serialized so
  // simultaneous PUT requests cannot overwrite one another.
  const DEFAULT_KEYS = [
    'magizhUsers','magizhOrders','magizhProducts','magizhCategories',
    'magizhSettings','magizhB5','magizhCoinWallet'
  ];
  const SYNC_KEYS = Array.isArray(window.MAGIZH_SYNC_KEYS)
    ? window.MAGIZH_SYNC_KEYS
    : DEFAULT_KEYS;
  const KEY_SET = new Set(SYNC_KEYS);

  const nativeSet = localStorage.setItem.bind(localStorage);
  const nativeRemove = localStorage.removeItem.bind(localStorage);
  const nativeGet = localStorage.getItem.bind(localStorage);
  let syncing = false;
  let flushRunning = false;
  const pending = new Map();

  function shouldSync(key){ return KEY_SET.has(String(key||'')); }

  function scheduleFlush(){
    if(flushRunning || !pending.size) return;
    flushPending();
  }

  async function putOne(key, value){
    try{
      const r = await fetch('/api/state', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key,value})
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      return true;
    }catch(e){
      return false;
    }
  }

  async function flushPending(){
    if(flushRunning) return;
    flushRunning = true;
    try{
      while(pending.size){
        const [key, value] = pending.entries().next().value;
        const ok = await putOne(key, value);
        if(!ok) break;

        // A newer value may have arrived while the request was in flight.
        // Only clear the entry when the value we sent is still current.
        if(pending.get(key) === value) pending.delete(key);
      }
    }finally{
      flushRunning = false;
    }
  }

  async function push(key, value){
    if(!shouldSync(key)) return false;
    pending.set(String(key), value);
    scheduleFlush();
    return true;
  }

  async function pull(){
    try{
      const params = new URLSearchParams();
      if(SYNC_KEYS.length) params.set('keys', SYNC_KEYS.join(','));
      const r = await fetch('/api/state?'+params.toString(), {cache:'no-store'});
      if(!r.ok) return false;
      const j = await r.json();
      if(!j.state) return false;

      let changed = false;
      syncing = true;
      Object.entries(j.state).forEach(([k,v])=>{
        // Never let a server pull overwrite a local change that has not
        // yet been confirmed by the server.
        if(pending.has(k)) return;
        const next = (v === null || typeof v === 'undefined') ? null : (typeof v === 'string' ? v : JSON.stringify(v));
        const prev = nativeGet(k);
        if(next === null){
          if(prev !== null){ nativeRemove(k); changed = true; }
        }else if(prev !== next){
          nativeSet(k, next); changed = true;
        }
      });
      syncing = false;

      // Only re-render the UI when the server actually changed something.
      // This prevents the page from flashing/looping every polling cycle.
      if(changed) window.dispatchEvent(new Event('magizhServerSync'));
      return true;
    }catch(e){
      syncing = false;
      return false;
    }
  }

  localStorage.setItem = function(key,value){
    nativeSet(key,value);
    if(!syncing && shouldSync(key)) push(key,String(value));
  };

  localStorage.removeItem = function(key){
    nativeRemove(key);
    if(!syncing && shouldSync(key)) push(key,null);
  };

  window.magizhServerSync = {pull,push,flush:flushPending};

  // Pull once immediately, then poll less aggressively. This avoids
  // repeatedly downloading large product-photo payloads while an admin is typing.
  pull();
  setInterval(flushPending, 2000);
  setInterval(pull, 20000);
})();
