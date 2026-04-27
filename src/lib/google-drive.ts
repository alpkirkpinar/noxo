type GoogleDriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
};

type GoogleDriveUploadResult = {
  id: string;
  webViewLink?: string | null;
};

function getConfig(): GoogleDriveConfig {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() || "";
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim() || "";
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || "";

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error(
      "Google Drive yedeği için GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN ve GOOGLE_DRIVE_FOLDER_ID ortam değişkenleri tanımlanmalıdır."
    );
  }

  return { clientId, clientSecret, refreshToken, folderId };
}

async function getAccessToken(config: GoogleDriveConfig) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(
      tokenPayload.error_description || tokenPayload.error || "Google Drive erişim anahtarı yenilenemedi."
    );
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
