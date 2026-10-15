export default {

  async fetch(request, env) {

    const url = new URL(request.url);



    const corsHeaders = {

      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",

      "Access-Control-Allow-Headers": "Content-Type"

    };



    if (request.method === "OPTIONS") {

      return new Response(null, { headers: corsHeaders });

    }



    const json = (data, status = 200) =>

      new Response(JSON.stringify(data), {

        status,

        headers: {

          "Content-Type": "application/json",

          ...corsHeaders

        }

      });




      // =========================
      // AIC / B5 BRIDGE
      // =========================
      // Read-only access to the existing AIC Supabase app_state.
      // Required Worker secrets/vars: AIC_SUPABASE_URL and AIC_SUPABASE_SERVICE_KEY.
      const B5_INITIAL_COINS = 500;

      const ensureB5GrantTable = async () => {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS b5_coin_grants (
            member_id TEXT PRIMARY KEY,
            coins INTEGER NOT NULL DEFAULT 500,
            granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      };

      const getAicMembers = async () => {
        const base = String(env.AIC_SUPABASE_URL || "").replace(/\/$/, "");
        const key = String(env.AIC_SUPABASE_SERVICE_KEY || "");
        if (!base || !key) throw new Error("AIC bridge is not configured");
        // Do not assume the app_state row uses id=1. The AIC app stores
        // members inside app_state.data.members, so read the first state row.
        const response = await fetch(`${base}/rest/v1/app_state?select=data&limit=1`, {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: "application/json"
          }
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`AIC lookup failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
        }
        const rows = await response.json();
        const data = rows?.[0]?.data;
        return Array.isArray(data?.members) ? data.members : [];
      };

      const findAicMember = async ({ mobile, memberId }) => {
        const normalizedMobile = String(mobile || "").replace(/\D/g, "");
        const normalizedId = String(memberId || "").trim().toUpperCase();
        const members = await getAicMembers();
        return members.find(member => {
          const mid = String(member?.memberId || "").trim().toUpperCase();
          const phone = String(member?.mobile || "").replace(/\D/g, "");
          return (normalizedId && mid === normalizedId) || (normalizedMobile && phone === normalizedMobile);
        }) || null;
      };

      // =========================
      // EXISTING MAGIZH SERVER STATE COMPATIBILITY
      // =========================
      // The existing site sends: { key, value } to /api/state.
      // Customer + order data are also copied into D1 as permanent backup.
      // Current app state (including editable products/images) is kept in R2
      // and can be replaced whenever the admin changes it.

      const STATE_KEYS = [
        "magizhProducts",
        "magizhCategories",
        "magizhSettings",
        "magizhUsers",
        "magizhB5",
        "magizhOrders",
        "magizhCoinWallet",
        "magizhAdminPassword"
      ];

      const D1_BACKUP_KEYS = new Set([
        "magizhUsers",
        "magizhOrders"
      ]);

      const stateObjectKey = key =>
        `state/${encodeURIComponent(String(key))}.json`;

      const ensureBackupTables = async () => {
        await env.DB.batch([
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS backup_customers (
              customer_id TEXT PRIMARY KEY,
              name TEXT,
              mobile TEXT,
              data_json TEXT NOT NULL,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `),
          env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS backup_orders (
              order_id TEXT PRIMARY KEY,
              customer_id TEXT,
              order_date TEXT,
              total_amount REAL DEFAULT 0,
              data_json TEXT NOT NULL,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `)
        ]);
      };

      const numberValue = value => {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      };

      const backupCustomers = async value => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return;

        await ensureBackupTables();

        const statements = Object.entries(value).map(([id, user]) =>
          env.DB.prepare(`
            INSERT INTO backup_customers
              (customer_id, name, mobile, data_json, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(customer_id) DO UPDATE SET
              name = excluded.name,
              mobile = excluded.mobile,
              data_json = excluded.data_json,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            String(id),
            user?.name || user?.fullName || "",
            user?.phone || user?.mobile || user?.mobileNumber || "",
            JSON.stringify(user ?? {})
          )
        );

        for (let i = 0; i < statements.length; i += 50) {
          if (statements.length) {
            await env.DB.batch(statements.slice(i, i + 50));
          }
        }
      };

      const backupOrders = async value => {
        if (!Array.isArray(value)) return;

        await ensureBackupTables();

        const statements = [];

        for (const order of value) {
          const orderId = String(
            order?.id ||
            order?.orderId ||
            `legacy-${crypto.randomUUID()}`
          );

          // Payment screenshots remain in the current R2 state.
          // The D1 permanent backup keeps the order/product information.
          const backupOrder = { ...(order || {}) };
          delete backupOrder.paymentScreenshot;

          statements.push(
            env.DB.prepare(`
              INSERT INTO backup_orders
                (order_id, customer_id, order_date, total_amount, data_json, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(order_id) DO UPDATE SET
                customer_id = excluded.customer_id,
                order_date = excluded.order_date,
                total_amount = excluded.total_amount,
                data_json = excluded.data_json,
                updated_at = CURRENT_TIMESTAMP
            `).bind(
              orderId,
              order?.userId || order?.customerId || "",
              order?.date || order?.orderDate || order?.createdAt || "",
              numberValue(
                order?.total ??
                order?.amountPaid ??
                order?.totalAmount ??
                order?.amount
              ),
              JSON.stringify(backupOrder)
            )
          );
        }

        for (let i = 0; i < statements.length; i += 50) {
          await env.DB.batch(statements.slice(i, i + 50));
        }
      };

      const saveCurrentState = async (key, value) => {
        const r2Key = stateObjectKey(key);

        if (value === null || typeof value === "undefined") {
          await env.BUCKET.delete(r2Key);
          return;
        }

        await env.BUCKET.put(
          r2Key,
          JSON.stringify(value),
          {
            httpMetadata: {
              contentType: "application/json; charset=utf-8"
            }
          }
        );

        if (key === "magizhUsers") {
          await backupCustomers(value);
        }

        if (key === "magizhOrders") {
          await backupOrders(value);
        }
      };

      const loadCurrentState = async key => {
        const object = await env.BUCKET.get(stateObjectKey(key));

        if (object) {
          try {
            return JSON.parse(await object.text());
          } catch {
            return null;
          }
        }

        // If current R2 state is missing, reconstruct only the
        // permanent customer/order backups from D1.
        if (key === "magizhUsers" || key === "magizhOrders") {
          await ensureBackupTables();

          if (key === "magizhUsers") {
            const result = await env.DB.prepare(`
              SELECT customer_id, data_json
              FROM backup_customers
              ORDER BY updated_at ASC
            `).all();

            const users = {};
            for (const row of result.results) {
              try {
                users[row.customer_id] = JSON.parse(row.data_json);
              } catch {}
            }
            return users;
          }

          const result = await env.DB.prepare(`
            SELECT data_json
            FROM backup_orders
            ORDER BY order_date ASC, updated_at ASC
          `).all();

          return result.results.map(row => {
            try { return JSON.parse(row.data_json); }
            catch { return {}; }
          });
        }

        return null;
      };

      // GET /api/state
      // Kept compatible with the existing server-sync.js.
      if (url.pathname === "/api/state" && request.method === "GET") {
        const rawKeys = String(url.searchParams.get("keys") || "").trim();
        const keys = rawKeys
          ? rawKeys.split(",").map(x => x.trim()).filter(Boolean)
          : STATE_KEYS;

        const entries = await Promise.all(
          keys.map(async key => [key, await loadCurrentState(key)])
        );

        return json({
          ok: true,
          success: true,
          state: Object.fromEntries(entries)
        });
      }

      // PUT /api/state
      // Existing server-sync.js sends exactly { key, value }.
      if (url.pathname === "/api/state" && request.method === "PUT") {
        const body = await request.json();

        if (!body.key) {
          return json({
            ok: false,
            success: false,
            error: "key required"
          }, 400);
        }

        await saveCurrentState(String(body.key), body.value);

        return json({
          ok: true,
          success: true,
          key: String(body.key),
          message: "State saved"
        });
      }

      // POST /api/state/bulk
      // Kept compatible with the old Node server.
      if (
        url.pathname === "/api/state/bulk" &&
        request.method === "POST"
      ) {
        const body = await request.json();

        if (
          !body.state ||
          typeof body.state !== "object" ||
          Array.isArray(body.state)
        ) {
          return json({
            ok: false,
            success: false,
            error: "state object required"
          }, 400);
        }

        for (const [key, value] of Object.entries(body.state)) {
          await saveCurrentState(key, value);
        }

        return json({
          ok: true,
          success: true,
          message: "State saved"
        });
      }


    try {



      // =========================
      // B5 MEMBER LOOKUP / INITIAL COIN GRANT
      // =========================
      if (url.pathname === "/api/b5/lookup" && request.method === "POST") {
        const body = await request.json();
        const member = await findAicMember({ mobile: body?.mobile, memberId: body?.memberId });
        if (!member) return json({ success: false, found: false, error: "B5 member not found" }, 404);
        const memberId = String(member.memberId || "").trim();
        if (!memberId) return json({ success: false, found: false, error: "B5 member ID missing" }, 500);
        await ensureB5GrantTable();
        const existing = await env.DB.prepare(
          `SELECT member_id, coins, granted_at FROM b5_coin_grants WHERE member_id = ?`
        ).bind(memberId).first();
        let grantedNow = false;
        let grantedCoins = 0;
        if (!existing) {
          try {
            await env.DB.prepare(`INSERT INTO b5_coin_grants (member_id, coins) VALUES (?, ?)`).bind(memberId, B5_INITIAL_COINS).run();
            grantedNow = true;
            grantedCoins = B5_INITIAL_COINS;
          } catch (error) {
            // Another request may have granted the same member at the same time.
            // Re-read and treat the existing grant as already claimed.
            const afterRace = await env.DB.prepare(
              `SELECT member_id, coins, granted_at FROM b5_coin_grants WHERE member_id = ?`
            ).bind(memberId).first();
            if (!afterRace) throw error;
          }
        }
        return json({
          success: true, found: true,
          member: { memberId, name: member.name || "", mobile: member.mobile || "", email: member.email || "", status: member.status || "", level: member.level ?? null, referralId: member.referralId || "" },
          coin: { grantedNow, grantedCoins, initialCoins: B5_INITIAL_COINS }
        });
      }

      // =========================
      // B5 MEMBER LOGIN / AIC AUTHENTICATION
      // =========================
      // Magizh authenticates the existing AIC B5 member read-only.
      // The AIC record is never modified.
      if (url.pathname === "/api/b5/login" && request.method === "POST") {
        const body = await request.json();
        const mobile = String(body?.mobile || "").replace(/\D/g, "");
        const password = String(body?.password || "");
        if (!/^\d{10}$/.test(mobile)) {
          return json({ success: false, error: "Invalid mobile number" }, 400);
        }
        if (!password) {
          return json({ success: false, error: "Password is required" }, 400);
        }

        const member = await findAicMember({ mobile });
        if (!member) {
          return json({ success: false, error: "B5 member not found" }, 404);
        }

        const storedHash = String(member?.passwordHash || "").trim().toLowerCase();
        if (!storedHash) {
          return json({ success: false, error: "B5 password is not set" }, 401);
        }

        const encoded = new TextEncoder().encode(password);
        const digest = await crypto.subtle.digest("SHA-256", encoded);
        const suppliedHash = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("")
          .toLowerCase();

        if (suppliedHash !== storedHash) {
          return json({ success: false, error: "Incorrect password" }, 401);
        }

        const memberId = String(member.memberId || "").trim();
        if (!memberId) {
          return json({ success: false, error: "B5 member ID missing" }, 500);
        }

        await ensureB5GrantTable();
        const existing = await env.DB.prepare(
          `SELECT member_id, coins, granted_at FROM b5_coin_grants WHERE member_id = ?`
        ).bind(memberId).first();

        let grantedNow = false;
        let grantedCoins = 0;
        if (!existing) {
          try {
            await env.DB.prepare(
              `INSERT INTO b5_coin_grants (member_id, coins) VALUES (?, ?)`
            ).bind(memberId, B5_INITIAL_COINS).run();
            grantedNow = true;
            grantedCoins = B5_INITIAL_COINS;
          } catch (error) {
            const afterRace = await env.DB.prepare(
              `SELECT member_id, coins, granted_at FROM b5_coin_grants WHERE member_id = ?`
            ).bind(memberId).first();
            if (!afterRace) throw error;
          }
        }

        const finalGrant = await env.DB.prepare(
          `SELECT coins FROM b5_coin_grants WHERE member_id = ?`
        ).bind(memberId).first();
        const balance = Number(finalGrant?.coins || 0);

        return json({
          success: true,
          member: {
            memberId,
            name: member.name || "",
            mobile: member.mobile || mobile,
            email: member.email || member.rEmail || "",
            status: member.status || "",
            level: member.level ?? null,
            referralId: member.referralId || ""
          },
          coin: {
            grantedNow,
            grantedCoins,
            balance,
            initialCoins: B5_INITIAL_COINS
          }
        });
      }

      // =========================*

      // HEALTH CHECK*\n\n      // =========================*

      if (url.pathname === "/api/health") {

        let database = "OK";

        let storage = "OK";



        try {

          await env.DB.prepare("SELECT 1").first();

        } catch {

          database = "ERROR";

        }



        try {

          await env.BUCKET.list({ limit: 1 });

        } catch {

          storage = "ERROR";

        }



        return json({

          success: true,

          service: "Magizh API",

          database,

          storage

        });

      }





      // =========================*

      // GET CATEGORIES*

      // =========================*

      if (

        url.pathname === "/api/categories" &&

        request.method === "GET"

      ) {

        const result = await env.DB.prepare(`

          SELECT id, name, status, created_at

          FROM categories

          WHERE status = 'active'

          ORDER BY name ASC

        `).all();



        return json({

          success: true,

          categories: result.results

        });

      }





      // =========================*

      // ADD CATEGORY*

      // =========================*

      if (

        url.pathname === "/api/categories" &&

        request.method === "POST"

      ) {

        const body = await request.json();



        if (!body.name || !body.name.trim()) {

          return json({

            success: false,

            error: "Category name is required"

          }, 400);

        }



        const result = await env.DB.prepare(`

          INSERT INTO categories (name)

          VALUES (?)

        `).bind(body.name.trim()).run();



        return json({

          success: true,

          id: result.meta.last_row_id,

          message: "Category added"

        });

      }





      // =========================*

      // UPDATE CATEGORY*

      // =========================*

      const categoryMatch =

        url.pathname.match(/^\/api\/categories\/(\d+)$/);



      if (categoryMatch && request.method === "PUT") {

        const categoryId = Number(categoryMatch[1]);

        const body = await request.json();



        await env.DB.prepare(`

          UPDATE categories

          SET name = ?

          WHERE id = ?

        `).bind(

          body.name.trim(),

          categoryId

        ).run();



        return json({

          success: true,

          message: "Category updated"

        });

      }





      // =========================*

      // DELETE CATEGORY*

      // =========================*

      if (categoryMatch && request.method === "DELETE") {

        const categoryId = Number(categoryMatch[1]);



        await env.DB.prepare(`

          UPDATE categories

          SET status = 'inactive'

          WHERE id = ?

        `).bind(categoryId).run();



        return json({

          success: true,

          message: "Category disabled"

        });

      }





      // =========================*

      // GET PRODUCTS*

      // =========================*

      if (

        url.pathname === "/api/products" &&

        request.method === "GET"

      ) {

        const result = await env.DB.prepare(`

          SELECT

            id,

            name,

            category,

            description,

            price,

            stock,

            status,

            created_at

          FROM products

          WHERE status = 'active'

          ORDER BY id DESC

        `).all();



        return json({

          success: true,

          products: result.results

        });

      }





      // =========================*

      // ADD PRODUCT*

      // =========================*

      if (

        url.pathname === "/api/products" &&

        request.method === "POST"

      ) {

        const body = await request.json();



        if (!body.name || !body.name.trim()) {

          return json({

            success: false,

            error: "Product name is required"

          }, 400);

        }



        const result = await env.DB.prepare(`

          INSERT INTO products

          (

            name,

            category,

            description,

            price,

            stock,

            status

          )

          VALUES (?, ?, ?, ?, ?, 'active')

        `).bind(

          body.name.trim(),

          body.category || "",

          body.description || "",

          Number(body.price || 0),

          Number(body.stock || 0)

        ).run();



        return json({

          success: true,

          product_id: result.meta.last_row_id,

          message: "Product added"

        });

      }





      // =========================*

      // UPDATE PRODUCT*

      // =========================*

      const productMatch =

        url.pathname.match(/^\/api\/products\/(\d+)$/);



      if (productMatch && request.method === "PUT") {

        const productId = Number(productMatch[1]);

        const body = await request.json();



        await env.DB.prepare(`

          UPDATE products

          SET

            name = ?,

            category = ?,

            description = ?,

            price = ?,

            stock = ?

          WHERE id = ?

        `).bind(

          body.name.trim(),

          body.category || "",

          body.description || "",

          Number(body.price || 0),

          Number(body.stock || 0),

          productId

        ).run();



        return json({

          success: true,

          message: "Product updated"

        });

      }





      // =========================*

      // DELETE PRODUCT*

      // =========================*

      if (productMatch && request.method === "DELETE") {

        const productId = Number(productMatch[1]);



        await env.DB.prepare(`

          UPDATE products

          SET status = 'inactive'

          WHERE id = ?

        `).bind(productId).run();



        return json({

          success: true,

          message: "Product disabled"

        });

      }





      // =========================*

      // GET PRODUCT IMAGES*

      // =========================*

      const imageMatch =

        url.pathname.match(/^\/api\/products\/(\d+)\/images$/);



      if (imageMatch && request.method === "GET") {

        const productId = Number(imageMatch[1]);



        const result = await env.DB.prepare(`

          SELECT

            id,

            product_id,

            image_url,

            sort_order,

            alt_text

          FROM product_images

          WHERE product_id = ?

          ORDER BY sort_order ASC

        `).bind(productId).all();



        return json({

          success: true,

          product_id: productId,

          images: result.results

        });

      }





      // =========================*

      // ADD IMAGE RECORD*

      // =========================*

      if (imageMatch && request.method === "POST") {

        const productId = Number(imageMatch[1]);

        const body = await request.json();



        if (!body.image_url) {

          return json({

            success: false,

            error: "image_url is required"

          }, 400);

        }



        const result = await env.DB.prepare(`

          INSERT INTO product_images

          (

            product_id,

            image_url,

            sort_order,

            alt_text

          )

          VALUES (?, ?, ?, ?)

        `).bind(

          productId,

          body.image_url,

          Number(body.sort_order || 1),

          body.alt_text || ""

        ).run();



        return json({

          success: true,

          image_id: result.meta.last_row_id,

          message: "Image added"

        });

      }





      // =========================*

      // DELETE IMAGE*

      // =========================*

      const singleImageMatch =

        url.pathname.match(/^\/api\/product-images\/(\d+)$/);



      if (singleImageMatch && request.method === "DELETE") {

        const imageId = Number(singleImageMatch[1]);



        await env.DB.prepare(`

          DELETE FROM product_images

          WHERE id = ?

        `).bind(imageId).run();



        return json({

          success: true,

          message: "Image deleted"

        });

      }





      // =========================
      // INTRO VIDEO FROM R2
      // =========================
      if (url.pathname === "/login-intro.mp4" && request.method === "GET") {
        const object = await env.BUCKET.get("intro/login-intro.mp4");
        if (!object) return new Response("Intro video not found", { status: 404, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set("Content-Type", "video/mp4");
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "public, max-age=3600");
        return new Response(object.body, { headers });
      }

      // =========================*

      // R2 IMAGE UPLOAD*

      // =========================*

      if (

        url.pathname === "/api/upload" &&

        request.method === "POST"

      ) {

        const formData = await request.formData();

        const file = formData.get("file");



        if (!file || typeof file === "string") {

          return json({

            success: false,

            error: "File is required"

          }, 400);

        }



        const fileName =

          `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;



        await env.BUCKET.put(fileName, file.stream(), {

          httpMetadata: {

            contentType: file.type || "application/octet-stream"

          }

        });



        return json({

          success: true,

          file_name: fileName,

          image_url: `/api/storage/${encodeURIComponent(fileName)}`

        });

      }





      // =========================*

      // SERVE R2 IMAGE*

      // =========================*

      const storageMatch =

        url.pathname.match(/^\/api\/storage\/(.+)$/);



      if (storageMatch && request.method === "GET") {

        const key = decodeURIComponent(storageMatch[1]);



        const object = await env.BUCKET.get(key);



        if (!object) {

          return new Response("Image not found", {

            status: 404,

            headers: corsHeaders

          });

        }



        const headers = new Headers(corsHeaders);



        object.writeHttpMetadata(headers);

        headers.set("etag", object.httpEtag);



        return new Response(object.body, {

          headers

        });

      }





      // =========================*

      // DEFAULT*

      // =========================*

      return json({

        success: true,

        message: "Magizh API is running"

      });



    } catch (error) {



      return json({

        success: false,

        error: error.message

      }, 500);



    }

  }

};