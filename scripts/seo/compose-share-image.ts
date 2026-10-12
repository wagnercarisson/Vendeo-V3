/**
 * compose-share-image — composição determinística da imagem de compartilhamento
 * (F51.2 / D-11 / REQ-51.2-12).
 *
 * Script Node executável via `tsx`. NÃO é rota da aplicação e NÃO é importado por
 * `src/**` — é uma ferramenta local de geração de asset.
 *
 * Monta a imagem institucional 1200×630 com `sharp` a partir das **fontes locais**
 * recebidas por argumento de CLI (ou pelas variáveis de ambiente
 * `VENDO_SEO_LOGO_DARK` / `VENDO_SEO_LOGO_STACKED`). Nenhum caminho local é
 * embutido neste arquivo por design — a composição é portável e não expõe a
 * estrutura de arquivos pessoal do responsável.
 *
 * Garantias:
 *  - determinístico: sem aleatoriedade, sem relógio de parede, sem rede, sem IA,
 *    sem chamada paga e sem dependência nova;
 *  - preserva a proporção do logo (`fit: "contain"`, sem deformação nem recorte);
 *  - fundo na paleta do design system (superfície/deep + acento verde), sem
 *    light mode, sem emojis e sem tipografia nova;
 *  - afirma 1200×630 via `sharp(...).metadata()` antes de gravar.
 *
 * Uso:
 *   npx tsx scripts/seo/compose-share-image.ts \
 *     --logo-dark <arquivo> [--logo-stacked <arquivo>] \
 *     [--out public/seo/vendeo-og-1200x630.png]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Largura alvo da imagem de compartilhamento (Open Graph), em px. */
export const SHARE_IMAGE_WIDTH = 1200;

/** Altura alvo da imagem de compartilhamento (Open Graph), em px. */
export const SHARE_IMAGE_HEIGHT = 630;

/** Paleta do design system aplicada à composição (D-11 / MASTER.md). */
export const COLORS = {
  /** `--bg-surface` — superfície aprovada da landing. */
  surface: "#0F172A",
  /** `--bg-deep` — camada profunda (painel interno). */
  deep: "#020617",
  /** `--accent-green` — acento verde. */
  accent: "#22C55E",
} as const;

/** Caminho público de saída padrão do asset final. */
export const DEFAULT_OUT_PATH = "public/seo/vendeo-og-1200x630.png";

/** Caixa máxima reservada ao logo (bounding box). Preserva proporção via `contain`. */
const LOGO_BOX_WIDTH = 900;
const LOGO_BOX_HEIGHT = 320;

/**
 * Painel de superfície interno (centralizado verticalmente no canvas). Usa
 * `#0F172A`, o mesmo fundo dos ativos oficiais de logo, para que o logo se
 * funda ao painel sem caixa visível.
 */
const PANEL_WIDTH = 1120;
const PANEL_HEIGHT = 470;

/** Altura da faixa de acento no topo do canvas. */
const ACCENT_BAND_HEIGHT = 6;

export interface ComposeOptions {
  /** Fonte local do logo horizontal (dark). Recebida por CLI/env — nunca literal. */
  logoDark?: string | null;
  /** Fonte local do logo empilhado. Recebida por CLI/env — nunca literal. */
  logoStacked?: string | null;
  /** Caminho de saída (padrão: {@link DEFAULT_OUT_PATH}). */
  outPath?: string;
}

export interface ComposeResult {
  outPath: string;
  width: number;
  height: number;
}

/** Extrai pares `--chave valor` de `argv` (determinístico, sem dependência). */
function parseArgs(argv: string[]): Record<string, string | undefined> {
  const parsed: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      parsed[key] = "";
      continue;
    }
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

/** Resolve uma fonte de logo (argumento tem prioridade sobre a variável de ambiente). */
function resolveLogoSource(flag: string | undefined, envName: string): string | null {
  const fromFlag = flag !== undefined && flag.length > 0 ? flag : undefined;
  const fromEnv = process.env[envName];
  const fromEnvValue = fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : undefined;
  return fromFlag ?? fromEnvValue ?? null;
}

