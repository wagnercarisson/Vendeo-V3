// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Metadata } from "next";
import {
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  OFERTAS_PARA_MERCADOS_CANONICAL_PATH,
} from "@/lib/seo/indexation-policy";
import {
  PUBLIC_ACCESS_COPY,
  PUBLIC_OFFER_COPY,
} from "@/components/landing/public-offer-copy";

/**
 * Página pública `/ofertas-para-mercados`.
 *
 * `metadata` é computado no carregamento do módulo (`indexable =
 * isIndexableEnvironment()` roda no import), então cada cenário reimporta o
 * módulo com `vi.resetModules()` + import dinâmico após `vi.stubEnv(...)`.
 *
 * Cobre copy aprovada com a explicação consolidada, kit em HTML, aviso único,
 * imagens responsivas, CTAs nos dois estados da flag, card único, acessibilidade
 * estrutural e a matriz de metadata/canonical por ambiente.
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
  return import("@/app/(marketing)/ofertas-para-mercados/page");
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

const H1 = "Sua oferta merece chamar atenção. Sem complicar sua rotina.";
const OPENING =
  "O Vendeo é o aplicativo que cria artes e textos para divulgar as ofertas do seu mercado, mercearia ou minimercado nas redes sociais. Envie a foto do produto, informe o preço e o que quer destacar, e receba uma campanha com a identidade do seu estabelecimento — sem precisar saber design.";
const DEMO_HEADING = "Da foto do produto à campanha pronta para divulgar.";
const EXPLANATION_HEADING = "Uma oferta clara, com a identidade da sua loja.";
const EXPLANATION =
  "Você informa o produto, o preço anterior, o preço promocional e o período de validade da oferta. O Vendeo organiza essas informações em uma campanha com o produto em destaque e a identidade da sua loja.";
const KIT_TITLE = "Além da arte, o texto para acompanhar a publicação.";
const KIT_HEADLINE = "Coxão Mole Bovino por R$ 39,90/kg";
const KIT_LEGEND =
  "Vai preparar uma refeição caprichada? Aproveite o Coxão Mole Bovino por R$ 39,90 o kg, antes R$ 45,90! Um preço especial pra deixar o almoço ainda mais gostoso. Venha conferir na Mercearia Tio João!";
const KIT_HASHTAGS = "#CoxaoMole #Mercearia #OfertaDoDia #MerceariaTioJoao";
const KIT_CALL = "Confira essa oferta na loja!";
const COFFEE_HEADING = "Outra categoria, a mesma identidade.";
const COFFEE_TEXT =
  "A Mercearia Tio João também divulga o café da loja com o mesmo padrão de campanha: produto em destaque, preço legível e a marca do estabelecimento preservada.";
const NOTICE =
  "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas. As marcas de produtos pertencem aos respectivos titulares. O Vendeo não possui vínculo, parceria, patrocínio ou endosso das marcas ou dos fabricantes utilizados para ilustrar as campanhas.";

describe("metadata de /ofertas-para-mercados — indexação e canonical por ambiente", () => {
  it("produção + origem canônica → index, follow e canonical absoluto", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(INDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBe(
      `${CANONICAL}${OFERTAS_PARA_MERCADOS_CANONICAL_PATH}`,
    );
    expect(metadata.openGraph?.url).toBe(OFERTAS_PARA_MERCADOS_CANONICAL_PATH);
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
      "Crie artes de ofertas para mercados e mercearias | Vendeo",
    );
    expect(metadata.description).toBe(
      "Crie artes e textos para divulgar as ofertas do seu mercado, mercearia ou minimercado nas redes sociais. Com a identidade do seu estabelecimento.",
    );
  });

  it("metadata não incorpora preço, produto, marca fictícia ou dado estruturado", async () => {
    const { metadata } = await loadPage();
    const serialized = JSON.stringify(metadata);

    expect(serialized).not.toMatch(/R\$/);
    expect(serialized).not.toContain("Mercearia Tio João");
    expect(serialized).not.toContain("Melitta");
    expect(serialized).not.toContain("GroceryStore");
    expect(serialized).not.toContain("Butcher");
    expect(serialized).not.toContain("LocalBusiness");
  });
});

describe("render de /ofertas-para-mercados — copy aprovada e composição", () => {
  async function render(): Promise<string> {
    const { default: Page } = await loadPage();
    const element = await Page();
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
    expect(html).toContain(DEMO_HEADING);
    expect(html).toContain("Foto do produto");
    expect(html).toContain("Campanha criada com o Vendeo");
  });

  it("mantém o rótulo da foto junto da imagem e o da campanha no topo", async () => {
    const html = await render();
    const photoFigureStart = html.indexOf(
      '<figure aria-labelledby="mercados-foto-label"',
    );
    const photoFigureEnd = html.indexOf("</figure>", photoFigureStart);
    const photoFigure = html.slice(photoFigureStart, photoFigureEnd);

    expect(photoFigureStart).toBeGreaterThan(-1);
    expect(photoFigure).toContain("Foto do produto");
    expect(photoFigure.indexOf("Foto do produto")).toBeLessThan(
      photoFigure.indexOf("<img"),
    );

    const campaignLabel = html.indexOf("Campanha criada com o Vendeo");
    const campaignImage = html.indexOf(
      "/mercados/campanha-coxao-mole-tio-joao-1024w.webp",
      campaignLabel,
    );
    expect(campaignLabel).toBeGreaterThan(-1);
    expect(campaignImage).toBeGreaterThan(campaignLabel);
  });

  it("não repete a explicação sob a demonstração", async () => {
    const html = await render();

    expect(html).not.toContain(
      "Uma foto do coxão mole no açougue, o nome da Mercearia Tio João",
    );
    expect(html.split(EXPLANATION)).toHaveLength(2);
    expect(html.split(EXPLANATION_HEADING)).toHaveLength(2);
  });

  it("explica produto, preços, validade e marca em um único parágrafo após o par", async () => {
    const html = await render();
    const pairImage = html.indexOf(
      "/mercados/campanha-coxao-mole-tio-joao-1024w.webp",
    );
    const explanation = html.indexOf(EXPLANATION);
    const kit = html.indexOf(KIT_TITLE);

    expect(pairImage).toBeGreaterThan(-1);
    expect(explanation).toBeGreaterThan(pairImage);
    expect(kit).toBeGreaterThan(explanation);
    expect(EXPLANATION).toContain("validade da oferta");
    expect(EXPLANATION).not.toContain("validade da campanha");
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

  it("exibe o exemplo complementar do café com texto antes da imagem", async () => {
    const html = await render();
    const heading = html.indexOf(COFFEE_HEADING);
    const text = html.indexOf(COFFEE_TEXT);
    const image = html.indexOf("/landing/hero-oferta-cafe.webp");

    expect(heading).toBeGreaterThan(-1);
    expect(text).toBeGreaterThan(heading);
    expect(image).toBeGreaterThan(text);
  });

  it("mantém o aviso demonstrativo único após o conjunto de exemplos", async () => {
    const html = await render();
    const noticeIndex = html.indexOf(NOTICE);

    expect(html.split(NOTICE)).toHaveLength(2);
    expect(noticeIndex).toBeGreaterThan(
      html.indexOf("/mercados/campanha-coxao-mole-tio-joao-1024w.webp"),
    );
    expect(noticeIndex).toBeGreaterThan(
      html.indexOf("/landing/hero-oferta-cafe.webp"),
    );
    expect(noticeIndex).toBeLessThan(html.indexOf('id="chamada-heading"'));
    expect(html).toContain("Melitta");
  });

  it("exibe o encerramento aprovado", async () => {
    const html = await render();

    expect(html).toContain(
      "Como ficaria uma campanha com a oferta da sua loja?",
    );
    expect(html).toContain(
      "Sua oferta, sua marca, uma campanha pronta para revisar e publicar.",
    );
  });

  it("não promete automação, anúncios, posicionamento, alcance ou vendas", async () => {
    const html = await render();

    expect(html).not.toMatch(/agendamento|agende seus posts/i);
    expect(html).not.toMatch(/publicação automática|publique automaticamente/i);
    expect(html).not.toMatch(/anúncio|tráfego pago|impulsione|gestor de tráfego/i);
    expect(html).not.toMatch(/aumente suas vendas|mais alcance|mais clientes/i);
    expect(html).not.toMatch(/posicionamento no google|posição no google/i);
    expect(html).not.toMatch(/conversão garantida|vendas garantidas/i);
  });

  it("não usa expressões proibidas nem afirma captura por celular", async () => {
    const html = await render();

    expect(html).not.toMatch(/loja pequena/i);
    expect(html).not.toMatch(/começar do zero/i);
    expect(html).not.toMatch(/tela em branco/i);
    expect(html).not.toMatch(/ofertas agressivas/i);
    expect(html).not.toMatch(/celular/i);
    expect(html).not.toMatch(/capturada por celular|foto tirada com celular/i);
  });

  it("não exibe dados estruturados de loja, produto, oferta ou avaliação", async () => {
    const html = await render();

    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("GroceryStore");
    expect(html).not.toContain("Butcher");
    expect(html).not.toContain("LocalBusiness");
    expect(html).not.toContain("AggregateRating");
  });
});

describe("imagens de /ofertas-para-mercados", () => {
  async function render(): Promise<string> {
    const { default: Page } = await loadPage();
    const element = await Page();
    return renderToStaticMarkup(element);
  }

  it("entrega as imagens em duas variantes WebP com srcset e sizes", async () => {
    const html = await render();

    expect(html).toContain(
      'src="/mercados/foto-coxao-mole-acougue-1024w.webp"',
    );
    expect(html).toContain(
      "/mercados/foto-coxao-mole-acougue-480w.webp 480w",
    );
    expect(html).toContain(
      'src="/mercados/campanha-coxao-mole-tio-joao-1024w.webp"',
    );
    expect(html).toContain(
      "/mercados/campanha-coxao-mole-tio-joao-480w.webp 480w",
    );
    expect(html).toContain('src="/landing/hero-oferta-cafe.webp"');
    expect(html).toContain(
      "/landing/variants/hero-oferta-cafe-480w.webp 480w",
    );
    expect(html).toContain("(min-width: 1024px) 360px");
    expect(html).toContain("(min-width: 1024px) 480px");
    expect(html).toContain("(min-width: 1024px) 468px");
    expect(html).toContain(
      "md:grid-cols-[minmax(0,3fr)_auto_minmax(0,4fr)]",
    );
    expect(html).toContain(
      "lg:grid-cols-[minmax(0,360px)_auto_minmax(0,480px)]",
    );
    expect(html).toContain("md:max-w-[360px]");
    expect(html).toContain("md:max-w-[480px]");
    expect(html).toContain("text-balance");
    expect(html).toContain("text-pretty");
  });

  it("declara dimensões explícitas e não recorta foto nem campanha", async () => {
    const html = await render();
    const photoTag =
      html.match(/<img[^>]*foto-coxao-mole-acougue[^>]*>/)?.[0] ?? "";
    const campaignTag =
      html.match(/<img[^>]*campanha-coxao-mole-tio-joao[^>]*>/)?.[0] ?? "";
    const coffeeTag =
      html.match(/<img[^>]*hero-oferta-cafe[^>]*>/)?.[0] ?? "";

    expect(photoTag).toContain('width="1024"');
    expect(photoTag).toContain('height="683"');
    expect(photoTag).toContain("object-contain");
    expect(photoTag).not.toContain("object-cover");

    expect(campaignTag).toContain('width="1024"');
    expect(campaignTag).toContain('height="1024"');
    expect(campaignTag).toContain("object-contain");
    expect(campaignTag).not.toContain("object-cover");

    expect(coffeeTag).toContain('width="1024"');
    expect(coffeeTag).toContain('height="1024"');
    expect(coffeeTag).toContain("object-contain");
    expect(coffeeTag).not.toContain("object-cover");
  });

  it("mantém a demonstração sem lazy e o café com lazy", async () => {
    const html = await render();
    const photoTag =
      html.match(/<img[^>]*foto-coxao-mole-acougue[^>]*>/)?.[0] ?? "";
    const campaignTag =
      html.match(/<img[^>]*campanha-coxao-mole-tio-joao[^>]*>/)?.[0] ?? "";
    const coffeeTag =
      html.match(/<img[^>]*hero-oferta-cafe[^>]*>/)?.[0] ?? "";

    expect(photoTag).not.toContain('loading="lazy"');
    expect(campaignTag).not.toContain('loading="lazy"');
    expect(coffeeTag).toContain('loading="lazy"');
    expect(coffeeTag).toContain('decoding="async"');
    expect(html).not.toMatch(/fetchpriority="high"/i);
    expect(html).not.toContain("/api/");
  });
});

describe("CTAs, oferta e flags de /ofertas-para-mercados", () => {
  async function render(): Promise<string> {
    const { default: Page } = await loadPage();
    const element = await Page();
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
    expect(html.match(/href="#ofertas-mercados-oferta"/g) ?? []).toHaveLength(1);
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
    expect(html.match(/href="#ofertas-mercados-oferta"/g) ?? []).toHaveLength(2);
    expect(html.match(/id="ofertas-mercados-oferta"/g) ?? []).toHaveLength(1);
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
    expect(html.match(/id="ofertas-mercados-oferta"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/id="ofertas-mercados-oferta"[^>]*tabindex="-1"/);
    expect(html).toContain("scroll-mt-24");
  });

  it("não produz IDs duplicados", async () => {
    const html = await render();
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("acessibilidade estrutural de /ofertas-para-mercados", () => {
  async function render(): Promise<string> {
    const { default: Page } = await loadPage();
    const element = await Page();
    return renderToStaticMarkup(element);
  }

  it("usa landmarks, um único h1 e hierarquia coerente", async () => {
    const html = await render();

    expect(html.match(/<header/g) ?? []).toHaveLength(1);
    expect(html.match(/<main/g) ?? []).toHaveLength(1);
    expect(html.match(/<footer/g) ?? []).toHaveLength(1);
    expect(html.match(/<h1/g) ?? []).toHaveLength(1);
    expect(html.match(/<h2/g) ?? []).toHaveLength(5);
    expect(html.match(/<h3/g) ?? []).toHaveLength(0);
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

  it("renderiza o rodapé compartilhado com o destino atual marcado", async () => {
    const html = await render();

    expect(html).toContain("Explore o Vendeo");
    expect(html).toContain("Institucional");
    expect(html).toContain('href="/floriculturas"');
    expect(html).toContain('href="/padarias"');
    expect(html).toContain('href="/campanhas-para-sua-loja"');
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*href="\/ofertas-para-mercados"/,
    );
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    for (const href of ["/", "/termos", "/privacidade", "/uso-aceitavel", "/login"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});

describe("metadata type contract", () => {
  it("exporta metadata compatível com Metadata do Next", async () => {
    const { metadata } = await loadPage();
    const typed: Metadata = metadata;
    expect(typed).toBeDefined();
  });
});
