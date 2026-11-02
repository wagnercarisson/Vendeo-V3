// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import React from "react";
import { describe, expect, it } from "vitest";
import RootLayout from "../../app/layout";
import { FONT_ASSETS, type FontAsset } from "../../lib/fonts/font-manifest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FONTS_CSS_PATH = path.join(REPO_ROOT, "src/app/fonts.css");
const LAYOUT_PATH = path.join(REPO_ROOT, "src/app/layout.tsx");
const PROVENANCE_PATH = path.join(REPO_ROOT, "public/fonts/PROVENANCE.md");

// Needles montados por concatenação para que este próprio teste não contamine
// a varredura de `src/` que ele executa.
const GOOGLE_CSS_ORIGIN = "fonts." + "googleapis.com";
const GOOGLE_STATIC_ORIGIN = "fonts." + "gstatic.com";
const PRECONNECT_ATTR = "pre" + "connect";
const EXTERNAL_ORIGINS = [GOOGLE_CSS_ORIGIN, GOOGLE_STATIC_ORIGIN];

const LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT_RANGE =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

type ParsedBlock = {
  raw: string;
  family: string | null;
  weight: string | null;
  style: string | null;
  display: string | null;
  stretch: string | null;
  src: string | null;
  unicodeRange: string | null;
};

function parseBlocks(css: string): ParsedBlock[] {
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  return blocks.map((raw) => {
    const field = (name: string): string | null => {
      const match = raw.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
      return match ? match[1].trim() : null;
    };
    return {
      raw,
      family: field("font-family")?.replace(/^["']|["']$/g, "") ?? null,
      weight: field("font-weight"),
      style: field("font-style"),
      display: field("font-display"),
      stretch: field("font-stretch"),
      src: field("src"),
      unicodeRange: field("unicode-range"),
    };
  });
}

function isSingleWeight(value: string | null): boolean {
  return value !== null && /^\d{3}$/.test(value);
}

function parseUnicodeRange(value: string): Array<[number, number]> {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^U\+([0-9A-Fa-f]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/);
      if (!match) {
        throw new Error(`unicode-range inválido: ${part}`);
      }
      const start = Number.parseInt(match[1], 16);
      const end = match[2] ? Number.parseInt(match[2], 16) : start;
      return [start, end] as [number, number];
    });
}

