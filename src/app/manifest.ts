import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vendeo",
    short_name: "Vendeo",
    description: "Motor de geração de campanhas profissionais",
    // "/" will become the public landing page after the landing quick merges —
    // the installed PWA entry must be "/dashboard" (authed users land in the
    // app; visitors are redirected to /login?redirect=/dashboard by middleware).
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    theme_color: "#0F172A",
    background_color: "#0F172A",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
