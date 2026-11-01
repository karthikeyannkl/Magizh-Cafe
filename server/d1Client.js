// Cloudflare D1 Client Adapter for Magizh Shopping Backend
import fs from 'fs';
import path from 'path';

function getWranglerToken() {
  try {
    const configPath = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const match = content.match(/oauth_token\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    }
  } catch (_) {}
  return null;
}

export class D1Client {
  constructor(options = {}) {
    this.accountId = options.accountId || process.env.CF_ACCOUNT_ID || '104cb4ae619367e91c5e05d5a712627e';
    this.databaseId = options.databaseId || process.env.CF_D1_DATABASE_ID || '9893bb1d-a309-4dcf-8429-c04c2310ba49';
    this.token = options.token || process.env.CF_D1_TOKEN || process.env.CF_API_TOKEN || getWranglerToken();
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;
  }

  isConfigured() {
    return Boolean(this.accountId && this.databaseId && this.token);
  }

  async query(sql, params = []) {
    if (!this.isConfigured()) {
      throw new Error('Cloudflare D1 is not fully configured (missing account, database ID, or token).');
    }

    const res = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    const json = await res.json();
    if (!json.success) {
      const errMsg = (json.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`;
      throw new Error(`D1 Query Error: ${errMsg} (SQL: ${sql})`);
    }

    const firstResult = json.result?.[0] || {};
    return {
      results: firstResult.results || [],
      success: true,
      meta: firstResult.meta || {},
    };
  }

  async batch(queries) {
    if (!this.isConfigured()) {
      throw new Error('Cloudflare D1 is not fully configured.');
    }

    const res = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queries),
    });

    const json = await res.json();
    if (!json.success) {
      const errMsg = (json.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`;
      throw new Error(`D1 Batch Error: ${errMsg}`);
    }

    return json.result || [];
  }
}

export const d1 = new D1Client();
