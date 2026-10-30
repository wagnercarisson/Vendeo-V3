#!/usr/bin/env node
/**
 * Deterministic responsive variant generator for the landing campaign images.
 *
 * Only the nine square campaign assets are eligible (explicit closed allowlist).
 * Each original stays untouched (1024w in the srcset); this script writes the
 * smaller variants into `public/landing/variants/` as `{basename}-{width}w.webp`.
 *
 * Usage:
 *   node scripts/generate-landing-image-variants.mjs          # fill missing/invalid
 *   node scripts/generate-landing-image-variants.mjs --check  # validate only, no writes
 *   node scripts/generate-landing-image-variants.mjs --force  # regenerate everything
 *
 * Sharp is already a project dependency; no new dependencies are introduced.
 */

import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const LANDING_DIR = path.resolve("public/landing");
const VARIANTS_DIR = path.join(LANDING_DIR, "variants");

const WIDTHS = [320, 480, 640, 768];

// Closed allowlist. `transformacao-produto-racao` (320x293) and
// `vendeo-logo-dark` (384x82) are intentionally excluded: they are never
// resized and never receive variants.
const BASENAMES = [
  "hero-oferta-cafe",
  "transformacao-petshop",
  "identidade-floricultura",
  "apresentacao-estudio",
  "apresentacao-ambientado",
  "apresentacao-fundo-original",
  "abordagens-oferta",
  "abordagens-destaque",
  "abordagens-exclusivo",
];

const EXPECTED_TOTAL = BASENAMES.length * WIDTHS.length;

const PIPELINE = {
  webp: { quality: 82, effort: 6, smartSubsample: true },
};

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function readMetadata(file) {
  try {
    return await sharp(file).metadata();
  } catch {
    return null;
  }
}

async function isValidVariant(file, width) {
  if (!existsSync(file)) return false;
  const stats = statSync(file);
  if (stats.size <= 0) return false;
  const meta = await readMetadata(file);
  if (!meta) return false;
  return meta.width === width && meta.height === width;
}

async function generateVariant(input, output, width) {
  await sharp(input)
    .resize({ width, withoutEnlargement: true, fit: "inside" })
    .webp(PIPELINE.webp)
    .toFile(output);
}

async function main() {
  const argv = new Set(process.argv.slice(2));
  const checkMode = argv.has("--check");
  const forceMode = argv.has("--force");

  if (checkMode && forceMode) {
    log("erro: --check e --force são mutuamente exclusivos");
    process.exit(2);
  }

  const originals = new Map();
  for (const basename of BASENAMES) {
    const file = path.join(LANDING_DIR, `${basename}.webp`);
    if (!existsSync(file)) {
      log(`erro: original ausente: public/landing/${basename}.webp`);
      process.exit(1);
    }
    const meta = await readMetadata(file);
    if (!meta || !meta.width || !meta.height) {
      log(`erro: não foi possível ler metadados de public/landing/${basename}.webp`);
      process.exit(1);
    }
    if (meta.width !== meta.height) {
      log(
        `erro: ${basename}.webp não é quadrado (${meta.width}x${meta.height}); variantes exigem original 1:1`,
      );
      process.exit(1);
    }
    originals.set(basename, { file, width: meta.width });
  }

  if (!checkMode && !existsSync(VARIANTS_DIR)) {
    mkdirSync(VARIANTS_DIR, { recursive: true });
  }

  let generated = 0;
  let reused = 0;
  let total = 0;
  const invalid = [];

  for (const basename of BASENAMES) {
    const original = originals.get(basename);
    for (const width of WIDTHS) {
      total += 1;
      const output = path.join(VARIANTS_DIR, `${basename}-${width}w.webp`);

      // Never upscale: skip widths larger than the original.
      if (original.width < width) {
        reused += 1;
        continue;
      }

      const valid = !forceMode && (await isValidVariant(output, width));

      if (checkMode) {
        if (valid) {
          reused += 1;
        } else {
          invalid.push(path.relative(process.cwd(), output));
        }
        continue;
      }

      if (valid) {
        reused += 1;
        continue;
      }

      await generateVariant(original.file, output, width);
      generated += 1;
    }
  }

  if (checkMode) {
    log(`variantes válidas: ${reused}/${total}`);
    if (invalid.length > 0) {
      log(`variantes ausentes ou inválidas (${invalid.length}):`);
      for (const file of invalid) log(`  - ${file}`);
      process.exit(1);
    }
    log(`total esperado: ${EXPECTED_TOTAL}`);
    return;
  }

  log(`gerados: ${generated}`);
  log(`reutilizados: ${reused}`);
  log(`total esperado: ${EXPECTED_TOTAL}`);
}

main().catch((error) => {
  log(`erro: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
