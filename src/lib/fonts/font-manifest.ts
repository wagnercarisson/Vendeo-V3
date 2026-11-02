/**
 * Fonte única de verdade dos assets de fonte locais do Vendeo.
 *
 * Cada entrada lógica liga uma declaração `@font-face` de `src/app/fonts.css`
 * a um WOFF2 versionado em `public/fonts/**`. Os binários, versões, URLs
 * oficiais e hashes estão documentados em `public/fonts/PROVENANCE.md`.
 *
 * Open Sans v44 é um arquivo variável: as cinco entradas de peso (300–700)
 * apontam para o mesmo WOFF2 por subset, exatamente como o CSS oficial do
 * Google. Poppins v24 é estática: um arquivo por peso e subset.
 *
 * Este módulo é apenas dado — não faz `fs`, `fetch` nem I/O — e não é
 * importado por código de produção.
 */

export type FontSubset = "latin" | "latin-ext";

export type FontAsset = {
  readonly family: "Poppins" | "Open Sans";
  readonly weight: 300 | 400 | 500 | 600 | 700;
  readonly style: "normal";
  readonly subset: FontSubset;
  readonly display: "swap";
  readonly format: "woff2";
  /** Presente apenas em Open Sans (existe no CSS oficial). */
  readonly stretch?: "100%";
  readonly unicodeRange: string;
  readonly publicPath: string;
  readonly bytes: number;
  readonly sha256: string;
};

const LATIN_UNICODE_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const LATIN_EXT_UNICODE_RANGE =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

export const FONT_ASSETS = [
  // Poppins v24 — estática, um arquivo por peso/subset.
  {
    family: "Poppins",
    weight: 400,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-400-latin.woff2",
    bytes: 7884,
    sha256: "7d93459d86585bfcdbb7e0376056226adb25821ee54b96236fe2123e9560929f",
  },
  {
    family: "Poppins",
    weight: 400,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-400-latin-ext.woff2",
    bytes: 5644,
    sha256: "0b1fcab42c18b69bcfe9ce4799fcbff5af1621c53ffcfdc4723c6f5ec4ee3ffb",
  },
  {
    family: "Poppins",
    weight: 500,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-500-latin.woff2",
    bytes: 7748,
    sha256: "cd36de204aca2d5fa263a731f7c20009b5e3d754ba1f1e03c33e93a48f3e7446",
  },
  {
    family: "Poppins",
    weight: 500,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-500-latin-ext.woff2",
    bytes: 5484,
    sha256: "af5fda16a19169e029a132374616728e1bf326d90bef5a552395c5053e21cd0f",
  },
  {
    family: "Poppins",
    weight: 600,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-600-latin.woff2",
    bytes: 8000,
    sha256: "f4e80d9dfd374d02989b87a27b5ed4cb78fbb177c27f1478e9a8b0afb7513149",
  },
  {
    family: "Poppins",
    weight: 600,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-600-latin-ext.woff2",
    bytes: 5524,
    sha256: "bb1f2d582e7fba586ab70c91ef062d3becaf78b887654953863521b73665d171",
  },
  {
    family: "Poppins",
    weight: 700,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-700-latin.woff2",
    bytes: 7816,
    sha256: "9338e65fc077355c7a87ae0d64cc101e23b9bf8ad78ae65f0f319c857311b526",
  },
  {
    family: "Poppins",
    weight: 700,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/poppins/poppins-700-latin-ext.woff2",
    bytes: 5432,
    sha256: "ccfd87f69ef00d811da3d06488cec4e79ec99d289cfbcbe4be42031cecae775a",
  },
  // Open Sans v44 — variável, mesmo WOFF2 por subset para os cinco pesos.
  {
    family: "Open Sans",
    weight: 300,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin.woff2",
    bytes: 48320,
    sha256: "d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0",
  },
  {
    family: "Open Sans",
    weight: 300,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin-ext.woff2",
    bytes: 35156,
    sha256: "d5bab8e28732fe3d10dcef4f77b9c248605bbb2a87d289a2539251ceafab536a",
  },
  {
    family: "Open Sans",
    weight: 400,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin.woff2",
    bytes: 48320,
    sha256: "d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0",
  },
  {
    family: "Open Sans",
    weight: 400,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin-ext.woff2",
    bytes: 35156,
    sha256: "d5bab8e28732fe3d10dcef4f77b9c248605bbb2a87d289a2539251ceafab536a",
  },
  {
    family: "Open Sans",
    weight: 500,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin.woff2",
    bytes: 48320,
    sha256: "d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0",
  },
  {
    family: "Open Sans",
    weight: 500,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin-ext.woff2",
    bytes: 35156,
    sha256: "d5bab8e28732fe3d10dcef4f77b9c248605bbb2a87d289a2539251ceafab536a",
  },
  {
    family: "Open Sans",
    weight: 600,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin.woff2",
    bytes: 48320,
    sha256: "d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0",
  },
  {
    family: "Open Sans",
    weight: 600,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin-ext.woff2",
    bytes: 35156,
    sha256: "d5bab8e28732fe3d10dcef4f77b9c248605bbb2a87d289a2539251ceafab536a",
  },
  {
    family: "Open Sans",
    weight: 700,
    style: "normal",
    subset: "latin",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin.woff2",
    bytes: 48320,
    sha256: "d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0",
  },
  {
    family: "Open Sans",
    weight: 700,
    style: "normal",
    subset: "latin-ext",
    display: "swap",
    format: "woff2",
    stretch: "100%",
    unicodeRange: LATIN_EXT_UNICODE_RANGE,
    publicPath: "/fonts/open-sans/open-sans-latin-ext.woff2",
    bytes: 35156,
    sha256: "d5bab8e28732fe3d10dcef4f77b9c248605bbb2a87d289a2539251ceafab536a",
  },
] as const satisfies readonly FontAsset[];
