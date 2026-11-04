# Verificação final — `/padarias`

Data: 2026-11-04. Branch: `feat/pagina-publica-padarias`.

## Gates

| Gate | Resultado |
|---|---|
| Testes focados | 6 arquivos / 123 testes passed |
| Suíte local | 620 arquivos passed, 2 skipped; 7.768 testes passed, 10 skipped; 0 failed |
| Typecheck | exit 0 |
| Lint | exit 0 (sem cobertura TypeScript, limitação preexistente) |
| Build | exit 0; `/padarias` listada como estática |
| OpenSpec | `pagina-publica-demonstrativa-padarias` válida em `--strict` |
| `git diff --check` | limpo |

## HTML compilado — local (fail-closed)

`GET /padarias` em `next start` local:

- status `200`;
- title `Crie posts e campanhas para padarias com IA | Vendeo`;
- H1 aprovado presente;
- canonical ausente;
- `robots` meta `noindex, nofollow`;
- `X-Robots-Tag: noindex, nofollow`;
- `sitemap.xml` com 0 URLs;
- `robots.txt` sem `Sitemap:`;
- 1 aviso demonstrativo visível;
- 1 card de oferta;
- 2 grupos de acesso;
- nenhum JSON-LD, nenhum `R$`, nenhuma chamada a `/api/`;
- flag fechada: “Solicitar acesso gratuito” presente, sem `/signup`.

## HTML compilado — produção simulada

Build com `VERCEL_ENV=production` e `NEXT_PUBLIC_SITE_URL=https://vendeo.tech`:

- canonical `https://vendeo.tech/padarias`;
- `robots` meta `index, follow`;
- sem `X-Robots-Tag` de noindex;
- `sitemap.xml` com 3 URLs (`/`, `/floriculturas`, `/padarias`);
- `robots.txt` com referência ao sitemap;
- mesmas contagens de conteúdo da verificação local.

## Pesos finais

| Asset | Dimensão | Peso |
|---|---:|---:|
| `foto-bolo-naked-fruit-480w.webp` | 480×480 | 47.092 B |
| `foto-bolo-naked-fruit-1024w.webp` | 1024×1024 | 148.506 B |
| `campanha-bolo-naked-fruit-dona-maria-480w.webp` | 480×480 | 53.818 B |
| `campanha-bolo-naked-fruit-dona-maria-1024w.webp` | 1024×1024 | 167.548 B |
| `campanha-pao-frances-fresquinho-dona-maria-480w.webp` | 480×480 | 49.412 B |
| `campanha-pao-frances-fresquinho-dona-maria-1024w.webp` | 1024×1024 | 143.952 B |

Todos os WebP são menores que os originais correspondentes (1.877.770 B /
291.804 B / 266.104 B), com proporção 1:1 e sem upscale.

Os três originais foram preservados em `evidence/source/` com hashes conferidos:

| Arquivo | SHA-256 |
|---|---|
| `foto-bolo-naked-fruit-original.png` | `5A5C9E9FA84A5CADE10976D1955F0B5B95DC94B2B1995D2D1E3E80D6497E07DD` |
| `campanha-bolo-naked-fruit-dona-maria-original.jpg` | `A93C71549B02CA4D7320D87D17283F2FC3490ACB67CE3E4E9A4896BFFDAA1986` |
| `campanha-pao-frances-fresquinho-dona-maria-original.jpg` | `F2678AC814EAE46E9B27589AB3F9964A5610EDB3D58FF6EA33B9D47A57E6DF05` |

## Medições no navegador

| Cenário | Imagem | CSS | `currentSrc` | Overflow | LCP |
|---|---|---:|---|---:|---|
| Desktop 1440 DPR1 | foto do bolo | 452×452 | 480w | 0 | H1 |
| Desktop 1440 DPR1 | campanha do bolo | 450×450 | 480w | 0 | H1 |
| Desktop 1440 DPR1 | campanha do pão | 468×468 | 480w | 0 | H1 |
| Tablet 834 DPR1 | foto do bolo | 349,5×349,5 | 480w | 0 | H1 |
| Tablet 834 DPR1 | campanha do bolo | 347,5×347,5 | 480w | 0 | H1 |
| Tablet 834 DPR1 | campanha do pão | 365,5×365,5 | 480w | 0 | H1 |
| Mobile 390 DPR1 | foto do bolo | 320×320 | 480w | 0 | H1 |
| Mobile 390 DPR1 | campanha do bolo | 318×318 | 480w | 0 | H1 |
| Mobile 390 DPR1 | campanha do pão | 342×342 | 480w | 0 | H1 |
| Mobile 390 DPR3 | foto do bolo | 320×320 | 1024w | 0 | H1 |
| Mobile 390 DPR3 | campanha do bolo | 318×318 | 1024w | 0 | H1 |
| Mobile 390 DPR3 | campanha do pão | 342×342 | 1024w | 0 | H1 |

O `sizes` foi mantido: é exato em 1024+ e mobile e conservador em tablet (~2% de
headroom), sem underfetch. Nenhuma imagem recebeu `fetchpriority="high"`; o LCP
medido foi o H1 em todos os cenários.

## Flags

- Servidor fechado (`VENDEO_PUBLIC_SIGNUP_ENABLED=false`): abertura com
  “Solicitar acesso gratuito”, card com `/#acesso`, sem `/signup`, sem Google.
- Servidor aberto (`VENDEO_PUBLIC_SIGNUP_ENABLED=true`): abertura com Google e
  e-mail em modo âncora local; card final com **botão Google real** (`BUTTON`) e
  e-mail para `/signup`.
- Em nenhuma captura o botão Google foi clicado; nenhuma autenticação foi
  iniciada.

## Capturas

- `closed-desktop-1440.png`
- `closed-tablet-834.png`
- `closed-mobile-390.png`
- `closed-mobile-390-dpr3.png`
- `open-desktop-1440.png`
- `open-tablet-834.png`
- `open-mobile-390.png`

Medições brutas: `measurements.json` e `measurements-open.json`.
