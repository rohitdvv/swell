import "server-only";
import zlib from "node:zlib";

// ============================================================
// Upload bodies. Vercel caps a function request at 4.5 MB, and a month of a
// busy restaurant's line items is 5–10 MB of CSV — so the browser gzips CSVs
// before sending (see lib/compress-upload.ts). Here we accept either form and
// cap the DECOMPRESSED size too, so a tiny zip bomb can't exhaust memory.
// ============================================================

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // on the wire
export const MAX_EXPANDED_BYTES = 80 * 1024 * 1024; // after gunzip
export const ALLOWED_EXT = /\.(csv|xlsx|xls)(\.gz)?$/i;

export class UploadTooLargeError extends Error {}

/** The file's bytes and its real name, un-gzipped when it arrived as `name.csv.gz`. */
export async function readUpload(file: File): Promise<{ buf: Buffer; name: string }> {
  const raw = Buffer.from(await file.arrayBuffer());
  if (!/\.gz$/i.test(file.name)) return { buf: raw, name: file.name };
  try {
    return {
      buf: zlib.gunzipSync(raw, { maxOutputLength: MAX_EXPANDED_BYTES }),
      name: file.name.replace(/\.gz$/i, ""),
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") {
      throw new UploadTooLargeError("That export is too large once unpacked — export a shorter date range.");
    }
    throw e;
  }
}
