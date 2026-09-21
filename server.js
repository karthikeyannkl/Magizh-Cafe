const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 10000);
const TTL_DAYS = Math.max(1, Number(process.env.DATA_TTL_DAYS || 30));
const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "magizh-test-data.json");

// Serialize state writes inside this Node process. Without a queue, two near-simultaneous
// PUT requests could each read the same old store and the later write could erase the other change.
let writeQueue = Promise.resolve();

function queuedStateWrite(mutator) {
  const job = writeQueue.then(() => {
    const store = readStore();
    mutator(store.state);
    return writeStore(store.state);
  });
  writeQueue = job.catch(() => {});
  return job;
}

const DEFAULT_STATE = {
  magizhUsers: {},
  magizhOrders: [],
  magizhProducts: null,
  magizhCategories: null,
  magizhSettings: {},
  magizhB5: {},
  magizhCoinWallet: "0",
  magizhBillRewards: [],
  magizhAdminPassword: null,
  magizhCurrentUser: null,
  magizhCurrentUserId: "GUEST"
};

function freshStore() {
  const now = Date.now();
  return {
    updatedAt: now,
    expiresAt: now + TTL_DAYS * 86400000,
    ttlDays: TTL_DAYS,
    state: { ...DEFAULT_STATE }
  };
}

function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return freshStore();

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    if (!data.expiresAt || Date.now() > data.expiresAt) {
      return freshStore();
    }

    return {
      updatedAt: data.updatedAt || Date.now(),
      expiresAt: data.expiresAt,
      ttlDays: data.ttlDays || TTL_DAYS,
      state: {
        ...DEFAULT_STATE,
        ...(data.state || {})
      }
    };
  } catch (error) {
    console.error("[STORE_READ_ERROR]", error);
    return freshStore();
  }
}

function writeStore(state) {
  const now = Date.now();

  const data = {
    updatedAt: now,
    expiresAt: now + TTL_DAYS * 86400000,
    ttlDays: TTL_DAYS,
    state: {
      ...DEFAULT_STATE,
      ...state
    }
  };

  const temp = DATA_FILE + ".tmp";

  fs.writeFileSync(
    temp,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(temp, DATA_FILE);

  return data;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });

  res.end(JSON.stringify(body));
}

function sendFile(res, filename, type) {
  const filePath = path.join(ROOT, filename);

  if (!fs.existsSync(filePath)) {
    return sendJson(res, 404, {
      ok: false,
      error: filename + " not found"
    });
  }

  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-cache"
  });

  res.end(fs.readFileSync(filePath));
}

async function readBody(req) {
  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
}


