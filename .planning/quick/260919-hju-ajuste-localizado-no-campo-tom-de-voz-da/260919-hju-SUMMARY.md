---
status: complete
quick_id: 260919-hju
description: "Ajuste localizado no campo Tom de Voz da tela /loja (aba Posicionamento): seletor descritivo acessível com 9 opções (incl. 'Popular')"
date: 2026-09-19
---

# Quick Task 260919-hju — Seletor descritivo do Tom de Voz

## Resumo

Substituiu o `<select>` nativo do campo **Tom de Voz** (aba Posicionamento, `/loja`) por um **select-only combobox** acessível (WAI-ARIA APG), sem dependência externa, que apresenta **label + descrição canônica** de cada opção na superfície de escolha e mantém **somente o label** no trigger fechado. Adicionou a **9ª opção "Popular"** (`popular`, "Simples, acessível e próxima do dia a dia.") e uma ação **"Limpar seleção"** para voltar ao valor vazio.

## Tasks concluídas (3)

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 | `a30135a0` | Conteúdo (9ª opção + `TONE_OF_VOICE_OPTIONS` fonte única) + componente `tone-of-voice-select.tsx` + teste do componente (18 testes) |
| 2 | `a4d416e3` | Substituir `<select>` no form + co-migrar 3 testes (orientation + 2 field-guidance) + limpeza de resíduos "8 opções" |
| 3 | `ea53a58f` | Sincronizar 3 specs canônicas (contextual-field-help, store-field-orientation, store-identity-ui) |

## Comportamento entregue

- **9 opções** (`profissional, popular, moderno, elegante, divertido, acolhedor, jovem, tradicional, luxuoso`), cada uma com label + descrição canônica.
- As **8 descrições F49 preservadas**; a nona é nova e aguarda validação editorial na UAT.
- Combobox APG: `<input readOnly role="combobox">` (nome "Tom de Voz" e valor "Popular" anunciados separadamente), `aria-expanded`/`aria-controls`/`aria-activedescendant`, foco no combobox, `aria-selected` (sem `aria-checked`).
- Teclado: ArrowDown/ArrowUp/Enter/Espaço abrem; setas movem; Home/End; Enter/Espaço seleciona; Escape fecha e devolve foco.
- Typeahead com buffer multi-caractere + ciclo ("po"→Popular, "pr"→Profissional, "p" repetido alterna).
- Ponteiro: clique/toque no combobox alterna; clique externo fecha (sem `focusout`); `onMouseDown.preventDefault()` mantém foco.
- Viewport móvel: altura real calculada (`min(320, espaçoDoLado - margem)`), lado com maior espaço, rolagem interna.
- "Limpar seleção" fora do `<label>`, `min-h-[44px]`, restaura `needs_tone_of_voice`.

## Preservado (fences)

`formData.tone_of_voice`/`setField`, autosave/draft/persistência, `needs_tone_of_voice` (`tabs.ts`/`reason-text.ts`), banco/APIs/snapshot/consumidores (string, sem migration), prompts/gateway/IA, e as 8 descrições F49. **Sem** migration, sem dependência nova.

## Gates

- `vitest run`: **3681 passed / 1 skipped** (346 arquivos).
- `tsc` (typecheck): limpo.
- `eslint .`: limpo.
- `next build`: sucesso.

## Pendência pós-execução

UAT manual (responsiva 320/375/desktop + Android/TalkBack + iOS/VoiceOver) e **validação editorial da nona descrição "Popular"** — registrar em `260919-hju-UAT.md`.