/** Lê e normaliza o logo para o bounding box, preservando proporção (sem deformação/recorte). */
async function buildLogoLayer(logoPath: string): Promise<Buffer> {
  return sharp(logoPath)
    .resize({
      width: LOGO_BOX_WIDTH,
      height: LOGO_BOX_HEIGHT,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/**
 * Compõe a imagem 1200×630 e grava em `outPath`.
 *
 * @throws se nenhuma fonte de logo existir ou se a composição divergir de 1200×630.
 */
export async function composeShareImage(
  options: ComposeOptions,
): Promise<ComposeResult> {
  const candidates = [options.logoDark ?? null, options.logoStacked ?? null];
  const primaryLogo = candidates.find(
    (candidate): candidate is string => candidate !== null && existsSync(candidate),
  );

  if (primaryLogo === undefined) {
    throw new Error(
      "Nenhuma fonte de logo disponível ou existente. Informe --logo-dark/--logo-stacked " +
        "(ou VENDO_SEO_LOGO_DARK/VENDO_SEO_LOGO_STACKED) apontando para um arquivo real.",
    );
  }

  const outPath =
    options.outPath !== undefined && options.outPath.length > 0
      ? options.outPath
      : DEFAULT_OUT_PATH;

  const accentBand = await sharp({
    create: {
      width: SHARE_IMAGE_WIDTH,
      height: ACCENT_BAND_HEIGHT,
      channels: 4,
      background: COLORS.accent,
    },
  })
    .png()
    .toBuffer();

  const surfacePanel = await sharp({
    create: {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      channels: 4,
      background: COLORS.surface,
    },
  })
    .png()
    .toBuffer();

  const logoLayer = await buildLogoLayer(primaryLogo);

  const canvasCenterY = Math.floor(SHARE_IMAGE_HEIGHT / 2);
  const panelTop = canvasCenterY - Math.floor(PANEL_HEIGHT / 2);
  const panelLeft = Math.floor((SHARE_IMAGE_WIDTH - PANEL_WIDTH) / 2);

  const composed = await sharp({
    create: {
      width: SHARE_IMAGE_WIDTH,
      height: SHARE_IMAGE_HEIGHT,
      channels: 4,
      background: COLORS.deep,
    },
  })
    .composite([
      { input: accentBand, top: 0, left: 0 },
      { input: surfacePanel, top: panelTop, left: panelLeft },
      { input: logoLayer, gravity: "centre" },
    ])
    .png()
    .toBuffer();

  const metadata = await sharp(composed).metadata();
  if (
    metadata.width !== SHARE_IMAGE_WIDTH ||
    metadata.height !== SHARE_IMAGE_HEIGHT ||
    metadata.format !== "png"
  ) {
    throw new Error(
      `Composição divergente: esperado ${SHARE_IMAGE_WIDTH}x${SHARE_IMAGE_HEIGHT} png, ` +
        `obtido ${metadata.width}x${metadata.height} ${metadata.format ?? "?"}.`,
    );
  }

  const outDir = path.dirname(path.resolve(outPath));
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(outPath, composed);

  return { outPath, width: metadata.width, height: metadata.height };
}

/**
 * Ponto de entrada da CLI. Retorna o código de saída (0 sucesso; 1 configuração ausente).
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  const logoDark = resolveLogoSource(args["logo-dark"], "VENDO_SEO_LOGO_DARK");
  const logoStacked = resolveLogoSource(args["logo-stacked"], "VENDO_SEO_LOGO_STACKED");
  const outPath = args.out !== undefined && args.out.length > 0 ? args.out : DEFAULT_OUT_PATH;

  if (logoDark === null && logoStacked === null) {
    console.error(
      "[seo/compose-share-image] Falta a fonte do logo.\n" +
        "  Passe --logo-dark <arquivo> e/ou --logo-stacked <arquivo>,\n" +
        "  ou defina VENDO_SEO_LOGO_DARK / VENDO_SEO_LOGO_STACKED.\n" +
        "  Nenhum caminho local é embutido neste script por design.",
    );
    return 1;
  }

  const result = await composeShareImage({ logoDark, logoStacked, outPath });
  console.log(
    `[seo/compose-share-image] OK — ${result.width}x${result.height} → ${result.outPath}`,
  );
  return 0;
}

/** Só executa a CLI quando o módulo é o alvo direto (`tsx ...compose-share-image.ts`). */
function isDirectExecution(): boolean {
  if (process.env.VITEST) return false;
  const entry = process.argv[1];
  if (typeof entry !== "string" || entry.length === 0) return false;
  return entry.replace(/\\/g, "/").endsWith("scripts/seo/compose-share-image.ts");
}

if (isDirectExecution()) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[seo/compose-share-image] Falha: ${message}`);
      process.exitCode = 1;
    });
}
