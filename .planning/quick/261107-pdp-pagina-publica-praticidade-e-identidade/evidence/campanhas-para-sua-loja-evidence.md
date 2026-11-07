# Evidências — `/campanhas-para-sua-loja`

Data: 2026-11-07.
Branch: `perf/quick-pagina-demonstracao-praticidade`.
Build local de produção (`next build` + `next start`), sem autenticação real, sem
clique no Google e sem chamada paga.

## 1. Assets finais

| Asset | Variante | Dimensão | Peso |
|---|---|---|---|
| `foto-racao-confiance` | 480w | 480×440 | 30.706 B |
| `foto-racao-confiance` | 1024w | 1024×939 | 93.040 B |
| `campanha-racao-confiance-bicho-fofo` | 480w | 480×480 | 49.974 B |
| `campanha-racao-confiance-bicho-fofo` | 1024w | 1024×1024 | 142.336 B |
| `foto-cama-pet-comfort` | 480w | 480×720 | 65.324 B |
| `foto-cama-pet-comfort` | 1024w | 1024×1536 | 222.772 B |
| `campanha-cama-pet-comfort-bicho-fofo` | 480w | 480×853 | 98.134 B |
| `campanha-cama-pet-comfort-bicho-fofo` | 1024w | 1024×1820 | 310.366 B |

Os oito arquivos são WebP, preservam a proporção do original, não sofreram crop
nem upscale e pesam menos que o original correspondente. As fontes estão em
`evidence/source/`; os originais em `Downloads` permanecem intactos.

## 2. Seleção de imagem pelo navegador

| Estado | Viewport | DPR | `currentSrc` observado |
|---|---|---|---|
| Aberto | 1440×900 | 1 | 480w em todas as quatro imagens |
| Aberto | 834×1112 | 1 | 480w em todas as quatro imagens |
| Aberto | 390×844 | 1 | 480w em todas as quatro imagens |
| Aberto | 390×844 | 3 | 1024w em todas as quatro imagens |
| Fechado | 1440×900 | 1 | 480w em todas as quatro imagens |
| Fechado | 834×1112 | 1 | 480w em todas as quatro imagens |
| Fechado | 390×844 | 1 | 480w em todas as quatro imagens |
| Fechado | 390×844 | 3 | 1024w em todas as quatro imagens |

O caso 1 usa `loading="eager"` e o caso 2 usa `loading="lazy"` com
`decoding="async"`. Nenhuma imagem recebeu `fetchpriority="high"`.

## 3. Dimensões renderizadas e recorte

| Caso | Viewport | Foto renderizada | Campanha renderizada | `object-fit` |
|---|---|---|---|---|
| Ração 1:1 | 1440 | 450×412,5 | 450×450 | `contain` |
| Ração 1:1 | 834 | 355×325,41 | 355×355 | `contain` |
| Ração 1:1 | 390 | 340×311,66 | 340×340 | `contain` |
| Cama 9:16 | 1440 | 298×448 | 268×478 | `contain` |
| Cama 9:16 | 834 | 298×448 | 268×478 | `contain` |
| Cama 9:16 | 390 | 340×511 | 340×606 | `contain` |

A campanha 9:16 mantém proporção ≈0,5606–0,5610 (9/16 = 0,5625) e aparece
inteira, sem recorte, em desktop, tablet e mobile.

## 4. LCP, CLS e overflow

| Estado | Viewport | LCP local | Elemento LCP | CLS | Overflow horizontal |
|---|---|---|---|---|---|
| Aberto | 1440×900 | 576 ms | H1 | 0,0007 | 0 px |
| Aberto | 834×1112 | 40 ms | H1 | 0 | 0 px |
| Aberto | 390×844 | 28 ms | parágrafo de abertura | 0 | 0 px |
| Aberto | 390×844 (DPR 3) | 24 ms | parágrafo de abertura | 0 | 0 px |
| Fechado | 1440×900 | 484 ms | H1 | 0,0007 | 0 px |
| Fechado | 834×1112 | 36 ms | campanha da ração (480w) | 0,0043 | 0 px |
| Fechado | 390×844 | 32 ms | parágrafo de abertura | 0 | 0 px |
| Fechado | 390×844 (DPR 3) | 28 ms | parágrafo de abertura | 0 | 0 px |

Medição local via CDP/Chrome headless, não PageSpeed. O vencedor de LCP varia
entre H1, parágrafo de abertura e a campanha da ração; por isso nenhuma imagem
recebeu prioridade alta automática.

Alturas de documento observadas: 3.995 px (desktop aberto), 3.900 px (tablet
aberto), 5.770 px (mobile aberto) e 3.907/3.812/5.702 px no estado fechado.

## 5. CTAs, oferta e flags

| Verificação | Estado aberto | Estado fechado |
|---|---|---|
| Grupo de abertura | modo âncora | modo âncora |
| Âncora da abertura | `#campanhas-oferta` | `#campanhas-oferta` |
| Google real no card final | presente, não clicado | ausente (esperado) |
| E-mail do card final | `/signup` | ausente (esperado) |
| “Conheça o Vendeo” | `/` | `/` |
| Card de oferta | 1 | 1 |
| ID do card | `campanhas-oferta` | `campanhas-oferta` |
| Botão “Copiar” | ausente | ausente |
| `R$` no texto HTML | ausente | ausente |
| “começar do zero”/“tela em branco” | ausente | ausente |
| Erros de console | 0 | 0 |

