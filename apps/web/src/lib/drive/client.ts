import { extractTextFromFile } from "@/lib/gemini/extract";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export function extractFileIdFromUrl(url: string): string | null {
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{25,})/,
    /[?&]id=([a-zA-Z0-9_-]{25,})/,
    /\/folders\/([a-zA-Z0-9_-]{25,})/,
    /^([a-zA-Z0-9_-]{25,})$/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

type DriveMeta = { name: string; mimeType: string };

async function authFetch(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

export async function readDriveFile(params: {
  fileUrl: string;
  accessToken: string;
}): Promise<{ content: string; title: string; mimeType: string; fileId: string }> {
  const { fileUrl, accessToken } = params;
  const fileId = extractFileIdFromUrl(fileUrl);
  if (!fileId) {
    throw new Error("Could not extract a Google Drive file ID from the URL");
  }

  const metaRes = await authFetch(
    `${DRIVE_API}/files/${fileId}?fields=name,mimeType`,
    accessToken,
  );
  if (!metaRes.ok) {
    throw new Error(`Drive metadata fetch failed: ${metaRes.status} ${await metaRes.text()}`);
  }
  const meta = (await metaRes.json()) as DriveMeta;

  let content = "";

  if (meta.mimeType === "application/vnd.google-apps.document") {
    const res = await authFetch(
      `${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
      accessToken,
    );
    if (!res.ok) throw new Error(`Drive doc export failed: ${res.status}`);
    content = await res.text();
  } else if (meta.mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await authFetch(
      `${DRIVE_API}/files/${fileId}/export?mimeType=text/csv`,
      accessToken,
    );
    if (!res.ok) throw new Error(`Drive sheet export failed: ${res.status}`);
    content = await res.text();
  } else if (meta.mimeType === "application/vnd.google-apps.presentation") {
    const res = await authFetch(
      `${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
      accessToken,
    );
    if (!res.ok) throw new Error(`Drive slides export failed: ${res.status}`);
    content = await res.text();
  } else if (meta.mimeType === "application/pdf") {
    const res = await authFetch(`${DRIVE_API}/files/${fileId}?alt=media`, accessToken);
    if (!res.ok) throw new Error(`Drive PDF download failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    content = await extractTextFromFile({
      base64: buffer.toString("base64"),
      mimeType: "application/pdf",
    });
  } else {
    const res = await authFetch(`${DRIVE_API}/files/${fileId}?alt=media`, accessToken);
    if (!res.ok) {
      throw new Error(
        `Drive file download failed: ${res.status} (mimeType=${meta.mimeType})`,
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    try {
      content = await extractTextFromFile({
        base64: buffer.toString("base64"),
        mimeType: meta.mimeType,
      });
    } catch {
      content = `[Google Drive file: ${meta.name}] — Could not extract text from this file type (${meta.mimeType}).`;
    }
  }

  return {
    content,
    title: meta.name || "Untitled Drive Document",
    mimeType: meta.mimeType,
    fileId,
  };
}
