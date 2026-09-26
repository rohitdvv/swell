/**
 * Browser side of large uploads: gzip CSVs before sending (a POS export
 * shrinks ~5×), keeping them under the host's 4.5 MB request limit. Excel
 * files are already zip-compressed and go as-is. Falls back to the raw file
 * where CompressionStream is unavailable.
 */
export async function compressForUpload(file: File): Promise<File> {
  if (!/\.csv$/i.test(file.name) || typeof CompressionStream === "undefined") return file;
  try {
    const gz = await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    return new File([gz], `${file.name}.gz`, { type: "application/gzip" });
  } catch {
    return file;
  }
}
