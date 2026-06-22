import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Životopis stroje — AI údržbář",
  description: "Digitální životopis každého stroje a AI nápověda k údržbě.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body>
        <header className="bg-brand text-white shadow">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="text-xl">🔧</span>
              <span>Životopis stroje</span>
            </Link>
            <span className="ml-auto text-xs text-teal-100">AI údržbář</span>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