function parseBillOCRText(text) {
  const raw = String(text || '').replace(/\r/g, '\n');
  const flat = raw.replace(/\s+/g, ' ');
  let billNo = '';
  const bm = flat.match(/(?:B\.?\s*No|Bill\s*No|Bill\s*Number)\s*[:#-]?\s*([A-Z0-9-]+)/i);
  if (bm) billNo = bm[1].replace(/[^A-Z0-9-]/gi, '');
  let billDate = '';
  const dm = flat.match(/(?:Date|Dt)\s*[:#-]?\s*(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4})/i);
  if (dm) { const m = dm[1].match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/); if(m) billDate = m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0')+'-'+m[3]; }
  let amount = 0;
  const tm = flat.match(/(?:TOTAL|Grand\s*Total|Net\s*Total)\s*[:=-]?\s*[₹Rs. ]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (tm) amount = Number(tm[1].replace(/,/g,''));
  if (!amount) {
    const amLabel = flat.match(/Balance\s*Amt\s*[:=-]?/i);
    if(amLabel){
      const tail = flat.slice(amLabel.index + amLabel[0].length, amLabel.index + amLabel[0].length + 100);
      const nums = [...tail.matchAll(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g)].map(x=>Number(x[1].replace(/,/g,''))).filter(n=>n>0);
      if(nums.length) amount=Math.max(...nums);
    }
  }
  if (!amount) { const nums = [...flat.matchAll(/(?:^|\s)([0-9]{2,6}(?:\.[0-9]{1,2})?)(?=\s|$)/g)].map(x=>Number(x[1].replace(/,/g,''))).filter(n=>n>0); if(nums.length) amount=Math.max(...nums); }
  return {billNo, date:billDate, amount:Math.round((amount||0)*100)/100};
}

const server = http.createServer(async (req, res) => {
  const requestId =
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 8);

  try {
    const url = new URL(
      req.url || "/",
      "http://" + (req.headers.host || "localhost")
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      return res.end();
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/health"
    ) {
      return sendJson(res, 200, {
        ok: true,
        service: "magizh-cafe-test-final",
        status: "live",
        ttlDays: TTL_DAYS,
        serverTime: new Date().toISOString(),
        requestId
      });
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/state"
    ) {
      const store = readStore();
      const rawKeys = String(url.searchParams.get("keys") || "").trim();
      const keys = rawKeys
        ? rawKeys.split(",").map(x => x.trim()).filter(Boolean)
        : null;
      const state = keys
        ? Object.fromEntries(keys.map(k => [k, Object.prototype.hasOwnProperty.call(store.state, k) ? store.state[k] : null]))
        : store.state;

      return sendJson(res, 200, {
        ok: true,
        ttlDays: TTL_DAYS,
        updatedAt: store.updatedAt,
        expiresAt: store.expiresAt,
        state
      });
    }

    if (
      req.method === "PUT" &&
      url.pathname === "/api/state"
    ) {
      const body = await readBody(req);

      if (!body.key) {
        return sendJson(res, 400, {
          ok: false,
          error: "key required"
        });
      }

      const saved = await queuedStateWrite(state => {
        state[body.key] = body.value;
      });

      return sendJson(res, 200, {
        ok: true,
        key: body.key,
        updatedAt: saved.updatedAt,
        expiresAt: saved.expiresAt
      });
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/state/bulk"
    ) {
      const body = await readBody(req);

      if (
        !body.state ||
        typeof body.state !== "object" ||
        Array.isArray(body.state)
      ) {
        return sendJson(res, 400, {
          ok: false,
          error: "state object required"
        });
      }

      const saved = await queuedStateWrite(state => {
        Object.assign(state, body.state);
      });

      return sendJson(res, 200, {
        ok: true,
        updatedAt: saved.updatedAt,
        expiresAt: saved.expiresAt
      });
    }


    if (req.method === "POST" && url.pathname === "/api/bill-rewards/scan") {
      const body = await readBody(req);
      const image = String(body.image || '');
      const m = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      if(!m) return sendJson(res,400,{ok:false,error:"Invalid bill image."});
      const ext = m[1].toLowerCase()==='png' ? 'png' : 'jpg';
      const tmp = path.join(os.tmpdir(), `magizh-bill-${crypto.randomBytes(8).toString('hex')}.${ext}`);
      try {
        fs.writeFileSync(tmp, Buffer.from(m[2], 'base64'));
        const { stdout } = await execFileAsync('tesseract', [tmp, 'stdout', '--psm', '6'], { timeout: 30000, maxBuffer: 1024*1024 });
        const bill = parseBillOCRText(stdout);
        if(!bill.billNo || !bill.date || !(bill.amount>0)) return sendJson(res,422,{ok:false,error:"Required bill details could not be detected."});
        return sendJson(res,200,{ok:true,bill});
      } catch (e) {
        return sendJson(res,503,{ok:false,error:"Server OCR is unavailable."});
      } finally { try{fs.unlinkSync(tmp)}catch(_){} }
    }

    if (req.method === "GET" && url.pathname === "/api/bill-rewards") {
      const store = readStore();
      const userId = String(url.searchParams.get("userId") || "").trim();
      const rawRewards = store.state.magizhBillRewards;
      const rewards = Array.isArray(rawRewards) ? rawRewards : (typeof rawRewards === 'string' ? (()=>{try{return JSON.parse(rawRewards)||[]}catch(e){return []}})() : []);
      return sendJson(res, 200, { ok:true, rewards });
    }

    if (req.method === "POST" && url.pathname === "/api/bill-rewards/claim") {
      const body = await readBody(req);
      const userId = String(body.userId || "").trim();
      const billNo = String(body.billNo || "").trim().toUpperCase();
      const billDate = String(body.billDate || "").trim();
      const amount = Number(body.amount || 0);
      if(!userId || !billNo || !billDate || !(amount > 0)) return sendJson(res,400,{ok:false,error:"Bill Number, Bill Date and Total Amount are required."});
      const result = await new Promise((resolve,reject)=>{
        writeQueue = writeQueue.then(()=>{
          const store = readStore();
          const rawRewards = store.state.magizhBillRewards;
          const rewards = Array.isArray(rawRewards) ? rawRewards : (typeof rawRewards === 'string' ? (()=>{try{return JSON.parse(rawRewards)||[]}catch(e){return []}})() : []);
          const duplicate = rewards.find(x => String(x.billNo).toUpperCase()===billNo && String(x.billDate)===billDate);
          if(duplicate){ resolve({ok:false,status:409,error:"This bill has already been claimed."}); return; }
          const rawUsers = store.state.magizhUsers;
          let users = {};
          if(rawUsers && typeof rawUsers==='object' && !Array.isArray(rawUsers)) users = rawUsers;
          else if(typeof rawUsers==='string'){ try { const parsed=JSON.parse(rawUsers); if(parsed && typeof parsed==='object' && !Array.isArray(parsed)) users=parsed; } catch(e){} }
          const user = users[userId];
          if(!user){ resolve({ok:false,status:404,error:"Customer account not found."}); return; }
          const coins = Math.floor(amount);
          user.coins = Number(user.coins||0) + coins;
          rewards.push({id:'BR-'+Date.now()+'-'+Math.random().toString(36).slice(2,7).toUpperCase(),userId,name:user.name||body.name||'',phone:user.phone||body.phone||'',billNo,billDate,amount,coins,status:'Credited',createdAt:new Date().toISOString()});
          store.state.magizhUsers=users; store.state.magizhBillRewards=rewards;
          const saved=writeStore(store.state);
          resolve({ok:true,status:200,coinsAdded:coins,users,rewards:rewards.filter(x=>String(x.userId)===userId),updatedAt:saved.updatedAt});
        }).catch(reject);
        writeQueue.catch(()=>{});
      });
      return sendJson(res,result.status||200,result);
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/reset"
    ) {
      const saved = writeStore(DEFAULT_STATE);

      return sendJson(res, 200, {
        ok: true,
        message: "Temporary test data reset",
        ttlDays: TTL_DAYS,
        updatedAt: saved.updatedAt,
        expiresAt: saved.expiresAt
      });
    }

    if (
      req.method === "GET" &&
      (
        url.pathname === "/" ||
        url.pathname === "/index.html"
      )
    ) {
      return sendFile(
        res,
        "index.html",
        "text/html; charset=utf-8"
      );
    }

    if (
      req.method === "GET" &&
      (
        url.pathname === "/admin" ||
        url.pathname === "/admin/"
      )
    ) {
      return sendFile(
        res,
        "admin.html",
        "text/html; charset=utf-8"
      );
    }

    if (
      req.method === "GET" &&
      url.pathname === "/server-sync.js"
    ) {
      return sendFile(
        res,
        "server-sync.js",
        "text/javascript; charset=utf-8"
      );
    }

    if (
      req.method === "GET" &&
      url.pathname === "/favicon.ico"
    ) {
      res.writeHead(204);
      return res.end();
    }

    return sendJson(res, 404, {
      ok: false,
      error: "not found",
      requestId
    });

  } catch (error) {
    console.error(
      "[REQUEST_ERROR " + requestId + "]",
      error
    );

    return sendJson(
      res,
      error.statusCode || 500,
      {
        ok: false,
        error:
          error.statusCode
            ? error.message
            : "server error",
        requestId
      }
    );
  }
});

server.on(
  "error",
  error => console.error("[SERVER_ERROR]", error)
);

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "Magizh Cafe final test server listening on port " +
      PORT
    );

    console.log(
      "DATA_TTL_DAYS=" +
      TTL_DAYS
    );
  }
);
