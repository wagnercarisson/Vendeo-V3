---
quick_id: 261104-kal
slug: enriquecer-secao-de-floriculturas
status: complete
date: 2026-11-04
accepted_on: 2026-11-04
branch: perf/comunicacao-de-oferta-nas-paginas
base_commit: 2175cc8a
openspec_change: enriquecer-exemplos-floriculturas
openspec_archive: openspec/changes/archive/2026-11-04-enriquecer-exemplos-floriculturas
visual_checkpoint: approved
commit: 0a4541a8
---

# Summary — 261104-kal

Implementação concluída e **aceite visual aprovado em 2026-11-04**. Quick
verificada via OpenSpec, sincronizada e arquivada na branch; **não publicada**.
Sem merge, push, deploy ou tag.

## Decisões aprovadas

- **D1:** original copiado para `evidence/source/`, mantendo `Downloads` intacto.
- **D2:** aviso demonstrativo único movido para depois da campanha Kalandiva, sem
  mudança de texto.
- **D3:** variantes 480w + 1024w, `sizes` reconciliado com a medição real. Em DPR 3
  a resolução é limitada pelo original de 1024 px, sem upscale.
- **D4:** alt descritivo sem repetir o valor; o caráter demonstrativo do preço vem
  do contexto e do aviso, não do formato de entrega.
- **Composição:** lista com marcadores simples sob o título; no desktop, texto à
  esquerda e imagem à direita, com o bloco textual centralizado verticalmente e
  linhas à esquerda; no mobile, título → lista → subtítulo → parágrafo → imagem →
  aviso.
- **Texto do exemplo:** um único parágrafo, preservando as duas frases aprovadas.

## Resultado

- Parágrafo do bloco “Crie posts para sua floricultura sem começar do zero.”
  substituído por uma lista de três itens com marcadores simples.
- Um único exemplo complementar: subtítulo, parágrafo único e campanha da Flor
  Kalandiva, integral, sem recorte.
- Apoio do encerramento trocado por “Suas flores, sua marca, uma campanha pronta
  para divulgar.”, sem acumular a frase anterior.
- Aviso demonstrativo único ao fim do bloco enriquecido.
- Novo `offer-example.tsx`, contrato `KALANDIVA_IMAGE` e duas variantes WebP.
- Home, oferta, acesso, card único, âncora, CTAs, metadata, canonical, sitemap,
  fontes e header/footer preservados.

## Assets

| Arquivo | Dimensões | Peso |
|---|---|---|
| `campanha-kalandiva-donna-flor-480w.webp` | 480 × 480 | 43.372 B |
| `campanha-kalandiva-donna-flor-1024w.webp` | 1024 × 1024 | 121.074 B |

Original preservado: 1024 × 1024, 242.089 B, SHA-256
`CF0FD93EA12E007CF1F55EDCFF478A6A8FCB26928F69C889537F526F21AA5F91`.

## Medições

| Viewport | Imagem | `currentSrc` | Overflow |
|---|---|---|---|
| 1440 × 900, DPR 1 | 468 × 468 | 480w | 0 px |
| 390 × 844, DPR 1 | 342 × 342 | 480w | 0 px |
| 390 × 844, DPR 3 | 342 × 342 | 1024w | 0 px |

Um card, um aviso, 7 IDs únicos e `R$` ausente do texto HTML nas três medições.

## Gates

| Gate | Resultado |
|---|---|
| Focados | 3 arquivos / 38 testes |
| Suíte local | 617 arquivos / 7.717 testes passed, 10 skipped |
| Typecheck | 0 |
| Lint | 0 (sem cobertura TS) |
| Build | exit 0 |
| OpenSpec change/spec | valid (`--strict`) |
| `git diff --check` | limpo |

## Evidências

`.planning/quick/261104-kal-enriquecer-secao-de-floriculturas/evidence/`:
`final-verification.md`, `measurements.json`, `visual-acceptance.md`,
`source/` e cinco capturas (página inteira desktop/mobile e recortes do bloco,
incluindo mobile em DPR 3).

## Pendência

Nenhuma funcional. Merge, push, deploy e tag ficam com o responsável.

## Aceite e fechamento

- Aceite visual aprovado pelo responsável em 2026-11-04: lista de três itens,
  parágrafo único centralizado verticalmente ao lado da Kalandiva no desktop e
  empilhamento aprovado no mobile.
- OpenSpec verificado em `261104-kal-OPENSPEC-VERIFY.md`: 25/25 tasks, 5
  requisitos MODIFIED, sem issues críticas ou bloqueantes.
- Change sincronizada e arquivada em
  `openspec/changes/archive/2026-11-04-enriquecer-exemplos-floriculturas/`.
- Quick concluída, verificada, sincronizada e arquivada na branch; não publicada.
- Commit de implementação: `0a4541a8` (código, testes e assets). Fechamento
  documental no commit seguinte.
