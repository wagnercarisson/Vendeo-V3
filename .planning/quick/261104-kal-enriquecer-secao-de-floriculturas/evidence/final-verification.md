# Evidências — quick 261104-kal

## 1. Arquivo-fonte preservado

| Item | Valor |
|---|---|
| Original (intacto) | `C:\Users\wagne\Downloads\flor_kalandiva___pote_6-2026-10-31.jpg` |
| Cópia de evidência | `evidence/source/flor_kalandiva___pote_6-2026-10-31.jpg` |
| Dimensões | 1024 × 1024 |
| Formato | JPEG |
| Peso | 242.089 B |
| SHA-256 | `CF0FD93EA12E007CF1F55EDCFF478A6A8FCB26928F69C889537F526F21AA5F91` |

O original em `Downloads` não foi alterado. O JPEG não é servido por `public/`.

## 2. Variantes entregues

| Arquivo | Dimensões | Peso | SHA-256 |
|---|---|---|---|
| `campanha-kalandiva-donna-flor-480w.webp` | 480 × 480 | 43.372 B | `A761128484A263C6B7D4EF09D78AF63186B164D241F8BDA0C510E38D6F603E28` |
| `campanha-kalandiva-donna-flor-1024w.webp` | 1024 × 1024 | 121.074 B | `210A3E2182679A86611DDD3E699BF8398E64C1E0AEEEC06D43B662A632BEF573` |

- Formato: WebP, qualidade 82, sem crop e sem upscale.
- Ambas pesam menos que o original (242.089 B).
- Proporção 1:1 preservada.

## 3. Medições no navegador (CDP)

`measurements.json` contém os dados brutos. Resumo:

| Viewport | Largura do conteúdo | Imagem exibida | `currentSrc` | Overflow horizontal | Avisos | Cards | IDs |
|---|---|---|---|---|---|---|---|
| 1440 × 900, DPR 1 | 1425 px | 468 × 468 | `...-480w.webp` | 0 px (`scrollWidth` = `clientWidth` = 1425) | 1 | 1 | 7/7 únicos |
| 390 × 844, DPR 1 | 390 px | 342 × 342 | `...-480w.webp` | 0 px (390 = 390) | 1 | 1 | 7/7 únicos |
| 390 × 844, DPR 3 | 390 px | 342 × 342 | `...-1024w.webp` | 0 px (390 = 390) | 1 | 1 | 7/7 únicos |

- Altura da seção enriquecida: 812 px no desktop e 970 px no mobile.
- No desktop, o bloco textual fica centralizado verticalmente em relação à imagem,
  com linhas à esquerda e sem altura forçada. No mobile, a ordem é título → lista
  → subtítulo → parágrafo → imagem → aviso.
- O exemplo fica abaixo da abertura e carrega com `loading="lazy"`; o par da
  orquídea continua `eager`.
- Em DPR 3 o navegador escolhe a variante de 1024 px. Não há upscale: 1024 px é o
  limite do original. A leitura do preço e da condição foi conferida na captura
  mobile.
- `textHasPrice: false` nas três medições: “R$” não aparece como texto do HTML.

## 4. Preservações verificadas em runtime

- Um único card de oferta (`[data-offer-card]`), no encerramento.
- Grupo da abertura: modo `anchor`, com `#floriculturas-oferta` e `/`.
- Grupo do encerramento: modo `real`, com `/#acesso` e `/`.
- Aviso demonstrativo único, depois da campanha Kalandiva e do par da orquídea.
- Nenhum ID duplicado.

## 5. Capturas

| Arquivo | Conteúdo |
|---|---|
| `floriculturas-desktop-1440.png` | página inteira, desktop |
| `floriculturas-mobile-390.png` | página inteira, mobile |
| `floriculturas-example-desktop-1440.png` | recorte do bloco enriquecido, desktop |
| `floriculturas-example-mobile-390.png` | recorte do bloco enriquecido, mobile |
| `floriculturas-example-mobile-390-dpr3.png` | recorte do bloco, mobile em DPR 3 |

## 6. Gates

| Gate | Resultado |
|---|---|
| Testes focados | 3 arquivos / 38 testes, exit 0 |
| Suíte local completa | 617 arquivos / 7.717 testes passed, 10 skipped, exit 0 |
| Typecheck | exit 0 |
| Lint | exit 0 (limitação declarada: ESLint atual não cobre TypeScript) |
| Build (`npm run build`) | exit 0 após o ajuste final de alinhamento |
| OpenSpec change | valid (`--strict`) |
| OpenSpec spec afetada | valid (`--strict`) |
| `git diff --check` | limpo |

## 7. Limitações

- jsdom não mede layout real; as medições de largura/overflow vêm do CDP.
- Lint não cobre TypeScript neste repositório.
- `openspec validate --all --strict` mantém 69 falhas legadas preexistentes; não
  foram introduzidas por esta quick.
- Aceite visual humano ainda pendente.
