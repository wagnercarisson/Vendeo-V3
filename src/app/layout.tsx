import type { Metadata, Viewport } from "next";
import "./fonts.css";
import "./globals.css";
import { FALLBACK_ORIGIN, resolveCanonicalOrigin } from "@/lib/seo/origin";
import { NOINDEX_ROBOTS } from "@/lib/seo/indexation-policy";

/**
 * Origem canônica resolvida por ambiente (D-02) — `metadataBase` deriva dela e
 * **nunca** aponta para uma origem divergente de produção (status ≠ `valid` cai
 * no `FALLBACK_ORIGIN`). O default de indexação da raiz é `noindex, nofollow`
 * (D-06); as páginas públicas aprovadas declaram `index` explicitamente.
 */
const resolvedOrigin = resolveCanonicalOrigin();
const metadataBase = new URL(resolvedOrigin.origin ?? FALLBACK_ORIGIN);

// Diagnóstico observável (único efeito colateral permitido): apenas status e
// nomes de variáveis — nunca valores de env nem credenciais.
if (resolvedOrigin.diagnostic || resolvedOrigin.status !== "valid") {
  console.warn(
    `[seo/layout] metadataBase sem origem de produção confirmada (status: ${resolvedOrigin.status})` +
      (resolvedOrigin.diagnostic ? ` — ${resolvedOrigin.diagnostic}` : ""),
  );
}

export const metadata: Metadata = {
  metadataBase,
  title: "Vendeo",
  description: "Motor de geração de campanhas profissionais",
  robots: NOINDEX_ROBOTS,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vendeo",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
