import "dotenv/config";
import { google } from "googleapis";

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI ?? "http://localhost",
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });
const drive = google.drive({ version: "v3", auth });

const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

const res = await drive.files.list({
  q: `'${folderId}' in parents and trashed = false`,
  fields: "files(id, name, createdTime, webViewLink)",
  orderBy: "createdTime desc",
  pageSize: 5,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

console.log(`Recent files in folder ${folderId}:`);
for (const f of res.data.files ?? []) {
  console.log(`- ${f.name} (${f.createdTime}) ${f.webViewLink}`);
}
