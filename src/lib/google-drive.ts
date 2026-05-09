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

type GoogleErrorPayload = {
  access_token?: string;
  error_description?: string;
  error?: string | { message?: string };
};

async function readJsonResponse<T>(response: Response): Promise<{ data: T | null; text: string }> {
  const text = await response.text();
  if (!text) return { data: null, text: "" };

  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null, text };
  }
}

function getGoogleErrorMessage(
  response: Response,
  payload: GoogleErrorPayload | null,
  fallback: string,
  rawText: string
) {
  const structuredError =
    payload?.error_description ||
    (typeof payload?.error === "string" ? payload.error : payload?.error?.message);

  if (structuredError) {
    return structuredError;
  }

  if (rawText.trim()) {
    return `Google Drive isteği başarısız oldu (${response.status}): ${rawText}`;
  }

  return fallback;
}

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

  const { data: tokenPayload, text: tokenText } = await readJsonResponse<GoogleErrorPayload>(tokenResponse);

  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(
      getGoogleErrorMessage(
        tokenResponse,
        tokenPayload,
        "Google Drive erişim anahtarı yenilenemedi.",
        tokenText
      )
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

  const { data: uploadPayload, text: uploadText } = await readJsonResponse<
    GoogleDriveUploadResult & { error?: { message?: string } }
  >(uploadResponse);

  if (!uploadResponse.ok || !uploadPayload?.id) {
    throw new Error(
      getGoogleErrorMessage(uploadResponse, uploadPayload, "Google Drive yedeği yüklenemedi.", uploadText)
    );
  }

  return uploadPayload;
}
