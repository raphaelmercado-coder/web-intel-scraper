import "dotenv/config";
import { google } from "googleapis";

const clientId = process.env.GOOGLE_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN!;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost";

const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
auth.setCredentials({ refresh_token: refreshToken });
const drive = google.drive({ version: "v3", auth });

async function main() {
  console.log(`Probing folder: ${folderId}`);

  const about = await drive.about.get({ fields: "user" });
  console.log("Authenticated as:", about.data.user?.emailAddress);

  try {
    const folder = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType, owners(emailAddress), driveId, trashed",
      supportsAllDrives: true,
    });
    console.log("Folder metadata:", folder.data);
  } catch (err) {
    const e = err as { code?: number; message?: string };
    console.error(`get() failed: code=${e.code} message=${e.message}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
