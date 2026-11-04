// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Metadata } from "next";
import {
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  FLORICULTURAS_CANONICAL_PATH,
} from "@/lib/seo/indexation-policy";
import {
  PUBLIC_ACCESS_COPY,
  PUBLIC_OFFER_COPY,
} from "@/components/landing/public-offer-copy";

/**
 * Página pública `/floriculturas`.
 *
 * `metadata` é computado no carregamento do módulo (`indexable =
 * isIndexableEnvironment()` roda no import), então cada cenário reimporta o
 * módulo com `vi.resetModules()` + import dinâmico após `vi.stubEnv(...)`.
 *
 * Cobre: copy aprovada, dois CTAs com o mesmo fluxo, aviso demonstrativo único,
 * ausência de tabela/legenda de geração, ausência de chamada a API de geração e
 * a matriz de metadata/canonical por ambiente.
 */

const CANONICAL = "https://vendeo.tech";
const PREVIEW_URL = "vendeo-git-x.vercel.app";

const flag = vi.hoisted(() => ({ publicSignupEnabled: false }));

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: vi.fn(async () => ({
    publicSignupEnabled: flag.publicSignupEnabled,
  })),
}));

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => null,
}));

async function loadPage() {
  vi.resetModules();
  return import("@/app/(marketing)/floriculturas/page");
}

