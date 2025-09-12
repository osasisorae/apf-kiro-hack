const https = require("https");

class OandaClient {
  constructor(options = {}) {
    this.token = options.token || process.env.OANDA_TOKEN;
    this.environment =
      options.environment || process.env.OANDA_ENVIRONMENT || "practice";

    this.baseUrl =
      this.environment === "live"
        ? "api-fxtrade.oanda.com"
        : "api-fxpractice.oanda.com";

    // Token validation will be done in methods that need it
  }

  async makeRequest(path, method = "GET", body = null) {
    if (!this.token) {
      throw new Error(
        "OANDA token is required. Set OANDA_TOKEN in your .env file.",
      );
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = data ? JSON.parse(data) : {};
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: response,
              success: res.statusCode >= 200 && res.statusCode < 300,
            });
          } catch (error) {
            reject(
              new Error(
                `Failed to parse response: ${error.message}. Raw data: ${data}`,
              ),
            );
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  async getAccounts() {
    const response = await this.makeRequest("/v3/accounts");
    return response;
  }

  async getAccount(accountId = null) {
    const id = accountId;
    if (!id) throw new Error("Account ID is required");
    const response = await this.makeRequest(`/v3/accounts/${id}`);
    return response;
  }

  async getAccountSummary(accountId = null) {
    const id = accountId;
    if (!id) throw new Error('Account ID is required');
    const response = await this.makeRequest(`/v3/accounts/${id}/summary`);
    return response;
  }

  async getInstruments(accountId = null) {
    const id = accountId;
    if (!id) throw new Error("Account ID is required");
    const response = await this.makeRequest(`/v3/accounts/${id}/instruments`);
    return response;
  }

  async getPricing(instruments, accountId = null) {
    const id = accountId;
    if (!id) throw new Error("Account ID is required");
    const instrumentsParam = Array.isArray(instruments)
      ? instruments.join(",")
      : instruments;
    const response = await this.makeRequest(
      `/v3/accounts/${id}/pricing?instruments=${instrumentsParam}`,
    );
    return response;
  }

  async getCandles(instrument, options = {}) {
    const params = new URLSearchParams();

    // Default options
    params.append("granularity", options.granularity || "H1");
    params.append("count", options.count || "10");

    // Add other optional parameters
    if (options.from) params.append("from", options.from);
    if (options.to) params.append("to", options.to);
    if (options.price) params.append("price", options.price);

    const response = await this.makeRequest(
      `/v3/instruments/${instrument}/candles?${params.toString()}`,
    );
    return response;
  }

  async placeOrder(orderBody, accountId = null) {
    const id = accountId;
    if (!id) throw new Error('Account ID is required to place an order');

    // POST to /v3/accounts/:id/orders
    const path = `/v3/accounts/${id}/orders`;
    const response = await this.makeRequest(path, 'POST', orderBody);
    return response;
  }

  async getOpenTrades(accountId = null) {
    const id = accountId;
    if (!id) throw new Error('Account ID is required');
    const path = `/v3/accounts/${id}/openTrades`;
    return this.makeRequest(path, 'GET');
  }

  async getTransactions(accountId = null, { from = undefined, to = undefined, types = undefined, pageSize = undefined } = {}) {
    const id = accountId;
    if (!id) throw new Error('Account ID is required');
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (types && Array.isArray(types) && types.length > 0) params.append('type', types.join(','));
    if (pageSize) params.append('pageSize', String(pageSize));
    const qs = params.toString();
    const path = qs ? `/v3/accounts/${id}/transactions?${qs}` : `/v3/accounts/${id}/transactions`;
    return this.makeRequest(path, 'GET');
  }

  async getTransactionsSinceId(accountId = null, sinceTransactionID) {
    const id = accountId;
    if (!id) throw new Error('Account ID is required');
    if (!sinceTransactionID) throw new Error('sinceTransactionID is required');
    const path = `/v3/accounts/${id}/transactions/sinceid?id=${encodeURIComponent(String(sinceTransactionID))}`;
    return this.makeRequest(path, 'GET');
  }

  async closeTrade(tradeId, units = 'ALL', accountId = null) {
    const id = accountId;
    if (!id) throw new Error('Account ID is required');
    if (!tradeId) {
      throw new Error('Trade ID is required');
    }
    const path = `/v3/accounts/${id}/trades/${tradeId}/close`;
    return this.makeRequest(path, 'PUT', { units: String(units) });
  }

  async closePosition(instrument, { longUnits = undefined, shortUnits = undefined } = {}, accountId = null) {
    const id = accountId;
    if (!id) throw new Error('Account ID is required');
    if (!instrument) throw new Error('Instrument is required');
    const path = `/v3/accounts/${id}/positions/${instrument}/close`;
    const body = {};
    if (longUnits !== undefined) body.longUnits = String(longUnits);
    if (shortUnits !== undefined) body.shortUnits = String(shortUnits);
    return this.makeRequest(path, 'PUT', body);
  }

  async testConnection() {
    console.log("🔗 Testing OANDA API Connection...");
    console.log(`Environment: ${this.environment}`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(
      `Token: ${this.token ? this.token.substring(0, 10) + "..." : "NOT_SET"}`,
    );
    console.log("─".repeat(50));

    try {
      // Test accounts endpoint
      console.log("📋 Testing: Get Accounts");
      const accountsResponse = await this.getAccounts();

      if (accountsResponse.success) {
        console.log("✅ Connection successful!");
        console.log(
          `Found ${accountsResponse.data.accounts?.length || 0} accounts`,
        );

        if (
          accountsResponse.data.accounts &&
          accountsResponse.data.accounts.length > 0
        ) {
          const firstAccount = accountsResponse.data.accounts[0];
          console.log(
            `Primary Account: ${firstAccount.id} (${firstAccount.currency})`,
          );

          return {
            success: true,
            accounts: accountsResponse.data.accounts,
            primaryAccount: firstAccount,
          };
        }
      } else {
        console.log(`❌ Connection failed: ${accountsResponse.statusCode}`);
        console.log("Error:", JSON.stringify(accountsResponse.data, null, 2));
        return {
          success: false,
          error: accountsResponse.data,
          statusCode: accountsResponse.statusCode,
        };
      }
    } catch (error) {
      console.log(`❌ Connection error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = OandaClient;
