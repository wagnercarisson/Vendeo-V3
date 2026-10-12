// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  composeShareImage,
  DEFAULT_OUT_PATH,
  SHARE_IMAGE_WIDTH,
  SHARE_IMAGE_HEIGHT,
} from "../../../scripts/seo/compose-share-image";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(HERE, "../../../scripts/seo/compose-share-image.ts");
const source = readFileSync(SCRIPT_PATH, "utf8");

/**
 * Marcadores de caminho local montados dinamicamente para que ESTE arquivo de
 * teste também não contenha o literal do caminho pessoal (a varredura `rg`
 * cobre `src/**`). O padrão resultante detecta caminhos absolutos do Windows.
 */
const LOCAL_HOME_DIR = ["One", "Drive"].join("");
const WINDOWS_DRIVE = ["C", ":"].join("");
const LOCAL_PATH_PATTERN = new RegExp(`${LOCAL_HOME_DIR}|${WINDOWS_DRIVE}\\\\`, "i");

describe("compose-share-image — garantias estáticas (sem IA, sem rede, sem caminho local)", () => {
  it("não contém caminho absoluto local (pasta pessoal / unidade do Windows)", () => {
    expect(source).not.toMatch(LOCAL_PATH_PATTERN);
  });

  it("não importa clientes de IA nem faz requisições HTTP", () => {
    expect(source).not.toMatch(/openai|generative-ai|fetch\(/i);
  });

  it("é determinístico (sem Math.random nem Date.now)", () => {
    expect(source).not.toMatch(/Math\.random|Date\.now/);
  });

  it("usa sharp, a paleta do design system e o alvo 1200×630", () => {
    expect(source).toMatch(/sharp/);
    expect(source).toMatch(/#0F172A/);
    expect(source).toMatch(/1200/);
    expect(source).toMatch(/630/);
  });

  it("expõe as constantes alvo e o caminho público padrão do asset final", () => {
    expect(SHARE_IMAGE_WIDTH).toBe(1200);
    expect(SHARE_IMAGE_HEIGHT).toBe(630);
    expect(DEFAULT_OUT_PATH).toBe("public/seo/vendeo-og-1200x630.png");
  });
});

/**
 * As fontes locais são pessoais e ficam fora do repositório — por isso a
 * recomposição real é **condicional**. As asserções estáticas acima permanecem
 * sempre ativas.
 */
const LOGO_DARK = process.env.VENDO_SEO_LOGO_DARK ?? "";
const LOGO_STACKED = process.env.VENDO_SEO_LOGO_STACKED ?? "";
const LOCAL_SOURCE_AVAILABLE =
  (LOGO_DARK.length > 0 && existsSync(LOGO_DARK)) ||
  (LOGO_STACKED.length > 0 && existsSync(LOGO_STACKED));

describe("compose-share-image — composição real 1200×630 (condicional às fontes locais)", () => {
  it.skipIf(!LOCAL_SOURCE_AVAILABLE)(
    "gera exatamente 1200×630 a partir das fontes locais",
    async () => {
      const outPath = path.join(os.tmpdir(), "vendeo-og-compose-test.png");

      const result = await composeShareImage({
        logoDark: LOGO_DARK.length > 0 ? LOGO_DARK : null,
        logoStacked: LOGO_STACKED.length > 0 ? LOGO_STACKED : null,
        outPath,
      });

      expect(result.width).toBe(1200);
      expect(result.height).toBe(630);
      expect(result.outPath).toBe(outPath);

      const metadata = await sharp(outPath).metadata();
      expect(metadata.width).toBe(1200);
      expect(metadata.height).toBe(630);
      expect(metadata.format).toBe("png");
    },
  );
});
