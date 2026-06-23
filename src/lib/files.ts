import { toFile } from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic";

export const FILES_BETA = "files-api-2025-04-14";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Nahraje soubor (PDF nebo obrázek) do Anthropic Files API a vrátí jeho file_id. */
export async function uploadToFiles(
  buffer: Buffer,
  filename: string,
  mediaType: string
): Promise<string> {
  const uploaded = await anthropic.beta.files.upload({
    file: await toFile(buffer, filename, { type: mediaType }),
    betas: [FILES_BETA],
  });
  return uploaded.id;
}

export function isImageType(mediaType: string): boolean {
  return IMAGE_TYPES.includes(mediaType);
}

export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/** Normalizuje nahraný soubor z FormData bez závislosti na globálním `File`
 *  (ten v Node 18 neexistuje – Railway). */
export function getUploadedFile(value: FormDataEntryValue | null): UploadedFile | null {
  if (!value || typeof value === "string") return null;
  const f = value as unknown as Partial<UploadedFile>;
  if (typeof f.arrayBuffer !== "function") return null;
  return {
    name: typeof f.name === "string" ? f.name : "soubor",
    size: typeof f.size === "number" ? f.size : 0,
    type: typeof f.type === "string" ? f.type : "",
    arrayBuffer: f.arrayBuffer.bind(value),
  };
}
