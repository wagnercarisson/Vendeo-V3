/**
 * Benchmark scenarios — 10 fixed scenarios for cross-model comparison.
 *
 * Each scenario represents a realistic store + campaign combination.
 * Scenarios are deterministic (same inputs every run) to enable
 * reproducible benchmarks across providers and models.
 *
 * Fixture images must be placed in scripts/benchmark-fixtures/.
 * See the README in that directory for image source requirements.
 */

export interface BenchmarkScenarioStore {
  name: string;
  segment: string;
  tone: string;
  brandColor: string;
  logoUrl?: string;
}

export interface BenchmarkScenarioCampaign {
  productName: string;
  description: string;
  originalPriceCents?: number;
  discountedPriceCents: number;
  badgeText?: string;
  hook?: string;
  cta?: string;
  objective?: string;
  campaignDetails?: string;
  additionalDetails?: string;
  availabilityNotes?: string;
  validity?: string;
  targetChannel?: string;
  format?: string;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  store: BenchmarkScenarioStore;
  campaign: BenchmarkScenarioCampaign;
  imagePath?: string;
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  // ── 1. JBL Boombox 3 — eletrônicos, de/por pricing, OFERTA badge ──────────
  {
    id: "jbl-boombox",
    name: "JBL Boombox 3 — Eletrônicos com badge OFERTA",
    store: {
      name: "EletroZona",
      segment: "eletronicos-tecnologia",
      tone: "promocional",
      brandColor: "#E53935",
      logoUrl: "https://placehold.co/200x80/E53935/white?text=EletroZona",
    },
    campaign: {
      productName: "JBL Boombox 3",
      description: "Caixa de som portátil com graves potentes e 24h de bateria.",
      originalPriceCents: 299900,
      discountedPriceCents: 249900,
      badgeText: "Oferta",
      hook: "O som que sua festa merece",
      cta: "Garanta já a sua",
      objective: "Vender caixa de som JBL Boombox 3 com destaque para o desconto de R$ 500.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-eletronico.jpg",
  },

  // ── 2. Heineken — alimentação-bebidas, brandColor green ──────────────────
  {
    id: "heineken",
    name: "Heineken Long Neck — Bebidas com cor verde",
    store: {
      name: "Adega do Zé",
      segment: "alimentacao-bebidas",
      tone: "descontraído",
      brandColor: "#1B5E20",
    },
    campaign: {
      productName: "Heineken Long Neck",
      description: "Cerveja premium em garrafa long neck 330ml.",
      discountedPriceCents: 499,
      badgeText: "Promoção",
      hook: "A cerveja que todo mundo pede",
      cta: "Compre agora",
      objective: "Vender Heineken Long Neck com preço promocional para happy hour.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-bebida.jpg",
  },

  // ── 3. 51 Ice — alimentação-bebidas, potential name/volume divergence ─────
  {
    id: "51-ice",
    name: "51 Ice — Nome curto com potencial divergência",
    store: {
      name: "Mercado Popular",
      segment: "alimentacao-bebidas",
      tone: "promocional",
      brandColor: "#1565C0",
    },
    campaign: {
      productName: "51 Ice",
      description: "Ice de cana com sabor cítrico, 275ml.",
      discountedPriceCents: 349,
      badgeText: "Oferta",
      hook: "O gelado que esquenta",
      cta: "Pegue o seu",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-bebida.jpg",
  },

  // ── 4. Pantufa — variedades, simple price-only ──────────────────────────
  {
    id: "pantufa",
    name: "Pantufa Conforto — Variedades, preço único",
    store: {
      name: "Lar & Conforto",
      segment: "variedades",
      tone: "acolhedor",
      brandColor: "#8D6E63",
    },
    campaign: {
      productName: "Pantufa Conforto",
      description: "Pantufa macia com sola antiderrapante, ideal para dias frios.",
      discountedPriceCents: 4990,
      hook: "Seus pés merecem carinho",
      cta: "Comforto é aqui",
      objective: "Vender pantufa com apelo de conforto e preço acessível.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-variedade.jpg",
  },

  // ── 5. Tênis Runner 3000 — moda-vestuario, no badge ────────────────────
  {
    id: "tenis-runner",
    name: "Tênis Runner 3000 — Moda, sem badge",
    store: {
      name: "Esportes & Cia",
      segment: "moda-vestuario",
      tone: "moderno",
      brandColor: "#424242",
    },
    campaign: {
      productName: "Tênis Runner 3000",
      description: "Tênis esportivo leve e confortável para corrida e dia a dia.",
      originalPriceCents: 29990,
      discountedPriceCents: 19990,
      hook: "Corra mais, pague menos",
      cta: "Garanta o seu",
      objective: "Vender tênis com preço promocional para público jovem e esportivo.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-moda.jpg",
  },

  // ── 6. sem-logo — Same as JBL without storeLogoUrl ─────────────────────
  {
    id: "sem-logo",
    name: "JBL sem logo — Variação sem storeLogoUrl",
    store: {
      name: "EletroZona",
      segment: "eletronicos-tecnologia",
      tone: "promocional",
      brandColor: "#E53935",
      // Sem logoUrl — testa fallback para nome da loja
    },
    campaign: {
      productName: "JBL Boombox 3",
      description: "Caixa de som portátil com graves potentes e 24h de bateria.",
      originalPriceCents: 299900,
      discountedPriceCents: 249900,
      badgeText: "Oferta",
      hook: "O som que sua festa merece",
      cta: "Garanta já a sua",
      objective: "Vender caixa de som JBL sem logo da loja — fallback para nome textual.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-eletronico.jpg",
  },

  // ── 7. cor-forte — extreme brand color (#FF1493) ────────────────────────
  {
    id: "cor-forte",
    name: "Loja Pink — Cor extrema #FF1493",
    store: {
      name: "Pink House",
      segment: "moda-vestuario",
      tone: "moderno",
      brandColor: "#FF1493",
    },
    campaign: {
      productName: "Bolsa Feminina Premium",
      description: "Bolsa de couro legítimo com alça dourada e fecho magnético.",
      originalPriceCents: 34990,
      discountedPriceCents: 24990,
      badgeText: "Promoção",
      hook: "O acessório que faltava",
      cta: "Compre agora",
      objective: "Vender bolsa feminina com cor de marca impactante.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-moda.jpg",
  },

  // ── 8. preco-de-por — Explicit original + discounted price ──────────────
  {
    id: "preco-de-por",
    name: "De/Por explícito — Notebook com preço cheio + desconto",
    store: {
      name: "InfoPlus",
      segment: "eletronicos-tecnologia",
      tone: "profissional",
      brandColor: "#0D47A1",
      logoUrl: "https://placehold.co/200x80/0D47A1/white?text=InfoPlus",
    },
    campaign: {
      productName: "Notebook UltraPro 15",
      description: "Notebook 15.6\", 16GB RAM, SSD 512GB, Intel Core i7.",
      originalPriceCents: 499900,
      discountedPriceCents: 379900,
      badgeText: "Oferta",
      hook: "Potência que cabe no seu bolso",
      cta: "Aproveite a oferta",
      objective: "Vender notebook com destaque para economia de R$ 1.200.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-eletronico.jpg",
  },

  // ── 9. preco-unico — Discounted price only, no original price ──────────
  {
    id: "preco-unico",
    name: "Preço único — Sem originalPriceCents",
    store: {
      name: "Farmácia Popular",
      segment: "saude-farmacia",
      tone: "profissional",
      brandColor: "#00ACC1",
    },
    campaign: {
      productName: "Vitamina C 1g 30 comprimidos",
      description: "Vitamina C efervescente 1g, 30 comprimidos, sabor laranja.",
      discountedPriceCents: 1590,
      badgeText: "Oferta",
      hook: "Sua imunidade em dia",
      cta: "Compre agora",
      objective: "Vender vitamina C com preço acessível e apelo de saúde.",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-saude.jpg",
  },

  // ── 10. detalhes-variados — "poucas unidades", "cores variadas", etc. ───
  {
    id: "detalhes-variados",
    name: "Detalhes variados — Urgência + variedade de cores + sabores",
    store: {
      name: "SuperMix",
      segment: "alimentacao-bebidas",
      tone: "promocional",
      brandColor: "#FF6F00",
    },
    campaign: {
      productName: "Chocolate Belga Sortido",
      description: "Caixa de chocolates belgas sortidos, 500g.",
      discountedPriceCents: 4990,
      badgeText: "Últimas Unidades",
      hook: "O presente que derrete corações",
      cta: "Garanta o seu",
      objective:
        "Vender chocolate com gatilhos de urgência e variedade.",
      campaignDetails: "Ideal para presentear no Dia dos Namorados",
      additionalDetails: "Embalamos para presente sem custo extra",
      availabilityNotes:
        "poucas unidades, cores variadas, vários sabores",
      validity: "Oferta válida até 15/06/2026",
      targetChannel: "instagram",
      format: "quadrado 1:1",
    },
    imagePath: "scripts/benchmark-fixtures/produto-alimento.jpg",
  },
] as const;
