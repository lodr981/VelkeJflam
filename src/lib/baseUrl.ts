import { headers } from "next/headers";

/** Absolutní URL aplikace (pro QR kódy odkazující na stránku stroje). */
export function baseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
