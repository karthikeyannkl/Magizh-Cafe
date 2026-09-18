const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 10000);
const TTL_DAYS = Math.max(1, Number(process.env.DATA_TTL_DAYS || 30));
const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "magizh-test-data.json");

const DEFAULT_STATE = {
  magizhUsers: {},
  magizhOrders: [],
  magizhProducts: null,
  magizhCategories: null,
  magizhSettings: {},
  magizhB5: {},
  magizhCoinWallet: "0",
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
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!data.expiresAt || Date.now() > data.expiresAt) return freshStore();
    return {
      updatedAt: data.updatedAt || Date.now(),
      expiresAt: data.expiresAt,
      ttlDays: data.ttlDays || TTL_DAYS,
      state: { ...DEFAULT_STATE, ...(data.state || {}) }
    };
  } catch (err) {
    console.error("[STORE_READ_ERROR]", err);
    return freshStore();
  }
}

function writeStore(state) {
  const now = Date.now();
  const data = {
    updatedAt: now,
    expiresAt: now + TTL_DAYS * 86400000,
    ttlDays: TTL_DAYS,
    state: { ...DEFAULT_STATE, ...state }
  };
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
  return data;
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body));
}

function file(res, name, type) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return json(res, 404, { ok:false, error:`${name} not found` });
  res.writeHead(200, { "Content-Type": type, "Cache-Control":"no-cache" });
  res.end(fs.readFileSync(p));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); }
  catch (e) { e.statusCode = 400; throw e; }
}

const server = http.createServer(async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  try {
    const u = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"GET,PUT,POST,OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type"
      });
      return res.end();
    }

    if (req.method === "GET" && u.pathname === "/api/health") {
      return json(res, 200, {
        ok:true,
        service:"magizh-cafe-test-final",
        status:"live",
        ttlDays:TTL_DAYS,
        serverTime:new Date().toISOString(),
        requestId
      });
    }

    if (req.method === "GET" && u.pathname === "/api/state") {
      const s = readStore();
      return json(res, 200, {
        ok:true,
        ttlDays:TTL_DAYS,
        updatedAt:s.updatedAt,
        expiresAt:s.expiresAt,
        state:s.state
      });
    }

    if (req.method === "PUT" && u.pathname === "/api/state") {
      const b = await readBody(req);
      if (!b.key) return json(res,400,{ok:false,error:"key required"});
      const s = readStore();
      s.state[b.key] = b.value;
      const saved = writeStore(s.state);
      return json(res,200,{ok:true,key:b.key,updatedAt:saved.updatedAt,expiresAt:saved.expiresAt});
    }

    if (req.method === "POST" && u.pathname === "/api/state/bulk") {
      const b = await readBody(req);
      if (!b.state || typeof b.state !== "object" || Array.isArray(b.state)) {
        return json(res,400,{ok:false,error:"state object required"});
      }
      const s = readStore();
      const saved = writeStore({...s.state,...b.state});
      return json(res,200,{ok:true,updatedAt:saved.updatedAt,expiresAt:saved.expiresAt});
    }

    if (req.method === "POST" && u.pathname === "/api/reset") {
      const saved = writeStore(DEFAULT_STATE);
      return json(res,200,{
        ok:true,
        message:"Temporary test data reset",
        ttlDays:TTL_DAYS,
        updatedAt:saved.updatedAt,
        expiresAt:saved.expiresAt
      });
    }

    if (req.method === "GET" && (u.pathname === "/" || u.pathname === "/index.html")) {
      return file(res,"index.html","text/html; charset=utf-8");
    }

    if (req.method === "GET" && (u.pathname === "/admin" || u.pathname === "/admin/")) {
      return file(res,"admin.html","text/html; charset=utf-8");
    }

    if (req.method === "GET" && u.pathname === "/server-sync.js") {
      return file(res,"server-sync.js","text/javascript; charset=utf-8");
    }

    if (req.method === "GET" && u.pathname === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }

    return json(res,404,{ok:false,error:"not found",requestId});
  } catch (err) {
    console.error(`[REQUEST_ERROR ${requestId}]`,err);
    return json(res,err.statusCode || 500,{
      ok:false,
      error:err.statusCode ? err.message : "server error",
      requestId
    });
  }
});

server.on("error", err => console.error("[SERVER_ERROR]",err));

server.listen(PORT,"0.0.0.0",() => {
  console.log(`Magizh Cafe final test server listening on port ${PORT}`);
  console.log(`DATA_TTL_DAYS=${TTL_DAYS}`);
});
