# Quick 261109-mrc — Evidências de implementação e validação local

**Data:** 2026-11-09
**Branch:** `perf/pagina-oferta-mercearia`
**Status:** implementação concluída localmente, aguardando aceite visual. Sem commit.

## 1. Gates

| Gate | Resultado |
|---|---|
| Testes focados | **148/148 passed** em 7 arquivos |
| Suíte local | **8326 passed, 10 skipped, 5 failed** — falhas preexistentes/intermitentes, não relacionadas (ver §2) |
| Typecheck | exit 0 |
| Lint | exit 0; ESLint atual não cobre TypeScript (limitação já registrada) |
| Build | exit 0; 100/100 páginas; `/ofertas-para-mercados` estática |
| `git diff --check` | limpo |
| OpenSpec | `npx openspec validate ofertas-para-mercados --strict` → change válida |

## 2. Falhas da suíte local — classificação

As 5 falhas não foram introduzidas por esta entrega e não tocam os arquivos
alterados:

1. `src/components/landing/__tests__/landing-page.test.tsx` — 1 falha preexistente.
   O teste usa `getByRole("navigation")` singular, mas o rodapé compartilhado já
   possui dois `nav` (Explore o Vendeo e Institucional) desde a quick `261108-j3p`.
   A falha foi registrada como conhecida em STATE antes desta rodada.
2. `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` — 3 falhas
   preexistentes do guard de fronteira legada, também registradas em STATE.
3. `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx`
   — 1 falha intermitente, não reproduzida em todas as execuções desta rodada e
   não relacionada aos arquivos alterados.

## 3. Capturas

As capturas estão em `evidence/`:

| Arquivo | Conteúdo |
|---|---|
| `closed-desktop-1440.png` | página inteira, flag fechada, 1440×900 |
| `closed-tablet-834.png` | página inteira, flag fechada, 834×1112 |
| `closed-mobile-390.png` | página inteira, flag fechada, 390×844 |
| `open-desktop-1440.png` | página inteira, flag aberta, 1440×900 |
| `open-tablet-834.png` | página inteira, flag aberta, 834×1112 |
| `open-mobile-390.png` | página inteira, flag aberta, 390×844 |
| `open-mobile-390-viewport.png` | viewport inicial, flag aberta, 390×844 |
| `open-mobile-390-pair.png` | par foto/campanha, flag aberta, 390×844 |
| `closed-measurements.json` | medições da flag fechada |
| `open-measurements.json` | medições da flag aberta |

**Nota de captura:** a flag é resolvida no build da página estática. Como
`.env.local` está com `VENDEO_PUBLIC_SIGNUP_ENABLED=true`, o build de produção
materializa a flag aberta. A flag fechada foi capturada com `next dev` e
`VENDEO_PUBLIC_SIGNUP_ENABLED=false` apenas no processo, sem alterar `.env.local`
nem qualquer arquivo de ambiente. A flag aberta foi capturada novamente contra o
build de produção. O build final foi refeito com a configuração original.

## 4. Medições

### Flag fechada

| Viewport | Overflow | Foto | Campanha | Café | LCP observado |
|---|---:|---|---|---|---|
| 1440×900, DPR1 | 0 px | 360×240,66; 480w | 480×480; 480w | 468×468; 480w, lazy | IMG (campanha) |
| 834×1112, DPR1 | 0 px | 306×204,66; 480w | 408×408; 480w | 373×373; 480w, lazy | IMG (campanha) |
| 390×844, DPR1 | 0 px | 342×228,66; 480w | 342×342; 480w | 342×342; 480w, lazy | P |
| 390×844, DPR3 | 0 px | 342×228,77; 1024w | 342×342; 1024w | 342×342; 1024w, lazy | P |

### Flag aberta

| Viewport | Overflow | Foto | Campanha | Café | LCP observado |
|---|---:|---|---|---|---|
| 1440×900, DPR1 | 0 px | 360×240,66; 480w | 480×480; 480w | 468×468; 480w, lazy | IMG (campanha) |
| 834×1112, DPR1 | 0 px | 306×204,66; 480w | 408×408; 480w | 373×373; 480w, lazy | IMG (campanha) |
| 390×844, DPR1 | 0 px | 342×228,66; 480w | 342×342; 480w | 342×342; 480w, lazy | P |
| 390×844, DPR3 | 0 px | 342×228,77; 1024w | 342×342; 1024w | 342×342; 1024w, lazy | P |

Conclusões:

- `sizes` reconciliados: 360 px e 480 px no desktop; 306 px e 408 px no tablet;
  342 px no mobile. Nenhum `sizes` ficou abaixo da largura renderizada.
- A foto de entrada ficou menor e centralizada; a campanha ganhou destaque, sem
  crop ou distorção.
- Nenhuma imagem sofre upscale; DPR3 usa 1024w quando necessário.
- Nenhuma imagem recebe `fetchpriority="high"`.
- O LCP passou a ser a campanha no desktop e no tablet, e um parágrafo no mobile.
  A prioridade não foi alterada nesta rodada.
- A página inteira e o par no mobile foram capturados sem área vazia; a foto
  aparece integralmente em `open-mobile-390.png` e `open-mobile-390-pair.png`.

## 5. Inspeção visual

- Foto 3:2 com no máximo 360 px e campanha 1:1 com no máximo 480 px,
  integralmente visíveis, sem `object-cover`.
- Foto verticalmente centralizada; campanha em destaque.
- Rótulo “Foto do produto” imediatamente acima da foto, acompanhando a
  centralização vertical; “Campanha criada com o Vendeo” permanece no topo da
  coluna. Não há vazio entre o rótulo da foto e a imagem.
- Seta centralizada entre as áreas visuais; não considera os rótulos.
- Títulos com `text-balance` e parágrafos com `text-pretty`; sem palavras
  isoladas, redução de fonte, quebras manuais ou `nowrap`.
- O card do kit acompanha a coluna `max-w-3xl`; o alargamento foi revisado e
  aceito explicitamente. A copy do kit permanece exata, mas a largura anterior
  não é declarada como preservada.
- Explicação consolidada única após o par; o texto antigo de apoio não existe.
- Kit em HTML, com título, legenda, quatro hashtags e chamada exatos.
- Café como exemplo complementar, texto antes da imagem no mobile.
- Aviso único após o café.
- Card único no encerramento; Google/e-mail reais somente no card aberto.
- Rodapé com os quatro destinos e `aria-current` correto.

## 6. Assets

| Arquivo | Dimensões | Peso |
|---|---:|---:|
| `public/mercados/foto-coxao-mole-acougue-480w.webp` | 480×320 | 37.460 B |
| `public/mercados/foto-coxao-mole-acougue-1024w.webp` | 1024×683 | 143.740 B |
| `public/mercados/campanha-coxao-mole-tio-joao-480w.webp` | 480×480 | 47.820 B |
| `public/mercados/campanha-coxao-mole-tio-joao-1024w.webp` | 1024×1024 | 153.180 B |

Originais preservados em `evidence/source/`, com SHA-256 registrado no
diagnóstico. O café reutiliza `hero-oferta-cafe-480w.webp` e o WebP base
`hero-oferta-cafe.webp` (1024×1024), já existentes.
