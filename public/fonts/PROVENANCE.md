# Procedência das fontes locais

Estes binários substituem **somente** a entrega externa do Google Fonts. São
versionados no Git em `public/fonts/**` e servidos pelo próprio app em
`/fonts/**`. **Nenhum download ocorre em build, runtime ou postinstall.**

- Data do download (UTC): **2026-11-02**
- Licença: **SIL Open Font License 1.1** (textos oficiais em `OFL-Poppins.txt` e `OFL-OpenSans.txt`)
- Origem dos binários: `fonts.gstatic.com` (versões fixas `v24` / `v44`)
- Origem das licenças: repositório `google/fonts`, caminhos `ofl/poppins/OFL.txt` e `ofl/opensans/OFL.txt`

## Poppins v24 (estática — um arquivo por peso e subset)

- Família: **Poppins**
- Versão: **v24**
- Pesos: **400, 500, 600, 700**
- Estilo: **normal** (sem itálico, sem peso 800)
- Subsets: **latin**, **latin-ext**

## Open Sans v44 (variável — um arquivo por subset compartilhado pelos cinco pesos)

- Família: **Open Sans**
- Versão: **v44**
- Pesos: **300, 400, 500, 600, 700**
- Estilo: **normal** (sem itálico, sem peso 800)
- Subsets: **latin**, **latin-ext**

> **Open Sans v44 é um arquivo variável.** As cinco declarações de peso em
> `src/app/fonts.css` apontam para o **mesmo** WOFF2 oficial por subset
> (`open-sans-latin.woff2` e `open-sans-latin-ext.woff2`). Isso é exatamente o
> que o Google serve hoje: o CSS oficial traz `font-weight: 300`…`700` em blocos
> separados com a mesma URL para cada subset. Declarar pesos exatos (e não
> `300 800`) evita expor o eixo 800 e preserva o download único por URL.

## Arquivos WOFF2

| Família | Pesos atendidos | Subset | URL oficial | Caminho local | Bytes | SHA-256 |
|---------|-----------------|--------|-------------|---------------|-------|---------|
| Poppins | 400 | latin | `https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJfecg.woff2` | `public/fonts/poppins/poppins-400-latin.woff2` | 7884 | `7d93459d86585bfcdbb7e0376056226adb25821ee54b96236fe2123e9560929f` |
| Poppins | 400 | latin-ext | `https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJnecmNE.woff2` | `public/fonts/poppins/poppins-400-latin-ext.woff2` | 5644 | `0b1fcab42c18b69bcfe9ce4799fcbff5af1621c53ffcfdc4723c6f5ec4ee3ffb` |
| Poppins | 500 | latin | `https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLGT9Z1xlFQ.woff2` | `public/fonts/poppins/poppins-500-latin.woff2` | 7748 | `cd36de204aca2d5fa263a731f7c20009b5e3d754ba1f1e03c33e93a48f3e7446` |
| Poppins | 500 | latin-ext | `https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLGT9Z1JlFc-K.woff2` | `public/fonts/poppins/poppins-500-latin-ext.woff2` | 5484 | `af5fda16a19169e029a132374616728e1bf326d90bef5a552395c5053e21cd0f` |
| Poppins | 600 | latin | `https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2` | `public/fonts/poppins/poppins-600-latin.woff2` | 8000 | `f4e80d9dfd374d02989b87a27b5ed4cb78fbb177c27f1478e9a8b0afb7513149` |
| Poppins | 600 | latin-ext | `https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6Z1JlFc-K.woff2` | `public/fonts/poppins/poppins-600-latin-ext.woff2` | 5524 | `bb1f2d582e7fba586ab70c91ef062d3becaf78b887654953863521b73665d171` |
| Poppins | 700 | latin | `https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2` | `public/fonts/poppins/poppins-700-latin.woff2` | 7816 | `9338e65fc077355c7a87ae0d64cc101e23b9bf8ad78ae65f0f319c857311b526` |
| Poppins | 700 | latin-ext | `https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7Z1JlFc-K.woff2` | `public/fonts/poppins/poppins-700-latin-ext.woff2` | 5432 | `ccfd87f69ef00d811da3d06488cec4e79ec99d289cfbcbe4be42031cecae775a` |
| Open Sans | 300, 400, 500, 600, 700 | latin | `https://fonts.gstatic.com/s/opensans/v44/memvYaGs126MiZpBA-UvWbX2vVnXBbObj2OVTS-muw.woff2` | `public/fonts/open-sans/open-sans-latin.woff2` | 48320 | `d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0` |
| Open Sans | 300, 400, 500, 600, 700 | latin-ext | `https://fonts.gstatic.com/s/opensans/v44/memvYaGs126MiZpBA-UvWbX2vVnXBbObj2OVTSGmu1aB.woff2` | `public/fonts/open-sans/open-sans-latin-ext.woff2` | 35156 | `d5bab8e28732fe3d10dcef4f77b9c248605bbb2a87d289a2539251ceafab536a` |

## Licenças

| Arquivo | Origem | Bytes | SHA-256 |
|---------|--------|-------|---------|
| `OFL-Poppins.txt` | `https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/OFL.txt` | — | `6be04893d770899a015649c7aa3b582f871b272f8747a92b78b17c3e5c8b2573` |
| `OFL-OpenSans.txt` | `https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OFL.txt` | — | `fbbbcfef55318de350562559b671360de6d597112ecc5c73881b05092db89602` |

Os dois textos contêm `SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007`.

## Relação com o código

- `src/app/fonts.css` — as 18 declarações `@font-face` locais (10 `url()` distintos).
- `src/lib/fonts/font-manifest.ts` — fonte única tipada dos 18 pares família/peso/subset com `publicPath`, `bytes` e `sha256`.
- `src/__tests__/fonts/local-fonts.test.ts` — recalcula os hashes e confere este documento.
