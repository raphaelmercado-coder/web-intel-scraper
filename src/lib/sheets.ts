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

export async function readRange(range: string): Promise<string[][]> {
  const spreadsheetId = env.google.spreadsheetId;
  if (!spreadsheetId) throw new SheetsError("GOOGLE_SHEETS_SPREADSHEET_ID is not set");
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values ?? []) as string[][];
}

export async function batchUpdateCells(
  updates: { range: string; value: string }[],
): Promise<void> {
  const spreadsheetId = env.google.spreadsheetId;
  if (!spreadsheetId) throw new SheetsError("GOOGLE_SHEETS_SPREADSHEET_ID is not set");
  if (updates.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates.map((u) => ({ range: u.range, values: [[u.value]] })),
    },
  });
}
