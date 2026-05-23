import { Readable } from "node:stream";
import { google } from "googleapis";
import { env } from "./env.js";

export class DriveError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "DriveError";
    this.retryable = retryable;
  }
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: env.google.serviceAccountJson,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export interface UploadDocxParams {
  name: string;
  buffer: Buffer;
  folderId: string;
}

export interface UploadDocxResult {
  id: string;
  webViewLink: string;
  name: string;
}

export async function uploadDocx(params: UploadDocxParams): Promise<UploadDocxResult> {
  const drive = getDriveClient();

  try {
    const res = await drive.files.create({
      requestBody: {
        name: params.name,
        mimeType: DOCX_MIME,
        parents: [params.folderId],
      },
      media: {
        mimeType: DOCX_MIME,
        body: Readable.from(params.buffer),
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });

    const id = res.data.id;
    const webViewLink = res.data.webViewLink;
    const name = res.data.name ?? params.name;
    if (!id || !webViewLink) {
      throw new DriveError("Drive response missing id or webViewLink", true);
    }
    return { id, webViewLink, name };
  } catch (err) {
    if (err instanceof DriveError) throw err;
    const status = (err as { code?: number; status?: number })?.code
      ?? (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);
    const retryable = !status || status >= 500 || status === 429;
    throw new DriveError(`Drive upload failed: ${message}`, retryable);
  }
}
