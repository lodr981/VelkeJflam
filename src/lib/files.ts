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
