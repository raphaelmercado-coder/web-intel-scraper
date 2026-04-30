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
  },
};
