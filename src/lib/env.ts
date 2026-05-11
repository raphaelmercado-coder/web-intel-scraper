import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    get serviceAccountJson() {
      const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
      if (inline) {
        try {
          return JSON.parse(inline);
        } catch {
          throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY_JSON as JSON");
        }
      }
      const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
      if (!filePath) throw new Error("Set GOOGLE_SERVICE_ACCOUNT_KEY_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
      const resolved = resolve(filePath);
      const content = readFileSync(resolved, "utf-8");
      try {
        return JSON.parse(content);
      } catch {
        throw new Error(`Failed to parse ${resolved} as JSON`);
      }
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
      return optional("TRUST_ACCOUNTS_RANGE") ?? "Accounts!A2:L";
    },
    get openaiModel() {
      return optional("TRUST_OPENAI_MODEL") ?? "gpt-4o-mini";
    },
  },
};
