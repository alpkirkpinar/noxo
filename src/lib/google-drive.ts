import { createSign } from "node:crypto";

type GoogleDriveConfig = {
  clientEmail: string;
  privateKey: string;
  folderId: string;
};

type GoogleDriveUploadResult = {
  id: string;
  webViewLink?: string | null;
};

function getConfig(): GoogleDriveConfig {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim() || "";
  const privateKey = (process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || "";

  if (!clientEmail || !privateKey || !folderId) {
    throw new Error(
      "Google Drive yedeği için GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY ve GOOGLE_DRIVE_FOLDER_ID ortam değişkenleri tanımlanmalıdır."
    );
  }

  return { clientEmail, privateKey, folderId };
}

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getAccessToken(config: GoogleDriveConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claimSet))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(config.privateKey);
  const jwt = `${unsignedJwt}.${toBase64Url(signature)}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || "Google Drive erişim anahtarı alınamadı.");
  }

  return tokenPayload.access_token;
}

export async function uploadJsonBackupToGoogleDrive(fileName: string, payload: unknown) {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const boundary = `noxo-backup-${Date.now()}`;
  const metadata = {
    name: fileName,
    parents: [config.folderId],
    mimeType: "application/json",
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(payload, null, 2)}\r\n` +
    `--${boundary}--`;

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const uploadPayload = (await uploadResponse.json().catch(() => ({}))) as GoogleDriveUploadResult & {
    error?: { message?: string };
  };

  if (!uploadResponse.ok || !uploadPayload.id) {
    throw new Error(uploadPayload.error?.message || "Google Drive yedeği yüklenemedi.");
  }

  return uploadPayload;
}
