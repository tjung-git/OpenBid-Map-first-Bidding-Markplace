process.env.PROTOTYPE = "TRUE";
process.env.APP_URL = "https://openbid2107.web.app";
process.env.DUO_CLIENT_ID = "test_client";
process.env.DUO_CLIENT_SECRET = "test_secret";
process.env.DUO_API_HOST = "api-test.duosecurity.com";
process.env.DUO_REDIRECT_URI = "https://openbid2107.web.app/api/auth/duo/callback";

import { jest } from "@jest/globals";

jest.unstable_mockModule("@duosecurity/duo_universal", () => {
  class Client {
    constructor(opts) {
      this.opts = opts;
    }
    async healthCheck() {}
    generateState() {
      return "mock-state";
    }
    createAuthUrl({ state } = {}) {
      return `/duo/mock/authorize?state=${state || "mock-state"}`;
    }
    async exchangeAuthorizationCodeFor2faResult(code) {
      if (code?.startsWith("allow-")) {
        return { result: "allow", success: true, user: { username: "duo@test.local" } };
      }
      if (code?.startsWith("deny-")) {
        return { result: "deny", success: false };
      }
      return { result: "allow", success: true };
    }
    async exchangeAuthorizationCodeFor2FAResult(code, state) {
      return this.exchangeAuthorizationCodeFor2faResult(code, state);
    }
  }
  return { Client, default: { Client } };
});
