// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  getSurfacePolicy,
} from "@/lib/seo/indexation-policy";

/**
 * Matriz D-05 de política de indexação por superfície (F51.2 / D-05 / D-09).
 *
 * Verifica por teste que **todas** as superfícies privadas/legais/transitórias
 * são `noindex, nofollow` e ficam fora do sitemap, que a home é a única exceção
 * (`index, follow` + no sitemap) e que o default é fail-closed.
 *
 * Também confirma que as 3 páginas legais declaram `robots: NOINDEX_ROBOTS`
 * explicitamente e que a raiz herda o default `noindex` para rotas sem
 * aprovação. `middleware.ts`/autenticação **não** são tocados por esta fatia.
 *
 * Mock mínimo (apenas dependências pesadas de node): `document-versions` puxa o
 * cliente Supabase server (que lança sem env) e o viewer é um componente client
 * com `react-markdown`. Nenhuma página de produto é alterada para satisfazer o
 * teste.
 */

vi.mock("@/lib/legal/document-versions", () => ({
  getCurrentVersion: vi.fn(async () => null),
}));

vi.mock("@/components/legal/legal-document-viewer", () => ({
  LegalDocumentViewer: () => null,
}));

import { metadata as termosMetadata } from "@/app/(marketing)/termos/page";
import { metadata as privacidadeMetadata } from "@/app/(marketing)/privacidade/page";
import { metadata as usoAceitavelMetadata } from "@/app/(marketing)/uso-aceitavel/page";
import { metadata as rootMetadata } from "@/app/layout";

const NOINDEX_SURFACES = [
  // 2. páginas de auth
  "/login",
  "/signup",
  "/check-email",
  "/forgot-password",
  "/update-password",
  // 3. route handlers de auth
  "/auth/confirm",
  "/auth/callback",
  "/auth/signout",
  // 4. painel autenticado (inclui /novidades, /legal/reaccept, /cadastro)
  "/dashboard",
  "/loja",
  "/campanhas",
  "/campanhas/nova",
  "/conta",
  "/configuracoes",
  "/novidades",
  "/legal/reaccept",
  "/cadastro",
  "/cadastro/cnpj",
  // 5. admin
  "/admin",
  "/admin/users",
  // 6. documentos legais
  "/termos",
  "/privacidade",
  "/uso-aceitavel",
  // 7. versões Markdown dos legais
  "/docs/legal/terms-of-service-v1-4.md",
  // 8. APIs
  "/api/x",
  // default fail-closed
  "/rota-nova",
];

describe("getSurfacePolicy — matriz D-05 (todas as superfícies privadas/legais)", () => {
  it.each(NOINDEX_SURFACES)("%s ⇒ NOINDEX_ROBOTS e fora do sitemap", (path) => {
    const policy = getSurfacePolicy(path);
    expect(policy.robots).toEqual(NOINDEX_ROBOTS);
    expect(policy.inSitemap).toBe(false);
  });

  it("/ ⇒ INDEX_ROBOTS e no sitemap (exceção só sob a condição combinada)", () => {
    const policy = getSurfacePolicy("/");
    expect(policy.robots).toEqual(INDEX_ROBOTS);
    expect(policy.inSitemap).toBe(true);
  });
});

const LEGAL_METADATA: Array<[string, { robots?: unknown }]> = [
  ["/termos", termosMetadata],
  ["/privacidade", privacidadeMetadata],
  ["/uso-aceitavel", usoAceitavelMetadata],
];

describe("páginas legais — noindex, nofollow explícito (D-09)", () => {
  it.each(LEGAL_METADATA)("%s declara robots NOINDEX_ROBOTS", (_path, metadata) => {
    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
  });
});

describe("layout raiz — default noindex herdado por rotas sem aprovação (D-06)", () => {
  it("rootMetadata.robots é { index: false, follow: false }", () => {
    expect(rootMetadata.robots).toEqual({ index: false, follow: false });
  });
});
