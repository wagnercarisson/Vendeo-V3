// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Metadata } from "next";
import {
  CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
} from "@/lib/seo/indexation-policy";
import {
  PUBLIC_ACCESS_COPY,
  PUBLIC_OFFER_COPY,
} from "@/components/landing/public-offer-copy";

/**
 * Página pública `/campanhas-para-sua-loja`.
 *
 * `metadata` é computado no carregamento do módulo, então cada cenário reimporta
 * o módulo com `vi.resetModules()` + import dinâmico após `vi.stubEnv(...)`.
 *
 * Cobre copy aprovada, os dois casos, frase-alinhada única, kit em HTML, aviso
 * único, bloco de rotina, imagens responsivas, CTAs nos dois estados da flag,
 * card único, acessibilidade estrutural e a matriz de metadata/canonical.
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
  return import("@/app/(marketing)/campanhas-para-sua-loja/page");
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
  "Sua loja não precisa de mais uma tarefa. Precisa de uma campanha pronta.";
const OPENING =
  "O Vendeo é o aplicativo que transforma a foto de um produto e poucas informações em uma campanha com arte, texto e a identidade da sua loja. Depois de configurar sua loja, envie a foto e conte o que quer divulgar. Em poucos minutos, receba uma campanha para revisar, baixar e publicar.";
const SUPPORT =
  "Sem precisar saber design ou aprender um editor complicado.";
const RATION_DESCRIPTION =
  "Com a foto da ração, o nome do produto e as informações da oferta, o Vendeo criou uma campanha com a marca do Pet Shop Bicho Fofo.";
const BED_DESCRIPTION =
  "Agora a cama, para uma publicação vertical. Outro produto, apresentado em 9:16, com a identidade da mesma loja.";
const IDENTITY_LINE =
  "Produtos diferentes. Formatos diferentes. A mesma identidade da sua loja.";
const KIT_TITLE = "Além da arte, o texto para acompanhar a publicação.";
const KIT_HEADLINE = "Cama Pet Comfort: aconchego para seu pet";
const KIT_LEGEND =
  "Um destaque cheio de carinho na vitrine do Pet Shop Bicho Fofo: a Cama Pet Comfort é macia e confortável, perfeita para dar ao seu companheiro um cantinho especial de descanso. Seu pet merece esse mimo! 🐾";
const KIT_HASHTAGS =
  "#CamaPetComfort #ConfortoPet #Petshop #DestaquePet #BichoFofo";
const KIT_CALL = "Venha conhecer na loja!";
const NOTICE =
  "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas";
const CLOSING_TITLE =
  "Sua próxima campanha pode ser mais simples com o Vendeo.";
const CLOSING_SUPPORT =
  "Uma foto, poucas informações e a identidade da sua loja. Em poucos minutos, você recebe a arte e o texto para revisar e publicar.";

describe("metadata de /campanhas-para-sua-loja — indexação e canonical por ambiente", () => {
  it("produção + origem canônica → index, follow e canonical absoluto", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", CANONICAL);

    const { metadata } = await loadPage();

    expect(metadata.robots).toEqual(INDEX_ROBOTS);
    expect(metadata.alternates?.canonical).toBe(
      `${CANONICAL}${CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH}`,
    );
    expect(metadata.openGraph?.url).toBe(
      CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH,
    );
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
      "Crie campanhas para sua loja sem complicação | Vendeo",
    );
    expect(metadata.description).toBe(
      "Com o Vendeo, a foto de um produto e poucas informações viram arte e texto com a identidade da sua loja. Sem precisar saber design.",
    );
  });

  it("metadata não incorpora preço demonstrativo nem dados de loja fictícia", async () => {
    const { metadata } = await loadPage();
    const serialized = JSON.stringify(metadata);

    expect(serialized).not.toMatch(/R\$/);
    expect(serialized).not.toContain("Pet Shop Bicho Fofo");
    expect(serialized).not.toContain("PetStore");
    expect(serialized).not.toContain("LocalBusiness");
  });
});

describe("render de /campanhas-para-sua-loja — copy aprovada e composição", () => {
  async function render(): Promise<string> {
    const { default: CampanhasPage } = await loadPage();
    const element = await CampanhasPage();
    return renderToStaticMarkup(element);
  }

  it("usa o H1 aprovado e um único h1", async () => {
    const html = await render();

    expect(html).toContain(H1);
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("apresenta a abertura e a linha de apoio aprovadas", async () => {
    const html = await render();

    expect(html).toContain(OPENING);
    expect(html).toContain(SUPPORT);
    expect(html).toContain("Em poucos minutos");
  });

  it("mantém os dois casos separados, com os parágrafos aprovados", async () => {
    const html = await render();

    expect(html).toContain("Uma foto do produto. Uma campanha quadrada.");
    expect(html).toContain("Outro produto. Outro formato. A mesma identidade.");
    expect(html).toContain(RATION_DESCRIPTION);
    expect(html).toContain(BED_DESCRIPTION);
    expect(html.match(/Foto enviada/g) ?? []).toHaveLength(2);
    expect(html.match(/Campanha criada com o Vendeo/g) ?? []).toHaveLength(2);
    expect(html).toContain(">1:1<");
    expect(html).toContain(">9:16<");
  });

  it("exibe a frase-alinhada uma única vez", async () => {
    const html = await render();

    expect(html.split(IDENTITY_LINE)).toHaveLength(2);
  });

  it("exibe o kit da cama exatamente uma vez, em HTML e sem Copiar", async () => {
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

  it("exibe o aviso único após o kit e antes da rotina", async () => {
    const html = await render();
    const noticeIndex = html.indexOf(NOTICE);

    expect(html.split(NOTICE)).toHaveLength(2);
    expect(noticeIndex).toBeGreaterThan(html.indexOf(KIT_CALL));
    expect(noticeIndex).toBeLessThan(html.indexOf("rotina-heading"));
  });

  it("exibe o bloco de rotina com os quatro itens aprovados", async () => {
    const html = await render();

    expect(html).toContain(
      "Feita para a rotina de quem atende, repõe e ainda divulga.",
    );
    expect(html).toContain("A foto pode ser a do celular.");
    expect(html).toContain("Poucas informações bastam.");
    expect(html).toContain("Arte e texto preparados pelo Vendeo.");
    expect(html).toContain(
      "Você informa o que quer divulgar, e o aplicativo compõe a campanha com a identidade da sua loja.",
    );
    expect(html).toContain("Você revisa antes de publicar.");
    expect(html).not.toMatch(/começar do zero|tela em branco/i);
  });

  it("exibe o encerramento aprovado, sem 'Por que pagar por isso?'", async () => {
    const html = await render();

    expect(html).toContain(CLOSING_TITLE);
    expect(html).toContain(CLOSING_SUPPORT);
    expect(html).not.toContain("Por que pagar por isso?");
  });

  it("não promete agendamento, automação, anúncios, alcance ou vendas", async () => {
    const html = await render();

    expect(html).not.toMatch(/agendamento|agende seus posts/i);
    expect(html).not.toMatch(/publicação automática|publique automaticamente/i);
    expect(html).not.toMatch(/anúncio|tráfego pago|impulsione/i);
    expect(html).not.toMatch(
      /aumente suas vendas|mais alcance|mais clientes|conversão/i,
    );
    expect(html).not.toMatch(/agência/i);
    expect(html).not.toMatch(/30 segundos|média de 30/i);
  });

  it("não exibe preço, avaliação ou dados de loja real", async () => {
    const html = await render();

    expect(html).not.toMatch(/R\$/);
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("PetStore");
    expect(html).not.toContain("LocalBusiness");
    expect(html).not.toContain("AggregateRating");
  });

  it("não transforma a página em manual de campos ou onboarding", async () => {
    const html = await render();

    expect(html).not.toMatch(/campo obrigatório|campos obrigatórios/i);
    expect(html).not.toMatch(/badge/i);
    expect(html).not.toMatch(/onboarding/i);
  });
});

describe("imagens de /campanhas-para-sua-loja", () => {
  async function render(): Promise<string> {
    const { default: CampanhasPage } = await loadPage();
    const element = await CampanhasPage();
    return renderToStaticMarkup(element);
  }

  it("entrega as quatro imagens em duas variantes WebP com srcset e sizes", async () => {
    const html = await render();

    expect(html).toContain(
      'src="/demonstracao/foto-racao-confiance-1024w.webp"',
    );
    expect(html).toContain(
      "/demonstracao/foto-racao-confiance-480w.webp 480w",
    );
    expect(html).toContain(
      'src="/demonstracao/campanha-racao-confiance-bicho-fofo-1024w.webp"',
    );
    expect(html).toContain(
      "/demonstracao/campanha-racao-confiance-bicho-fofo-480w.webp 480w",
    );
    expect(html).toContain(
      'src="/demonstracao/foto-cama-pet-comfort-1024w.webp"',
    );
    expect(html).toContain(
      "/demonstracao/foto-cama-pet-comfort-480w.webp 480w",
    );
    expect(html).toContain(
      'src="/demonstracao/campanha-cama-pet-comfort-bicho-fofo-1024w.webp"',
    );
    expect(html).toContain(
      "/demonstracao/campanha-cama-pet-comfort-bicho-fofo-480w.webp 480w",
    );
    expect(html).toContain("(min-width: 1024px) 452px");
    expect(html).toContain("(min-width: 640px) 300px");
    expect(html).toContain("(min-width: 640px) 270px");
  });

  it("nivela a faixa de rótulos para as imagens começarem na mesma altura", async () => {
    const html = await render();

    expect(html.match(/min-h-8/g) ?? []).toHaveLength(4);
  });

  it("declara dimensões explícitas e não recorta a campanha 9:16", async () => {
    const html = await render();

    const rationTag =
      html.match(/<img[^>]*campanha-racao-confiance[^>]*>/)?.[0] ?? "";
    expect(rationTag).toContain('width="1024"');
    expect(rationTag).toContain('height="1024"');
    expect(rationTag).toContain("object-contain");
    expect(rationTag).not.toContain("object-cover");

    const bedTag =
      html.match(/<img[^>]*campanha-cama-pet-comfort[^>]*>/)?.[0] ?? "";
    expect(bedTag).toContain('width="1024"');
    expect(bedTag).toContain('height="1820"');
    expect(bedTag).toContain("object-contain");
    expect(bedTag).not.toContain("object-cover");

    const bedPhotoTag =
      html.match(/<img[^>]*foto-cama-pet-comfort[^>]*>/)?.[0] ?? "";
    expect(bedPhotoTag).toContain('width="1024"');
    expect(bedPhotoTag).toContain('height="1536"');
  });

  it("mantém o caso 1 sem lazy, o caso 2 com lazy e nenhum fetchpriority alto", async () => {
    const html = await render();
    const rationTag =
      html.match(/<img[^>]*foto-racao-confiance[^>]*>/)?.[0] ?? "";
    const bedTag =
      html.match(/<img[^>]*foto-cama-pet-comfort[^>]*>/)?.[0] ?? "";

    expect(rationTag).not.toContain('loading="lazy"');
    expect(bedTag).toContain('loading="lazy"');
    expect(bedTag).toContain('decoding="async"');
    expect(html).not.toMatch(/fetchpriority="high"/i);
    expect(html).not.toContain("/api/");
  });
});

describe("CTAs, oferta e flags de /campanhas-para-sua-loja", () => {
  async function render(): Promise<string> {
    const { default: CampanhasPage } = await loadPage();
    const element = await CampanhasPage();
    return renderToStaticMarkup(element);
  }

  it("flag desligada: abertura local e ações reais somente no card final", async () => {
    const html = await render();

    expect(html.match(/data-access-cta-group/g) ?? []).toHaveLength(2);
    expect(html.match(/data-access-mode="anchor"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-access-mode="real"/g) ?? []).toHaveLength(1);
    expect(
      html.match(/data-public-signup-enabled="false"/g) ?? [],
    ).toHaveLength(2);
    expect(html.match(/data-local-access="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="#campanhas-oferta"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="\/#acesso"/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/href="\/signup"/);
    expect(html.match(/href="\/"[^>]*>Conheça o Vendeo</g) ?? []).toHaveLength(
      2,
    );
  });

  it("flag ligada: abertura local e Google/e-mail reais no card final", async () => {
    flag.publicSignupEnabled = true;
    const html = await render();

    expect(html).not.toContain(PUBLIC_ACCESS_COPY.closedCta);
    expect(html).not.toContain(PUBLIC_ACCESS_COPY.closedSupport);
    expect(html).not.toContain(PUBLIC_OFFER_COPY.closedDetailsNote);
    expect(
      html.match(new RegExp(PUBLIC_ACCESS_COPY.email, "g")) ?? [],
    ).toHaveLength(2);
    expect(html.match(/href="\/signup"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-local-access="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/href="#campanhas-oferta"/g) ?? []).toHaveLength(2);
    expect(html.match(/id="campanhas-oferta"/g) ?? []).toHaveLength(1);
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
    expect(html.match(/id="campanhas-oferta"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/id="campanhas-oferta"[^>]*tabindex="-1"/);
    expect(html).toContain("scroll-mt-24");
  });

  it("não produz IDs duplicados", async () => {
    const html = await render();
    const ids = Array.from(
      html.matchAll(/\sid="([^"]+)"/g),
      (match) => match[1],
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("acessibilidade estrutural de /campanhas-para-sua-loja", () => {
  async function render(): Promise<string> {
    const { default: CampanhasPage } = await loadPage();
    const element = await CampanhasPage();
    return renderToStaticMarkup(element);
  }

  it("usa landmarks, um único h1 e hierarquia coerente", async () => {
    const html = await render();

    expect(html.match(/<header/g) ?? []).toHaveLength(1);
    expect(html.match(/<main/g) ?? []).toHaveLength(1);
    expect(html.match(/<footer/g) ?? []).toHaveLength(1);
    expect(html.match(/<h1/g) ?? []).toHaveLength(1);
    expect(html.match(/<h2/g) ?? []).toHaveLength(5);
    expect(html.match(/<h3/g) ?? []).toHaveLength(4);
  });

  it("preenche todos os alt e oculta a seta decorativa", async () => {
    const html = await render();
    const images = html.match(/<img[^>]*>/g) ?? [];

    expect(images.length).toBe(6);
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
