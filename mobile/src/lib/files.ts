import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { gzipSync } from "fflate";
import { API_URL } from "./config";
import type { UploadFile } from "./api";

/** The host refuses request bodies over ~4.5 MB; gzip CSVs above this (POS exports shrink ~5×). */
const GZIP_OVER = 3 * 1024 * 1024;

/** Let the owner pick a sales export from Files, iCloud Drive, Mail attachments… */
export async function pickSalesExport(): Promise<UploadFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: [
      "text/csv",
      "text/comma-separated-values",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "public.comma-separated-values-text",
      "*/*",
    ],
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return prepareUpload({ uri: a.uri, name: a.name, type: a.mimeType ?? "text/csv" }, a.size ?? 0);
}

/** Gzip large CSVs into the cache (the server accepts name.csv.gz and inflates it, capped). */
export async function prepareUpload(file: UploadFile, size: number): Promise<UploadFile> {
  if (!/\.csv$/i.test(file.name) || size < GZIP_OVER) return file;
  const src = new File(file.uri);
  const gz = gzipSync(await src.bytes(), { level: 6 });
  const out = new File(Paths.cache, `${Date.now()}-${file.name}.gz`);
  out.create({ overwrite: true });
  out.write(gz);
  return { uri: out.uri, name: `${file.name}.gz`, type: "application/gzip" };
}

/** A sample restaurant's export, for trying the audit without your own data. */
export async function downloadSample(campaign: boolean): Promise<{ file: UploadFile; campaignStart: string | null }> {
  const name = campaign ? "sample-restaurant-after-campaign.csv" : "sample-restaurant.csv";
  const res = await fetch(`${API_URL}/api/sample-csv${campaign ? "?scenario=campaign" : ""}`);
  const text = await res.text();
  const out = new File(Paths.cache, name);
  out.create({ overwrite: true });
  out.write(text);
  return { file: { uri: out.uri, name, type: "text/csv" }, campaignStart: res.headers.get("x-campaign-start") };
}

/** Download a (possibly private) poster with the user's auth, for the share sheet. */
export async function downloadPoster(path: string, headers: Record<string, string>, name: string): Promise<string> {
  const url = `${API_URL}${path}${path.includes("?") ? "&" : "?"}ar=4x5`;
  const task = File.createDownloadTask(url, new File(Paths.cache, `${name}.png`), { headers });
  const file = await task.downloadAsync();
  if (!file) throw new Error("Download didn't finish.");
  return file.uri;
}
