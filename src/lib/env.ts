function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  openai: {
    get apiKey() {
      return required("OPENAI_API_KEY");
    },
  },
  firecrawl: {
    get apiKey() {
      return required("FIRECRAWL_API_KEY");
    },
  },
  google: {
    get clientId() {
      return required("GOOGLE_CLIENT_ID");
    },
    get clientSecret() {
      return required("GOOGLE_CLIENT_SECRET");
    },
    get refreshToken() {
      return required("GOOGLE_REFRESH_TOKEN");
    },
    get redirectUri() {
      return optional("GOOGLE_REDIRECT_URI") ?? "http://localhost";
    },
    get spreadsheetId() {
      return optional("GOOGLE_SHEETS_SPREADSHEET_ID");
    },
    get driveFolderId() {
      return required("GOOGLE_DRIVE_FOLDER_ID");
    },
  },
  webhook: {
    get secret() {
      return required("WEBHOOK_SECRET");
    },
    get port() {
      const raw = optional("PORT") ?? optional("WEBHOOK_PORT");
      const parsed = raw ? Number(raw) : 3000;
      return Number.isFinite(parsed) ? parsed : 3000;
    },
  },
  n8n: {
    get webhookUrl() {
      return required("N8N_TRUST_WEBHOOK_URL");
    },
    get webhookSecret() {
      return optional("N8N_TRUST_WEBHOOK_SECRET") ?? "";
    },
  },
  trust: {
    get accountsRange() {
      return optional("TRUST_ACCOUNTS_RANGE") ?? "Accounts!A2:H";
    },
    get openaiModel() {
      return optional("TRUST_OPENAI_MODEL") ?? "gpt-4o-mini";
    },
  },
};
