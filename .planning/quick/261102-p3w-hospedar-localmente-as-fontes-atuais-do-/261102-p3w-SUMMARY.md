---
quick_id: 261102-p3w
phase: quick
plan: 01
type: execute
status: awaiting_human_visual_acceptance
branch: perf/fontes-locais
base_sha: b898f5817de88354698ff8b03f358136570fb922
head_sha: b402cae8
subsystem: frontend/fonts
tags: [fonts, local-hosting, web-performance, accessibility, supply-chain]
requires: []
provides:
  - src/app/fonts.css
  - src/lib/fonts/font-manifest.ts
  - public/fonts/**
affects:
  - src/app/layout.tsx
tech-stack:
  added: []
  patterns:
    - "@font-face local com unicode-range oficial"
    - "manifesto tipado como fonte única de verdade"
key-files:
  created:
    - src/app/fonts.css
    - src/lib/fonts/font-manifest.ts
    - src/__tests__/fonts/local-fonts.test.ts
    - public/fonts/PROVENANCE.md
  modified:
    - src/app/layout.tsx
decisions:
  - "D1: @font-face em arquivo dedicado importado antes de globals.css"
  - "D2: sem next/font, preservando unicode-range explícito"
  - "D4: Open Sans variável com 5 pesos exatos apontando para o mesmo WOFF2 por subset"
metrics:
  tasks: 3
  files_changed: 17
  commits: 4
  completed: "2026-11-02"
---

# Quick 261102-p3w: hospedar localmente as fontes atuais do Vendeo

## One-liner

Fontes servidas pelo próprio app via 18 `@font-face` locais e 10 WOFF2 oficiais versionados (Poppins v24, Open Sans v44), removendo preconnect e stylesheet do Google do layout raiz sem alterar a tipografia.

## O que foi feito

- **Assets**: 10 WOFF2 oficiais baixados uma única vez (Poppins v24 400/500/600/700 × latin/latin-ext; Open Sans v44 variável latin/latin-ext), validados com magic `wOF2` e versionados em `public/fonts/`.
- **Licenças e procedência**: `OFL-Poppins.txt`, `OFL-OpenSans.txt` (SIL OFL 1.1) e `PROVENANCE.md` com versões, URLs, data UTC, bytes e SHA-256.
- **Manifesto**: `src/lib/fonts/font-manifest.ts` com 18 entradas lógicas tipadas (`FontAsset`, `FONT_ASSETS`), sem I/O.
- **CSS**: `src/app/fonts.css` com 18 `@font-face` — `font-style: normal`, `font-display: swap`, `font-weight` exato, `unicode-range` oficial; `font-stretch: 100%` apenas em Open Sans.
- **Layout**: `src/app/layout.tsx` importa `./fonts.css` antes de `./globals.css`; `<head>` externo removido (2 preconnects + stylesheet).
- **Teste focado**: `src/__tests__/fonts/local-fonts.test.ts` (13 casos) cobre contrato CSS, hashes/manifesto/disco, render do layout e varredura de `src/`.

## Diff stat final (`b898f58..HEAD`)

```
 public/fonts/... (10 WOFF2 + 2 OFL + PROVENANCE)
 src/__tests__/fonts/local-fonts.test.ts          | 273 +++
 src/app/fonts.css                                | 189 +++
 src/app/layout.tsx                               |   9 +-
 src/lib/fonts/font-manifest.ts                   | 268 +++
 17 files changed, 979 insertions(+), 8 deletions(-)
```

`globals.css`, `tailwind.config.ts`, `next.config.ts`, componentes, `package.json` e `package-lock.json` sem diff.

## Hashes dos 10 WOFF2

| Arquivo | Bytes | SHA-256 |
|---------|-------|---------|
| `poppins-400-latin` | 7884 | `7d93459d86585bfcdbb7e0376056226adb25821ee54b96236fe2123e9560929f` |
| `poppins-400-latin-ext` | 5644 | `0b1fcab42c18b69bcfe9ce4799fcbff5af1621c53ffcfdc4723c6f5ec4ee3ffb` |
| `poppins-500-latin` | 7748 | `cd36de204aca2d5fa263a731f7c20009b5e3d754ba1f1e03c33e93a48f3e7446` |
| `poppins-500-latin-ext` | 5484 | `af5fda16a19169e029a132374616728e1bf326d90bef5a552395c5053e21cd0f` |
| `poppins-600-latin` | 8000 | `f4e80d9dfd374d02989b87a27b5ed4cb78fbb177c27f1478e9a8b0afb7513149` |
| `poppins-600-latin-ext` | 5524 | `bb1f2d582e7fba586ab70c91ef062d3becaf78b887654953863521b73665d171` |
| `poppins-700-latin` | 7816 | `9338e65fc077355c7a87ae0d64cc101e23b9bf8ad78ae65f0f319c857311b526` |
| `poppins-700-latin-ext` | 5432 | `ccfd87f69ef00d811da3d06488cec4e79ec99d289cfbcbe4be42031cecae775a` |
| `open-sans-latin` | 48320 | `d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0` |
| `open-sans-latin-ext` | 35156 | `d5bab8e28732fe3d10dcef4f77b9c248605bbb2a87d289a2539251ceafab536a` |

## Gates

| Gate | Resultado |
|------|-----------|
| Teste focado | **13/13 passed**, exit 0 |
| Typecheck | **exit 0** |
| Lint | **exit 0** (limitação conhecida: sem cobertura TypeScript) |
| Build | **exit 0**, 95/95 páginas (igual ao baseline) |
| `rg` Google em `src/` | 0 ocorrências |
| `rg` Google em `.next/server`/`.next/static` | 0 ocorrências |
| `package.json`/`package-lock.json` | hashes inalterados |

## Prova HTTP real (`next start -p 3123`)

- 10/10 WOFF2: **200**, `Content-Type: font/woff2`, `Content-Length` = bytes do manifesto, SHA-256 recebido = manifesto.
- `/` e `/login`: **200**, HTML sem `fonts.googleapis|fonts.gstatic`.
- CSS servido: 18 `@font-face`, 10 `url(/fonts/...)` distintos, **0** origine externa.
- Servidor encerrado; portas 3123/3124 liberadas; sem processos órfãos.

## Screenshots e viewport mobile

As capturas antigas `evidence/before|after/*-390.png` usavam `--window-size` e não
correspondiam ao viewport de layout; os arquivos foram **substituídos no mesmo caminho** por
capturas CDP em `evidence/viewport/before|after/` com `Emulation.setDeviceMetricsOverride`
(390×844, DPR 1, mobile). Medições efetivas antes e depois: `innerWidth=390`, `clientWidth=390`,
`scrollWidth=390`, `body.scrollWidth=390`, DPR=1, `visualViewport.width=390` — **sem overflow
horizontal**. O corte anterior era artefato da captura, não regressão de CSS. Desktop
(landing `1440/1425/1425`, login `1440/1440/1440`) também sem overflow.

## Carregamento antes/depois (laboratório local)

Baseline reconstruído em worktree temporária no commit `b898f581`; 3 execuções por página
com Edge headless e cache limpo. Medianas: FCP/LCP landing **152→140 ms**, login
**152→92 ms**; CLS ~**0,002** em ambos; zero requisições a origem Google depois. A
transferência medida do baseline omite os WOFF2 cross-origin (sem `Timing-Allow-Origin`);
somando os mesmos arquivos (hashes idênticos), fica ~**378,7 KB antes × 377,2 KB depois** na
landing. São medições de laboratório em `localhost`, sem promessa de ganho de ranking.
Detalhes em `evidence/verification.md` §9.

## Limitações registradas

- **Telas autenticadas** (shell, `/dashboard`, `/configuracoes`, admin) não foram capturadas automaticamente — dependem do checklist de aceite visual humano em `evidence/verification.md`.
- **Lint** executa com exit 0 mas não cobre TypeScript (limitação preexistente, não corrigida).
- **Fonte realmente rasterizada (correção):** a primeira sondagem leu por engano o `<h1>Vendeo</h1>` do shell. A verificação correta usa `CSS.getPlatformFontsForNode`: `h1.font-heading` “Entrar na sua conta” → **Poppins / Poppins-Bold (19 glifos)**; parágrafo do login → **Open Sans / Open-Sans (33)**; `main h1` da landing → **Poppins-Bold (67/68)**; `main p` → **Open Sans-Medium (69/68)**. Resultado idêntico antes/depois, com `isCustomFont:true`; `document.fonts.check` também **true** para acentos/`ç`/`ñ`/`¿`/`¡`/`₲`/`R$`/`€`, zero Google e zero downloads duplicados. Registro em `evidence/verification.md` §5.1.
- **Escopo do teste ajustado:** a varredura de `src/` proíbe apenas as origens do Google Fonts, não qualquer `preconnect`; a conferência dos links removidos no layout permanece. Antes o teste era amplo demais e poderia rejeitar uma pré-conexão legítima futura para outro serviço.
- Comparação before/after sem pixel-diff automatizado (não há dependência).

## Observação de escopo

`design-system/**` e `openspec/design-system/MASTER.md` contêm `@import` do Google Fonts em **documentos de referência**, não em runtime. **Não editados** nesta quick.

## Status

**Aguardando aceite visual humano.** Nenhum merge, push, deploy, tag, migration ou escrita em banco; nenhuma dependência nova.

## Self-Check: PASSED

- Arquivos criados presentes (fonts.css, manifest, teste, PROVENANCE, SUMMARY).
- Commits verificados: `6e3d89db`, `aea208a3`, `f1e6debd`, `b402cae8`.
- `git diff --check b898f58..HEAD`: limpo no código; dois avisos apenas em conteúdo não-código — whitespace dentro do texto oficial `OFL-Poppins.txt` (preservado verbatim por ser licença) e linha em branco ao fim de `evidence/glyph-probe-dom.html` (saída gerada do probe).
- `PLAN.md` e `SUMMARY.md` permanecem não commitados (commit documental é do orquestrador).
