import type { NextConfig } from "next";

/** Diretório de build exclusivo do laboratório local (nunca o `.next` padrão). */
const LAB_DIST_DIR = "supabase/.temp/landing-lab/.next-web";
/** Tsconfig dedicado do laboratório, gerado em runtime e ignorado pelo Git. */
const LAB_TSCONFIG = "tsconfig.landing-lab.json";

/**
 * Sentinel definido exclusivamente por
 * `supabase/.temp/landing-lab/start-web.mjs`. Sem ele, o projeto mantém o
 * comportamento padrão (distDir `.next`, tsconfig raiz) para dev, build,
 * Vercel e demais processos.
 */
const isLabIsolated = process.env.VENDEO_LAB_ISOLATED_DIST === "true";

const nextConfig: NextConfig = {
  ...(isLabIsolated
    ? {
        distDir: LAB_DIST_DIR,
        typescript: { tsconfigPath: LAB_TSCONFIG },
      }
    : {}),
  async redirects() {
    return [
      {
        source: "/minhas-campanhas",
        destination: "/campanhas",
        statusCode: 301,
      },
      {
        source: "/campanha/:id",
        destination: "/campanhas/:id",
        statusCode: 301,
      },
      {
        source: "/store",
        destination: "/loja",
        statusCode: 301,
      },
      {
        source: "/campaign/preview",
        destination: "/campanhas/nova",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