function resetEnv(): void {
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("VERCEL_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
}

beforeEach(() => {
  flag.publicSignupEnabled = false;
  vi.resetModules();
  resetEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("metadata de /floriculturas — indexação e canonical por ambiente", () => {
  it("produção + origem canônica → index, follow e canonical absoluto", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(INDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBe(
      `${CANONICAL}${FLORICULTURAS_CANONICAL_PATH}`,
    );
    expect(metadata.openGraph?.url).toBe(FLORICULTURAS_CANONICAL_PATH);
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("preview → noindex e canonical omitido", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", PREVIEW_URL);

    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBeUndefined();
  });

  it("local (VERCEL_ENV ausente) → noindex e canonical omitido", async () => {
    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBeUndefined();
  });

  it("produção + origem www (não canônica) → noindex e canonical omitido", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vendeo.tech");

    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBeUndefined();
  });

  it("produção + origem http → noindex e canonical omitido", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://vendeo.tech");

    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(NOINDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBeUndefined();
  });

  it("title e description aprovados", async () => {
    const { metadata } = await loadPage();

    expect(metadata.title).toBe(
      "Campanhas para floriculturas: crie artes com IA | Vendeo",
    );
    expect(metadata.description).toBe(
      "Transforme fotos de flores e arranjos em campanhas para divulgar sua floricultura nas redes sociais. Arte e texto com sua marca, sem precisar saber design.",
    );
  });
});

describe("render de /floriculturas — copy aprovada e composição", () => {
  async function render(): Promise<string> {
    const { default: FloriculturasPage } = await loadPage();
    const element = await FloriculturasPage();
    return renderToStaticMarkup(element);
  }

  it("usa o H1 aprovado e um único h1", async () => {
    const html = await render();

    expect(html).toContain(
      "A beleza das suas flores merece uma divulgação de qualidade.",
    );
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("renderiza abertura, demonstração, explicação, segundo bloco, funcionamento e encerramento", async () => {
    const html = await render();

    expect(html).toContain(
      "Transforme fotos dos seus produtos em campanhas profissionais para divulgar sua floricultura.",
    );
    expect(html).toContain("Da foto no balcão à campanha pronta para publicar.");
    expect(html).toContain("Foto enviada ao Vendeo");
    expect(html).toContain("Campanha criada com o Vendeo");
    expect(html).toContain("Uma foto da orquídea, o nome da floricultura");
    expect(html).toContain(
      "Crie posts para sua floricultura sem começar do zero.",
    );
    expect(html).toContain(
      "Você conhece seus produtos. O Vendeo ajuda a apresentá-los.",
    );
    expect(html).toContain(
      "Como ficaria uma campanha com os produtos da sua floricultura?",
    );
    expect(html).toContain(
      "Comece com uma foto e as informações do que você quer divulgar.",
    );
  });

  it("exibe os quatro passos aprovados", async () => {
    const html = await render();

    expect(html).toContain("Envie a foto do produto.");
    expect(html).toContain("Conte o que deseja destacar.");
    expect(html).toContain("Gere sua campanha.");
    expect(html).toContain("Revise, baixe e publique.");
  });

  it("mantém dois grupos de acesso, mas somente o card final aponta para /#acesso", async () => {
    const html = await render();

    expect(html.match(/data-access-cta-group/g) ?? []).toHaveLength(2);
    expect(html.match(/data-access-mode="anchor"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-access-mode="real"/g) ?? []).toHaveLength(1);
    expect(
      html.match(/data-public-signup-enabled="false"/g) ?? [],
    ).toHaveLength(2);
    expect(html.match(/href="\/#acesso"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="#floriculturas-oferta"/g) ?? []).toHaveLength(1);
  });

  it("exibe o aviso demonstrativo aprovado uma única vez", async () => {
    const html = await render();
    const notice =
      "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas";

    expect(html.split(notice)).toHaveLength(2);
  });

  it("exibe o texto gerado em HTML, sem captura de interface e sem botões Copiar", async () => {
    const html = await render();

    expect(html).toContain(
      "Além da arte, o texto para acompanhar sua publicação.",
    );
    expect(html).toContain("Orquídea Phalaenopsis: beleza em cada cor");
    expect(html).toContain(
      "Em destaque na Floricultura Donna Flor, a Orquídea Phalaenopsis",
    );
    expect(html).toContain("#OrquídeaPhalaenopsis");
    expect(html).toContain("#Orquídeas");
    expect(html).toContain("#FloresEmDestaque");
    expect(html).toContain("#FloriculturaDonnaFlor");
    expect(html).toContain("Venha conhecer na loja!");
    expect(html).not.toContain("Copiar");
  });

  it("oferece o conjunto de acesso na abertura e no encerramento, com Conheça o Vendeo para a home", async () => {
    const html = await render();

    expect(html.match(/data-access-cta-group/g) ?? []).toHaveLength(2);
    expect(html.match(/href="\/"[^>]*>Conheça o Vendeo</g) ?? []).toHaveLength(2);
    expect(html).not.toMatch(/href="\/#acesso"[^>]*>Conheça o Vendeo</);
  });

  it("renderiza um único card de oferta, no encerramento, com ID estável de âncora", async () => {
    const html = await render();

    expect(html.match(/data-offer-card="compact"/g) ?? []).toHaveLength(1);
    expect(html.split(PUBLIC_OFFER_COPY.summary)).toHaveLength(2);
    expect(html.split(PUBLIC_OFFER_COPY.complement)).toHaveLength(2);
    expect(html.split(PUBLIC_OFFER_COPY.detailsLabel)).toHaveLength(2);
    expect(html.split(PUBLIC_ACCESS_COPY.closedSupport)).toHaveLength(2);
    expect(html.split(PUBLIC_OFFER_COPY.closedDetailsNote)).toHaveLength(2);
    expect(html.match(/id="floriculturas-oferta"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/id="floriculturas-oferta"[^>]*tabindex="-1"/);
    expect(html).toContain("scroll-mt-24");
  });

  it("a abertura usa apenas âncoras locais; as ações reais ficam no card final", async () => {
    const html = await render();

    expect(html.match(/data-local-access="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="#floriculturas-oferta"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="\/#acesso"/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/href="\/signup"/);
  });

  it("não produz IDs duplicados", async () => {
    const html = await render();
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("flag ligada: abertura local e ações reais somente no card final", async () => {
    flag.publicSignupEnabled = true;
    const html = await render();

    expect(html).not.toContain(PUBLIC_ACCESS_COPY.closedCta);
    expect(html).not.toContain(PUBLIC_ACCESS_COPY.closedSupport);
    expect(html).not.toContain(PUBLIC_OFFER_COPY.closedDetailsNote);
    expect(html.match(new RegExp(PUBLIC_ACCESS_COPY.email, "g")) ?? []).toHaveLength(2);
    expect(html.match(/href="\/signup"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-local-access="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="#floriculturas-oferta"/g) ?? []).toHaveLength(2);
    expect(html.match(/id="floriculturas-oferta"/g) ?? []).toHaveLength(1);
  });

  it("não exibe tabela de entrada nem dados de geração não aprovados", async () => {
    const html = await render();

    expect(html).not.toContain("<table");
    expect(html).not.toContain("Foto enviada</figcaption>");
    expect(html).not.toContain("Dados informados");
    expect(html).not.toContain("R$");
  });

  it("não invoca API de geração", async () => {
    const html = await render();

    expect(html).not.toContain("/api/");
  });

  it("mantém as imagens da demonstração sem lazy-loading", async () => {
    const { DemonstrationPair } = await import(
      "@/components/landing/floriculturas/demonstration-pair"
    );
    const html = renderToStaticMarkup(DemonstrationPair());

    expect(html).toContain('src="/floriculturas/foto-orquidea-balcao-1024w.webp"');
    expect(html).toContain(
      'src="/floriculturas/campanha-donna-flor-1024w.webp"',
    );
    expect(html).not.toContain('loading="lazy"');
    // LCP medido no navegador foi o H1 (não a campanha); nenhuma imagem recebe
    // prioridade alta para não competir com o texto.
    expect(html).not.toMatch(/fetchpriority="high"/i);
  });
});

describe("metadata type contract", () => {
  it("exporta metadata compatível com Metadata do Next", async () => {
    const { metadata } = await loadPage();
    const typed: Metadata = metadata;
    expect(typed).toBeDefined();
  });
});