## 6. SEO local (fail-closed)

- HTTP 200 na rota.
- `X-Robots-Tag: noindex, nofollow`.
- `robots` no HTML: `noindex, nofollow`.
- Canonical de produção ausente.
- `sitemap.xml` vazio (esperado fora de produção válida).
- `robots.txt` sem sitemap divergente.
- Título aprovado presente no HTML.

O cenário de produção válida é coberto por teste, não por este runtime local.

## 7. Capturas

Estado aberto:

- `open-desktop-1440.png` e `open-desktop-1440-full.png`
- `open-tablet-834.png` e `open-tablet-834-full.png`
- `open-mobile-390.png` e `open-mobile-390-full.png`
- `open-mobile-390-dpr3.png` e `open-mobile-390-dpr3-full.png`

Estado fechado:

- `closed-desktop-1440.png` e `closed-desktop-1440-full.png`
- `closed-tablet-834.png` e `closed-tablet-834-full.png`
- `closed-mobile-390.png` e `closed-mobile-390-full.png`
- `closed-mobile-390-dpr3.png` e `closed-mobile-390-dpr3-full.png`

## 8. Gates executados

| Gate | Resultado |
|---|---|
| Testes focados | 140/140 em 7 arquivos |
| Suíte local | 8.171 passed, 10 skipped, 653 arquivos |
| Typecheck | exit 0 |
| Lint | exit 0 (sem cobertura TS, limitação preexistente) |
| Build | exit 0, 98/98 páginas, rota `○ /campanhas-para-sua-loja` 2,3 kB / 174 kB |
| OpenSpec change | `--strict` válido antes do archive |
| OpenSpec specs afetadas | `campanhas-para-sua-loja-demonstration-page` e `seo-discovery-foundation` válidas com `--strict` |
| OpenSpec archive | change arquivada em 2026-11-07 |
| Diff check | limpo |

## 9. Polimento visual — distribuição e alinhamento

A faixa de rótulos reserva a mesma altura nos dois lados de cada caso (`min-h-8`,
com `items-start`). O rótulo da campanha 9:16 pode continuar quebrando em duas
linhas sem empurrar a imagem para baixo.

No desktop/tablet, a grade das demonstrações passou a dimensionar as colunas pela
largura real das imagens:

- caso 1: duas colunas de até 452 px;
- caso 2: coluna de 300 px para a foto e 270 px para a campanha 9:16;
- grupo centralizado na seção;
- seta com espaçamento equivalente dos dois lados.

A seta agora é centralizada na área das imagens, não na faixa de rótulos: o
`padding-top` de 44 px corresponde exatamente à faixa (`min-h-8` + `mb-3`).

| Viewport | Topo das imagens — caso 1 | Topo das imagens — caso 2 | Vão esquerdo/direito da seta | Centro da seta / centro das imagens |
|---|---|---|---|---|
| 1440×900 | 813 / 813 | 1.537 / 1.537 | 25 / 25 px (caso 1); 33 / 33 px (caso 2) | 1.038 / 1.038; 1.776 / 1.776 |
| 834×1112 | 813 / 813 | 1.478 / 1.478 | 25 / 25 px (caso 1); 33 / 33 px (caso 2) | 990,5 / 990,5; 1.717 / 1.717 |
| 390×844 | 939 / 1.368,66 — empilhado | 2.058,66 / 2.687,66 — empilhado | — | — |

Larguras renderizadas: 450×412,5 e 450×450 no caso 1 em 1440; 298×448 e 268×478
no caso 2 em 1440. As proporções e o `object-contain` foram preservados.

Ajustes de texto:

- títulos das demonstrações passaram de `max-w-2xl` para `max-w-4xl`; no desktop
  os dois títulos ficam em uma linha (896 px de largura);
- descrições dos casos e frase de identidade passaram para `max-w-3xl`;
- abertura passou para `max-w-3xl` (768 px);
- título e parágrafo da rotina passaram para `max-w-3xl`;
- kit e card de oferta permaneceram nas larguras anteriores.

No mobile, o empilhamento atual foi preservado. Capturas atualizadas:
`layout-desktop-1440-full.png`, `layout-tablet-834-full.png` e
`layout-mobile-390-full.png`.

## 10. Aceite visual

Aceite visual aprovado pelo responsável em **2026-11-07**, nos estados aberto e
fechado, desktop, tablet e mobile. A revisão do Codex foi concluída sem
bloqueantes.

Capturas de referência do aceite:

- `layout-desktop-1440-full.png`
- `layout-tablet-834-full.png`
- `layout-mobile-390-full.png`

## 11. Limitações

- LCP/CLS medidos localmente, não em PageSpeed ou produção.
- jsdom não mede layout real; as capturas e medições CDP cobrem esse ponto.
- O lint do projeto continua sem cobertura de TypeScript.
- O aceite visual humano ainda é necessário; nenhum commit, sync, archive, merge,
  push, deploy ou tag foi executado.
