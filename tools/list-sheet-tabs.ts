import "dotenv/config";
import { google } from "googleapis";
import { env } from "../src/lib/env.js";

async function main() {
  const auth = new google.auth.OAuth2(env.google.clientId, env.google.clientSecret, env.google.redirectUri);
  auth.setCredentials({ refresh_token: env.google.refreshToken });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.get({
    spreadsheetId: "1kQBtfBX5uJ6thm-B1KL271XFa7D2zL1sUnPvXRRAVJA",
    fields: "sheets.properties",
  });
  console.log(res.data.sheets?.map((s) => s.properties?.title));
}

main().catch((err) => { console.error(err); process.exit(1); });
