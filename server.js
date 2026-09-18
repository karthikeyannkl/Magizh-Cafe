import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 10000);
const TTL_DAYS = Math.max(1, Number(process.env.DATA_TTL_DAYS || 30));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "test-data.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

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

const now = () => Date.now();
const freshStore = () => {
  const t = now();
  return {
    updatedAt: t,
    expiresAt: t + TTL_DAYS * 86400000,
    ttlDays: TTL_DAYS,
    state: { ...DEFAULT_STATE }
  };
};

function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return freshStore();
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!parsed.expiresAt || now() > parsed.expiresAt) return freshStore();
    return {
      updatedAt: parsed.updatedAt || now(),
      expiresAt: parsed.expiresAt,
      ttlDays: parsed.ttlDays || TTL_DAYS,
      state: { ...DEFAULT_STATE, ...(parsed.state || {}) }
    };
  } catch (err) {
    console.error("[STORE_READ_ERROR]", err);
    return freshStore();
  }
}

function writeStore(state) {
  const t = now();
  const payload = {
    updatedAt: t,
    expiresAt: t + TTL_DAYS * 86400000,
    ttlDays: TTL_DAYS,
    state: { ...DEFAULT_STATE, ...state }
  };
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
  return payload;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  })[ext] || "application/octet-stream";
}

function safePublicFile(urlPath) {
  let requested = decodeURIComponent(urlPath.split("?")[0]);

  if (requested === "/" || requested === "") requested = "/index.html";
  else if (requested === "/admin" || requested === "/admin/") requested = "/admin.html";

  const candidate = path.resolve(PUBLIC_DIR, "." + requested);
  const root = path.resolve(PUBLIC_DIR);

  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

const server = http.createServer(async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      return res.end();
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "magizh-cafe-test-v2",
        status: "live",
        ttlDays: TTL_DAYS,
        serverTime: new Date().toISOString(),
        requestId
      });
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const store = readStore();
      return sendJson(res, 200, {
        ok: true,
        ttlDays: TTL_DAYS,
        updatedAt: store.updatedAt,
        expiresAt: store.expiresAt,
        state: store.state
      });
    }

    if (req.method === "PUT" && url.pathname === "/api/state") {
      const body = await readJsonBody(req);
      if (!body.key) return sendJson(res, 400, { ok: false, error: "key required" });

      const store = readStore();
      store.state[body.key] = body.value;
      const saved = writeStore(store.state);

      return sendJson(res, 200, {
        ok: true,
        key: body.key,
        updatedAt: saved.updatedAt,
        expiresAt: saved.expiresAt
      });
    }

    if (req.method === "POST" && url.pathname === "/api/state/bulk") {
      const body = await readJsonBody(req);
      if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
        return sendJson(res, 400, { ok: false, error: "state object required" });
      }

      const store = readStore();
      const saved = writeStore({ ...store.state, ...body.state });

      return sendJson(res, 200, {
        ok: true,
        updatedAt: saved.updatedAt,
        expiresAt: saved.expiresAt
      });
    }

    if (req.method === "POST" && url.pathname === "/api/reset") {
      const saved = writeStore(DEFAULT_STATE);
      return sendJson(res, 200, {
        ok: true,
        message: `Temporary test data reset. Retention: ${TTL_DAYS} days.`,
        updatedAt: saved.updatedAt,
        expiresAt: saved.expiresAt
      });
    }

    const file = safePublicFile(url.pathname);
    if (!file) return sendJson(res, 400, { ok: false, error: "invalid path", requestId });

    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, {
        "Content-Type": contentType(file),
        "Cache-Control": "no-cache"
      });
      return res.end(fs.readFileSync(file));
    }

    // Friendly fallback for SPA-style client routes.
    const indexFile = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexFile)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache"
      });
      return res.end(fs.readFileSync(indexFile));
    }

    return sendJson(res, 404, { ok: false, error: "not found", requestId });
  } catch (err) {
    console.error(`[REQUEST_ERROR ${requestId}]`, err);
    const status = err.statusCode || 500;
    return sendJson(res, status, {
      ok: false,
      error: status === 500 ? "server error" : err.message,
      requestId
    });
  }
});

server.on("error", (err) => {
  console.error("[SERVER_ERROR]", err);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Magizh Cafe Test Server V2 listening on port ${PORT}`);
  console.log(`DATA_TTL_DAYS=${TTL_DAYS}`);
});
