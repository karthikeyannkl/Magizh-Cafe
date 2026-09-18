import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 10000);
const TTL_DAYS = Math.max(1, Number(process.env.DATA_TTL_DAYS || 30));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'test-data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_STATE = {
  magizhUsers: {}, magizhOrders: [], magizhProducts: null, magizhCategories: null,
  magizhSettings: {}, magizhB5: {}, magizhCoinWallet: '0', magizhCurrentUser: null, magizhCurrentUserId: 'GUEST'
};
const freshStore = () => ({ updatedAt: Date.now(), expiresAt: Date.now() + TTL_DAYS*86400000, ttlDays: TTL_DAYS, state: {...DEFAULT_STATE} });
function readStore(){
  try {
    if(!fs.existsSync(DATA_FILE)) return freshStore();
    const x=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
    if(!x.expiresAt || Date.now()>x.expiresAt) return freshStore();
    return {...x,state:{...DEFAULT_STATE,...(x.state||{})}};
  } catch { return freshStore(); }
}
function writeStore(state){
  const now=Date.now();
  // Each write refreshes the temporary test retention window.
  const payload={updatedAt:now,expiresAt:now+TTL_DAYS*86400000,ttlDays:TTL_DAYS,state};
  fs.writeFileSync(DATA_FILE,JSON.stringify(payload,null,2));
  return payload;
}
function send(res,status,body,type='application/json'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
  res.end(type==='application/json'?JSON.stringify(body):body);
}
async function body(req){
  let data=''; for await(const c of req)data+=c; return data?JSON.parse(data):{};
}
function safeFile(urlPath){
  const clean=urlPath.split('?')[0];
  const rel=clean==='/'?'index.html':clean==='/admin'?'admin.html':clean.replace(/^\/+/, '');
  const file=path.resolve(PUBLIC_DIR,rel);
  if(!file.startsWith(path.resolve(PUBLIC_DIR))) return null;
  return file;
}
function mime(file){ const e=path.extname(file).toLowerCase(); return {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'}[e]||'application/octet-stream'; }

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET' && u.pathname==='/api/health') return send(res,200,{ok:true,service:'magizh-cafe-test',ttlDays:TTL_DAYS,serverTime:new Date().toISOString()});
    if(req.method==='GET' && u.pathname==='/api/state'){ const s=readStore(); return send(res,200,{ok:true,ttlDays:TTL_DAYS,expiresAt:s.expiresAt,updatedAt:s.updatedAt,state:s.state}); }
    if(req.method==='PUT' && u.pathname==='/api/state'){
      const b=await body(req); if(!b.key) return send(res,400,{ok:false,error:'key required'});
      const s=readStore(); s.state[b.key]=b.value; const saved=writeStore(s.state);
      return send(res,200,{ok:true,key:b.key,expiresAt:saved.expiresAt,updatedAt:saved.updatedAt});
    }
    if(req.method==='POST' && u.pathname==='/api/state/bulk'){
      const b=await body(req); if(!b.state||typeof b.state!=='object') return send(res,400,{ok:false,error:'state object required'});
      const s=readStore(); const saved=writeStore({...s.state,...b.state});
      return send(res,200,{ok:true,expiresAt:saved.expiresAt,updatedAt:saved.updatedAt});
    }
    if(req.method==='POST' && u.pathname==='/api/reset'){ const saved=writeStore({...DEFAULT_STATE}); return send(res,200,{ok:true,expiresAt:saved.expiresAt,message:`Test data reset; retention ${TTL_DAYS} days.`}); }
    if(req.method==='OPTIONS') { res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,PUT,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); return res.end(); }
    let file=safeFile(u.pathname);
    if(!file || !fs.existsSync(file)) file=path.join(PUBLIC_DIR,'index.html');
    const data=fs.readFileSync(file); res.writeHead(200,{'Content-Type':mime(file)}); res.end(data);
  }catch(e){ console.error(e); send(res,500,{ok:false,error:'server error'}); }
});
server.listen(PORT,()=>console.log(`Magizh Cafe test server on ${PORT}; DATA_TTL_DAYS=${TTL_DAYS}`));
