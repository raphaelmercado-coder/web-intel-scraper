import "dotenv/config";
import http from "node:http";
import { google } from "googleapis";
import { exec } from "node:child_process";

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) {
    res.writeHead(404).end();
    return;
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Missing code");
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" }).end(
      "<h2>Success.</h2><p>Refresh token printed in your terminal. You can close this tab.</p>",
    );
    console.log("\n=== Refresh token ===");
    console.log(tokens.refresh_token);
    console.log("=====================\n");
    console.log("Paste this into .env as GOOGLE_REFRESH_TOKEN.");
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500).end("Token exchange failed. Check terminal.");
    console.error(err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Listening on ${REDIRECT_URI}`);
  console.log("Opening browser for consent…");
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${opener} "${authUrl}"`);
  console.log("\nIf the browser doesn't open, visit:\n" + authUrl);
});
