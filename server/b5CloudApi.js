// AIC / B5 Coin Cloud Integration Client
// Mediates server-to-server communication between Magizh Shopping and the AIC / B5 Coin Cloud Gateway.
// Enforces separate database architecture and server-to-server security.
// POLICY: Never silently fall back to local ledger in production.

import dotenv from 'dotenv';
dotenv.config();

// Dynamic environment getter to support runtime configuration and testing
function getB5Config() {
  const url = process.env.B5_CLOUD_API_URL || null;
  const key = process.env.B5_CLOUD_API_KEY || null;
  const requireCloud = process.env.B5_REQUIRE_CLOUD === 'true';
  return { url, key, requireCloud };
}

export const b5CloudClient = {
  /**
   * Returns current B5 Cloud API connection and configuration status.
   */
  getStatus() {
    const { url, key, requireCloud } = getB5Config();
    const isConfigured = Boolean(url && key);
    return {
      configured: isConfigured,
      endpoint: url ? url.replace(/:\/\/.*@/, '://***@') : null,
      mode: isConfigured ? 'LIVE_B5_CLOUD_API' : (requireCloud ? 'PRODUCTION_GATEWAY_REQUIRED' : 'STANDALONE_ISOLATED_LEDGER'),
      architecture: 'DECOUPLED_API_CLIENT',
      databaseIsolation: 'STRICTLY_SEPARATE_DATABASES',
      currencyRule: '1 B5 Coin = ₹1',
      maxRedemptionCap: '50% of original bill amount',
      requireCloudInProduction: requireCloud,
      silentFallbackAllowed: !requireCloud,
      message: isConfigured
        ? 'Connected to AIC/B5 Cloud API Gateway.'
        : (requireCloud
            ? 'CRITICAL: B5_CLOUD_API_URL and B5_CLOUD_API_KEY must be configured when B5_REQUIRE_CLOUD is true. Silent fallback to local ledger is disallowed by policy.'
            : 'Running with isolated local double-entry ledger active. B5_REQUIRE_CLOUD is false.'),
    };
  },

  /**
   * Performs an active connection health ping to the AIC/B5 Cloud API gateway.
   */
  async verifyConnection() {
    const { url, key, requireCloud } = getB5Config();
    if (!url || !key) {
      if (requireCloud) {
        throw new Error('B5_CLOUD_CONFIG_MISSING: B5_CLOUD_API_URL and B5_CLOUD_API_KEY are missing while B5_REQUIRE_CLOUD=true.');
      }
      return {
        connected: false,
        mode: 'STANDALONE_ISOLATED_LEDGER',
        reason: 'Credentials not configured in environment (allowed when B5_REQUIRE_CLOUD=false).',
      };
    }

    try {
      const response = await fetch(`${url}/api/v1/health`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'X-Magizh-Client': 'Magizh-Commerce-Server/1.0',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`B5 Cloud API responded with HTTP status ${response.status} ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      return {
        connected: true,
        endpoint: url,
        gatewayStatus: data.status || 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      if (requireCloud) {
        throw new Error(`B5_CLOUD_GATEWAY_UNREACHABLE: Failed to ping AIC/B5 Cloud API: ${err.message}`);
      }
      return {
        connected: false,
        error: err.message,
      };
    }
  },

  /**
   * Looks up a customer's B5 ID and balance via real B5 Cloud API.
   * POLICY: Never silently fall back to local ledger when B5_REQUIRE_CLOUD is true.
   */
  async lookupCustomerBalance(b5CustomerId, localFallbackFn = null) {
    const { url, key, requireCloud } = getB5Config();
    if (url && key) {
      try {
        const response = await fetch(`${url}/api/v1/coins/balance/${encodeURIComponent(b5CustomerId)}`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'X-Magizh-Client': 'Magizh-Commerce-Server/1.0',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const cloudData = await response.json();
          return {
            source: 'b5_cloud_api',
            b5CustomerId,
            availableBalance: cloudData.availableBalance,
            totalEarned: cloudData.totalEarned,
            verifiedViaCloud: true,
            timestamp: new Date().toISOString(),
          };
        } else if (response.status === 404) {
          if (requireCloud) {
            throw new Error(`B5_CUSTOMER_NOT_FOUND: Customer with identifier "${b5CustomerId}" does not exist in the AIC/B5 Cloud Ledger.`);
          }
        } else {
          throw new Error(`B5 Cloud API error: HTTP ${response.status}`);
        }
      } catch (err) {
        if (requireCloud) {
          throw new Error(`B5_CLOUD_LOOKUP_FAILED: Failed to retrieve balance from AIC/B5 Cloud API (${err.message}). Silent fallback to local ledger is disallowed when B5_REQUIRE_CLOUD=true.`);
        }
        console.warn('[B5CloudClient] Staging fallback to local ledger:', err.message);
      }
    } else if (requireCloud) {
      throw new Error('B5_CLOUD_CONFIG_MISSING: Cannot query B5 coin balance. B5_REQUIRE_CLOUD=true requires B5_CLOUD_API_URL and B5_CLOUD_API_KEY.');
    }

    // Allowed ONLY when requireCloud is false
    if (localFallbackFn) {
      const localAcc = localFallbackFn(b5CustomerId);
      return {
        source: 'magizh_isolated_ledger',
        b5CustomerId,
        availableBalance: localAcc ? localAcc.availableBalance : 0,
        totalEarned: localAcc ? localAcc.totalEarned : 0,
        verifiedViaCloud: false,
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  },

  /**
   * Requests a coin redemption authorization from B5 Cloud API.
   * POLICY: Never silently fall back when B5_REQUIRE_CLOUD is true.
   */
  async requestRedemption({ b5CustomerId, coins, billId, originalAmount }) {
    const { url, key, requireCloud } = getB5Config();
    if (url && key) {
      try {
        const idempotencyKey = `redemption-${billId}-${coins}`;
        const response = await fetch(`${url}/api/v1/coins/redeem-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'X-Idempotency-Key': idempotencyKey,
            'X-Magizh-Client': 'Magizh-Commerce-Server/1.0',
          },
          body: JSON.stringify({
            customerId: b5CustomerId,
            coins,
            billId,
            originalAmount,
            redemptionCapPercent: 50,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            ...result,
            source: 'b5_cloud_api',
            verifiedViaCloud: true,
          };
        }

        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `B5 Cloud returned HTTP ${response.status}`);
      } catch (err) {
        if (requireCloud) {
          throw new Error(`B5_REDEMPTION_AUTH_FAILED: AIC/B5 Cloud API rejected or failed to process redemption request (${err.message}). Silent fallback disallowed when B5_REQUIRE_CLOUD=true.`);
        }
        console.warn('[B5CloudClient] Staging fallback for redemption request:', err.message);
      }
    } else if (requireCloud) {
      throw new Error('B5_CLOUD_CONFIG_MISSING: B5_REQUIRE_CLOUD=true requires B5_CLOUD_API_URL and B5_CLOUD_API_KEY for coin redemption.');
    }

    return {
      success: true,
      mode: 'isolated_local_redemption',
      reservedCoins: coins,
      verifiedViaCloud: false,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Finalizes coin debit upon Admin verification.
   * POLICY: Never silently fall back when B5_REQUIRE_CLOUD is true.
   */
  async finalizeDebit({ b5CustomerId, coins, billNumber, receiptNumber }) {
    const { url, key, requireCloud } = getB5Config();
    if (url && key) {
      try {
        const idempotencyKey = `debit-${billNumber}-${receiptNumber}`;
        const response = await fetch(`${url}/api/v1/coins/debit-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'X-Idempotency-Key': idempotencyKey,
            'X-Magizh-Client': 'Magizh-Commerce-Server/1.0',
          },
          body: JSON.stringify({
            customerId: b5CustomerId,
            coins,
            billNumber,
            receiptNumber,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            ...result,
            source: 'b5_cloud_api',
            verifiedViaCloud: true,
          };
        }

        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `B5 Cloud returned HTTP ${response.status}`);
      } catch (err) {
        if (requireCloud) {
          throw new Error(`B5_DEBIT_CONFIRM_FAILED: AIC/B5 Cloud API failed to finalize coin debit (${err.message}). Silent fallback disallowed when B5_REQUIRE_CLOUD=true.`);
        }
        console.warn('[B5CloudClient] Staging fallback for debit confirmation:', err.message);
      }
    } else if (requireCloud) {
      throw new Error('B5_CLOUD_CONFIG_MISSING: B5_REQUIRE_CLOUD=true requires B5_CLOUD_API_URL and B5_CLOUD_API_KEY for coin debit.');
    }

    return {
      success: true,
      mode: 'isolated_local_debit',
      debitedCoins: coins,
      verifiedViaCloud: false,
      timestamp: new Date().toISOString(),
    };
  },
};
