import { google } from "googleapis";
import { env } from "./env.js";
import { SHEET_TAB } from "./config.js";

export class SheetsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsError";
  }
}

function getSheetsClient() {
  const auth = new google.auth.OAuth2(
    env.google.clientId,
    env.google.clientSecret,
    env.google.redirectUri,
  );
  auth.setCredentials({ refresh_token: env.google.refreshToken });
  return google.sheets({ version: "v4", auth });
}

export async function appendRow(
  values: (string | number)[],
): Promise<{ updatedRange: string | undefined }> {
  const spreadsheetId = env.google.spreadsheetId;
  if (!spreadsheetId) {
    throw new SheetsError("GOOGLE_SHEETS_SPREADSHEET_ID is not set");
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TAB}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });

  return { updatedRange: res.data.updates?.updatedRange ?? undefined };
}