function covers(ranges: Array<[number, number]>, codePoint: number): boolean {
  return ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

type ReactNodeLike = React.ReactNode;

function collectElements(node: ReactNodeLike, acc: React.ReactElement[] = []): React.ReactElement[] {
  React.Children.forEach(node, (child) => {
    if (React.isValidElement(child)) {
      acc.push(child);
      const props = child.props as { children?: React.ReactNode };
      if (props.children !== undefined) {
        collectElements(props.children, acc);
      }
    }
  });
  return acc;
}

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkSourceFiles(fullPath, acc);
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(entry)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const css = readFileSync(FONTS_CSS_PATH, "utf8");
const blocks = parseBlocks(css);
const layoutSource = readFileSync(LAYOUT_PATH, "utf8");
const provenance = readFileSync(PROVENANCE_PATH, "utf8");

describe("fonts.css — contrato tipográfico local", () => {
  it("declara exatamente 18 blocos @font-face", () => {
    expect(blocks).toHaveLength(18);
  });

  it("usa pesos exatos, estilo normal e font-display swap, sem 800 e sem itálico", () => {
    for (const block of blocks) {
      expect(block.weight, block.raw).not.toBeNull();
      expect(isSingleWeight(block.weight), `peso de faixa ou inválido: ${block.weight}`).toBe(true);
      expect(block.weight).not.toBe("800");
      expect(block.style).toBe("normal");
      expect(block.display).toBe("swap");
    }
    expect(css).not.toMatch(/300\s+800/);
    expect(css).not.toMatch(/font-style\s*:\s*italic/);
    expect(css).not.toMatch(/@import/);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it("aponta cada bloco para o WOFF2 local e o unicode-range oficial do subset", () => {
    for (const block of blocks) {
      expect(block.src, block.raw).not.toBeNull();
      expect(block.src).toMatch(/^url\(\/fonts\/.+\.woff2\)\s+format\(["']woff2["']\)$/);
      expect(block.unicodeRange === LATIN_RANGE || block.unicodeRange === LATIN_EXT_RANGE).toBe(true);
    }
  });

  it("faz o CSS e o manifesto concordarem bloco a bloco", () => {
    for (const block of blocks) {
      const family = block.family;
      const weight = Number(block.weight);
      const publicPath = block.src?.match(/^url\((\/fonts\/[^)]+)\)/)?.[1];
      expect(publicPath, `url inválida em ${block.raw}`).toBeTruthy();
      const matches = FONT_ASSETS.filter(
        (asset) =>
          asset.family === family &&
          asset.weight === weight &&
          asset.publicPath === publicPath &&
          asset.unicodeRange === block.unicodeRange,
      );
      expect(matches, `sem manifesto para ${family}/${weight}/${publicPath}`).toHaveLength(1);
      const asset: FontAsset = matches[0];
      if (asset.stretch) {
        expect(block.stretch).toBe(asset.stretch);
      } else {
        expect(block.stretch).toBeNull();
      }
    }
  });

  it("aplica font-stretch 100% só em Open Sans", () => {
    for (const block of blocks) {
      if (block.family === "Open Sans") {
        expect(block.stretch).toBe("100%");
      } else {
        expect(block.stretch).toBeNull();
      }
    }
  });

  it("tem exatamente 10 url() distintos (Open Sans recolhe em 2 arquivos)", () => {
    const urls = new Set(
      blocks
        .map((block) => block.src?.match(/^url\((\/fonts\/[^)]+)\)/)?.[1])
        .filter((value): value is string => Boolean(value)),
    );
    expect(urls.size).toBe(10);
  });

  it("cobre acentos, ç/ñ, ¿/¡ e símbolos monetários em latin + latin-ext", () => {
    const requiredCodePoints = [0x00e1, 0x00e3, 0x00e7, 0x00f1, 0x00bf, 0x00a1, 0x20b2, 0x20ac, 0x0024];
    for (const family of ["Poppins", "Open Sans"] as const) {
      const ranges = blocks
        .filter((block) => block.family === family)
        .flatMap((block) => parseUnicodeRange(block.unicodeRange ?? ""));
      const missing = requiredCodePoints.filter((codePoint) => !covers(ranges, codePoint));
      expect(missing.map((codePoint) => codePoint.toString(16)), family).toEqual([]);
    }
  });
});

describe("manifesto e arquivos em disco", () => {
  it("tem 18 entradas lógicas com metadados completos", () => {
    expect(FONT_ASSETS).toHaveLength(18);
    for (const asset of FONT_ASSETS) {
      expect(asset.style).toBe("normal");
      expect(asset.display).toBe("swap");
      expect(asset.format).toBe("woff2");
      expect(asset.publicPath.startsWith("/fonts/")).toBe(true);
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("confere bytes, sha256 e magic wOF2 de cada arquivo", () => {
    for (const asset of FONT_ASSETS) {
      const filePath = path.join(REPO_ROOT, "public", asset.publicPath.replace(/^\//, ""));
      const bytes = readFileSync(filePath);
      expect(bytes.length, asset.publicPath).toBe(asset.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), asset.publicPath).toBe(asset.sha256);
      expect(bytes.subarray(0, 4).toString("latin1"), asset.publicPath).toBe("wOF2");
    }
  });

  it("registra os mesmos hashes em PROVENANCE.md", () => {
    for (const asset of FONT_ASSETS) {
      expect(provenance).toContain(asset.sha256);
    }
  });
});

describe("layout raiz", () => {
  it("importa fonts.css e não referencia origens externas", () => {
    expect(layoutSource).toContain('import "./fonts.css";');
    for (const needle of [...EXTERNAL_ORIGINS, PRECONNECT_ATTR]) {
      expect(layoutSource).not.toContain(needle);
    }
  });

  it("renderiza sem nó de pré-conexão e sem href/src externo de fonte", () => {
    const element = RootLayout({ children: null });
    const elements = collectElements(element);

    const html = elements.find((node) => node.type === "html");
    const htmlProps = html?.props as { lang?: string } | undefined;
    expect(htmlProps?.lang).toBe("pt-BR");
    expect(elements.some((node) => node.type === "body")).toBe(true);

    for (const node of elements) {
      const props = node.props as Record<string, unknown>;
      expect(props.rel).not.toBe(PRECONNECT_ATTR);
      for (const attribute of ["href", "src"]) {
        const value = props[attribute];
        if (typeof value === "string") {
          for (const origin of EXTERNAL_ORIGINS) {
            expect(value).not.toContain(origin);
          }
        }
      }
    }
  });
});

describe("varredura de src/", () => {
  it("não contém origem de Google Fonts nem atributo de pré-conexão", () => {
    const files = walkSourceFiles(path.join(REPO_ROOT, "src"));
    const needles = [...EXTERNAL_ORIGINS, PRECONNECT_ATTR];
    const hits: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      for (const needle of needles) {
        if (contents.includes(needle)) {
          hits.push(`${path.relative(REPO_ROOT, file)} → ${needle}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
