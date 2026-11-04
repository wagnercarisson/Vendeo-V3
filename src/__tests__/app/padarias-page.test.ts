// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Metadata } from "next";
import {
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  PADARIAS_CANONICAL_PATH,
} from "@/lib/seo/indexation-policy";
import {
  PUBLIC_ACCESS_COPY,
  PUBLIC_OFFER_COPY,
} from "@/components/landing/public-offer-copy";

/**
 * Página pública `/padarias`.
 *
 * `metadata` é computado no carregamento do módulo (`indexable =
 * isIndexableEnvironment()` roda no import), então cada cenário reimporta o
 * módulo com `vi.resetModules()` + import dinâmico após `vi.stubEnv(...)`.
 *
 * Cobre copy aprovada, kit em HTML, aviso único, imagens responsivas, CTAs nos
 * dois estados da flag, card único, acessibilidade estrutural e a matriz de
 * metadata/canonical por ambiente.
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
  return import("@/app/(marketing)/padarias/page");
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

const H1 =
  "Transforme os produtos da sua padaria em campanhas prontas para divulgar.";
const OPENING =
  "O Vendeo é o aplicativo que cria artes e textos para divulgar os produtos da sua padaria nas redes sociais. Envie uma foto, conte o que quer destacar e receba uma campanha com a identidade da sua loja — sem precisar saber design.";
const KIT_TITLE = "Além da arte, o texto para acompanhar sua publicação.";
const KIT_HEADLINE = "Bolo Naked Fruit: um destaque à mesa";
const KIT_LEGEND =
  "Conheça o Bolo Naked Fruit, destaque da vitrine da Panificadora Dona Maria. Com uma apresentação que valoriza cada detalhe, é uma escolha especial para compartilhar bons momentos em família. Qualidade da nossa família para a sua!";
const KIT_HASHTAGS =
  "#BoloNakedFruit #Confeitaria #DestaqueDaVitrine #PanificadoraDonaMaria";
const KIT_CALL = "Venha conhecer na loja!";
const NOTICE =
  "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas";

describe("metadata de /padarias — indexação e canonical por ambiente", () => {
  it("produção + origem canônica → index, follow e canonical absoluto", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(INDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBe(
      `${CANONICAL}${PADARIAS_CANONICAL_PATH}`,
    );
    expect(metadata.openGraph?.url).toBe(PADARIAS_CANONICAL_PATH);
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
      "Crie posts e campanhas para padarias com IA | Vendeo",
    );
    expect(metadata.description).toBe(
      "Transforme fotos e informações dos produtos da sua padaria em artes e textos prontos para divulgar nas redes sociais. Sem precisar saber design.",
    );
  });

  it("metadata não incorpora preço demonstrativo nem dados de loja fictícia", async () => {
    const { metadata } = await loadPage();
    const serialized = JSON.stringify(metadata);

    expect(serialized).not.toMatch(/R\$/);
    expect(serialized).not.toContain("Panificadora Dona Maria");
    expect(serialized).not.toContain("Bakery");
    expect(serialized).not.toContain("LocalBusiness");
  });
});

describe("render de /padarias — copy aprovada e composição", () => {
  async function render(): Promise<string> {
    const { default: PadariasPage } = await loadPage();
    const element = await PadariasPage();
    return renderToStaticMarkup(element);
  }

  it("usa o H1 aprovado e um único h1", async () => {
    const html = await render();

    expect(html).toContain(H1);
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("identifica o Vendeo como aplicativo e apresenta a abertura aprovada", async () => {
    const html = await render();

    expect(html).toContain(OPENING);
    expect(html).toContain(
      "Da foto do bolo à campanha pronta para publicar.",
    );
    expect(html).toContain("Foto enviada ao Vendeo");
    expect(html).toContain("Campanha criada com o Vendeo");
    expect(html).toContain(
      "Uma foto do bolo, o nome da Panificadora Dona Maria e as informações",
    );
  });

  it("exibe o kit de publicação exatamente uma vez, em HTML e sem Copiar", async () => {
    const html = await render();

    expect(html).toContain(KIT_TITLE);
    expect(html).toContain(KIT_HEADLINE);
    expect(html).toContain(KIT_LEGEND);
    expect(html).toContain(KIT_HASHTAGS);
    expect(html).toContain(KIT_CALL);
    expect(html.split(KIT_HEADLINE)).toHaveLength(2);
    expect(html.split(KIT_LEGEND)).toHaveLength(2);
    expect(html.split(KIT_HASHTAGS)).toHaveLength(2);
    expect(html.split(KIT_CALL)).toHaveLength(2);
    expect(html).not.toContain("Copiar");
    expect(html).not.toContain("<table");
  });

  it("apresenta as três situações comerciais de padaria", async () => {
    const html = await render();

    expect(html).toContain("Crie posts para sua padaria sem começar do zero.");
    expect(html).toContain("Novidades da vitrine.");
    expect(html).toContain("Fornadas do dia.");
    expect(html).toContain("Bolos e encomendas.");
    expect(html).toContain(
      "Apresente um bolo, um doce ou um produto novo que chegou para vender no balcão.",
    );
    expect(html).toContain(
      "Divulgue as opções de bolo e as informações que o cliente precisa para fazer a encomenda.",
    );
  });

  it("exibe o exemplo complementar do pão com texto antes da imagem", async () => {
    const html = await render();
    const heading = html.indexOf("Saiu uma fornada? Prepare a divulgação.");
    const text = html.indexOf(
      "Mostre os pães que acabaram de sair, destaque os produtos disponíveis no dia e convide seus clientes para passar na padaria.",
    );
    const image = html.indexOf(
      "/padarias/campanha-pao-frances-fresquinho-dona-maria-1024w.webp",
    );

    expect(heading).toBeGreaterThan(-1);
    expect(text).toBeGreaterThan(heading);
    expect(image).toBeGreaterThan(text);
  });

  it("mantém o aviso demonstrativo único após o conjunto de exemplos", async () => {
    const html = await render();
    const noticeIndex = html.indexOf(NOTICE);

    expect(html.split(NOTICE)).toHaveLength(2);
    expect(noticeIndex).toBeGreaterThan(
      html.indexOf("/padarias/campanha-bolo-naked-fruit-dona-maria-1024w.webp"),
    );
    expect(noticeIndex).toBeGreaterThan(
      html.indexOf("/padarias/campanha-pao-frances-fresquinho-dona-maria-1024w.webp"),
    );
    expect(noticeIndex).toBeLessThan(html.indexOf('id="chamada-heading"'));
  });

  it("exibe o encerramento aprovado", async () => {
    const html = await render();

    expect(html).toContain(
      "Como ficaria uma campanha com os produtos da sua padaria?",
    );
    expect(html).toContain(
      "Sua padaria, sua marca, uma campanha pronta para divulgar.",
    );
  });

  it("não promete agendamento, automação, anúncios, alcance ou vendas", async () => {
    const html = await render();

    expect(html).not.toMatch(/agendamento|agende seus posts/i);
    expect(html).not.toMatch(/publicação automática|publique automaticamente/i);
    expect(html).not.toMatch(/anúncio|tráfego pago|impulsione/i);
    expect(html).not.toMatch(/aumente suas vendas|mais alcance|mais clientes/i);
    expect(html).not.toMatch(/agência/i);
  });

  it("não exibe preço, avaliação ou dados de loja real", async () => {
    const html = await render();

    expect(html).not.toMatch(/R\$/);
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("Bakery");
    expect(html).not.toContain("LocalBusiness");
    expect(html).not.toContain("AggregateRating");
  });
});

describe("imagens de /padarias", () => {
  async function render(): Promise<string> {
    const { default: PadariasPage } = await loadPage();
    const element = await PadariasPage();
    return renderToStaticMarkup(element);
  }

  it("entrega as três imagens em duas variantes WebP com srcset e sizes", async () => {
    const html = await render();

    expect(html).toContain(
      'src="/padarias/foto-bolo-naked-fruit-1024w.webp"',
    );
    expect(html).toContain(
      "/padarias/foto-bolo-naked-fruit-480w.webp 480w",
    );
    expect(html).toContain(
      'src="/padarias/campanha-bolo-naked-fruit-dona-maria-1024w.webp"',
    );
    expect(html).toContain(
      "/padarias/campanha-bolo-naked-fruit-dona-maria-480w.webp 480w",
    );
    expect(html).toContain(
      'src="/padarias/campanha-pao-frances-fresquinho-dona-maria-1024w.webp"',
    );
    expect(html).toContain(
      "/padarias/campanha-pao-frances-fresquinho-dona-maria-480w.webp 480w",
    );
    expect(html).toContain("(min-width: 1024px) 452px");
    expect(html).toContain("(min-width: 1024px) 468px");
  });

  it("declara dimensões explícitas e não recorta a campanha do bolo", async () => {
    const html = await render();
    const cakeTag =
      html.match(/<img[^>]*campanha-bolo-naked-fruit[^>]*>/)?.[0] ?? "";

    expect(cakeTag).toContain('width="1024"');
    expect(cakeTag).toContain('height="1024"');
    expect(cakeTag).toContain("object-contain");
    expect(cakeTag).not.toContain("object-cover");

    const photoTag =
      html.match(/<img[^>]*foto-bolo-naked-fruit[^>]*>/)?.[0] ?? "";
    expect(photoTag).toContain('width="1024"');
    expect(photoTag).toContain('height="1024"');
  });

  it("mantém a demonstração sem lazy e o pão com lazy", async () => {
    const html = await render();
    const photoTag =
      html.match(/<img[^>]*foto-bolo-naked-fruit[^>]*>/)?.[0] ?? "";
    const cakeTag =
      html.match(/<img[^>]*campanha-bolo-naked-fruit[^>]*>/)?.[0] ?? "";
    const breadTag =
      html.match(/<img[^>]*campanha-pao-frances[^>]*>/)?.[0] ?? "";

    expect(photoTag).not.toContain('loading="lazy"');
    expect(cakeTag).not.toContain('loading="lazy"');
    expect(breadTag).toContain('loading="lazy"');
    expect(breadTag).toContain('decoding="async"');
    expect(breadTag).toContain('width="1024"');
    expect(breadTag).toContain('height="1024"');
    expect(html).not.toMatch(/fetchpriority="high"/i);
    expect(html).not.toContain("/api/");
  });
});

describe("CTAs, oferta e flags de /padarias", () => {
  async function render(): Promise<string> {
    const { default: PadariasPage } = await loadPage();
    const element = await PadariasPage();
    return renderToStaticMarkup(element);
  }

  it("flag desligada: abertura local e ações reais somente no card final", async () => {
    const html = await render();

    expect(html.match(/data-access-cta-group/g) ?? []).toHaveLength(2);
    expect(html.match(/data-access-mode="anchor"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-access-mode="real"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-public-signup-enabled="false"/g) ?? []).toHaveLength(
      2,
    );
    expect(html.match(/data-local-access="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="#padarias-oferta"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="\/#acesso"/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/href="\/signup"/);
    expect(html.match(/href="\/"[^>]*>Conheça o Vendeo</g) ?? []).toHaveLength(2);
  });

  it("flag ligada: abertura local e Google/e-mail reais no card final", async () => {
    flag.publicSignupEnabled = true;
    const html = await render();

    expect(html).not.toContain(PUBLIC_ACCESS_COPY.closedCta);
    expect(html).not.toContain(PUBLIC_ACCESS_COPY.closedSupport);
    expect(html).not.toContain(PUBLIC_OFFER_COPY.closedDetailsNote);
    expect(html.match(new RegExp(PUBLIC_ACCESS_COPY.email, "g")) ?? []).toHaveLength(
      2,
    );
    expect(html.match(/href="\/signup"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-local-access="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="#padarias-oferta"/g) ?? []).toHaveLength(2);
    expect(html.match(/id="padarias-oferta"/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/href="\/#acesso"/);
  });

  it("renderiza um único card de oferta, no encerramento, com ID estável", async () => {
    const html = await render();

    expect(html.match(/data-offer-card="compact"/g) ?? []).toHaveLength(1);
    expect(html.split(PUBLIC_OFFER_COPY.summary)).toHaveLength(2);
    expect(html.split(PUBLIC_OFFER_COPY.complement)).toHaveLength(2);
    expect(html.split(PUBLIC_OFFER_COPY.detailsLabel)).toHaveLength(2);
    expect(html.split(PUBLIC_ACCESS_COPY.closedSupport)).toHaveLength(2);
    expect(html.split(PUBLIC_OFFER_COPY.closedDetailsNote)).toHaveLength(2);
    expect(html.match(/id="padarias-oferta"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/id="padarias-oferta"[^>]*tabindex="-1"/);
    expect(html).toContain("scroll-mt-24");
  });

  it("não produz IDs duplicados", async () => {
    const html = await render();
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("acessibilidade estrutural de /padarias", () => {
  async function render(): Promise<string> {
    const { default: PadariasPage } = await loadPage();
    const element = await PadariasPage();
    return renderToStaticMarkup(element);
  }

  it("usa landmarks, um único h1 e hierarquia coerente", async () => {
    const html = await render();

    expect(html.match(/<header/g) ?? []).toHaveLength(1);
    expect(html.match(/<main/g) ?? []).toHaveLength(1);
    expect(html.match(/<footer/g) ?? []).toHaveLength(1);
    expect(html.match(/<h1/g) ?? []).toHaveLength(1);
    expect(html.match(/<h2/g) ?? []).toHaveLength(5);
    expect(html.match(/<h3/g) ?? []).toHaveLength(3);
  });

  it("preenche todos os alt e oculta a seta decorativa", async () => {
    const html = await render();
    const images = html.match(/<img[^>]*>/g) ?? [];

    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toMatch(/alt="[^"]+"/);
    }
    expect(html).toContain('aria-hidden="true"');
  });

  it("usa semântica de lista no kit e details/summary na oferta", async () => {
    const html = await render();

    expect(html.match(/<dl/g) ?? []).toHaveLength(1);
    expect(html.match(/<dt/g) ?? []).toHaveLength(4);
    expect(html.match(/<dd/g) ?? []).toHaveLength(4);
    expect(html.match(/<details/g) ?? []).toHaveLength(1);
    expect(html.match(/<summary/g) ?? []).toHaveLength(1);
  });

  it("mantém foco visível e áreas de toque mínimas", async () => {
    const html = await render();

    expect(html).toContain("focus:ring-2");
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("h-12");
  });
});

describe("metadata type contract", () => {
  it("exporta metadata compatível com Metadata do Next", async () => {
    const { metadata } = await loadPage();
    const typed: Metadata = metadata;
    expect(typed).toBeDefined();
  });
});
