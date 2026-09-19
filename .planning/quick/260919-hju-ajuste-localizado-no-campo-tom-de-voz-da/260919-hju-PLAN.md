# Quick Task 260919-hju — Seletor descritivo do Tom de Voz (`/loja`, aba Posicionamento)

**Data:** 2026-09-19 (revisado após 2ª rodada de parecer)
**Modo:** GSD Quick (planejamento apenas — NÃO executar nesta rodada)
**Diretório:** `.planning/quick/260919-hju-ajuste-localizado-no-campo-tom-de-voz-da/`
**Status:** Aguardando revisão humana final (3ª rodada)

> **Propósito desta execução:** produzir o plano completo revisado e PARAR. Não implementar, não migrar, não instalar dependências, não commitar código.

---

## 0. Escopo ampliado (aprovado): 9ª opção "Popular"

Foi aprovada uma **nona** opção de Tom de Voz:

| Campo | Valor |
|---|---|
| `value` | `popular` |
| `label` | `Popular` |
| descrição canônica | `Simples, acessível e próxima do dia a dia.` |

**Regras editoriais:**
- A descrição NÃO menciona preço baixo, promoção, público de baixa renda nem associação depreciativa.
- "Popular" = comunicação simples, acessível e cotidiana — distinta de **Acolhedor** (calor/atenção), **Divertido** (humor/descontração), **Jovem** (dinamismo/linguagem atual) e **Profissional** (confiança/objetividade).
- As **8 descrições da F49 permanecem intactas**; **somente** a nona é nova e **aguarda validação editorial na UAT**.

---

## 1. Investigação resumida do estado atual

### Campo atual (`src/components/flow/store-identity-form.tsx`)

- Linhas **58–67**: `TONE_OF_VOICE_OPTIONS` — array local `as const` com as 8 opções `{ value, label }`.
- Linhas **119–130**: ids de ajuda via `useId` (`toneHelpBase` → `toneHintId`, `toneComplementsId`, `toneDescriptionId`); `toneDescription` resolvido **cast-free** via `Object.entries(TONE_OF_VOICE_DESCRIPTIONS).find(...)` (fix ME-02 da F49).
- Linhas **2016–2027**: `<select id="tone_of_voice" ... onChange={e => setField("tone_of_voice", e.target.value)}>` com `<option value="">Selecione</option>` + 8 `<option>`; `aria-describedby = [toneHintId, toneComplementsId, toneDescription ? toneDescriptionId : null]`; três `FieldHint` abaixo (hint, complements, descrição condicional).

### Conteúdo canônico (`src/lib/store-onboarding/field-guidance.ts`)

- `StoreToneOfVoice` (união literal das 8 chaves) — linhas 20–28. **Usado apenas dentro de `field-guidance.ts`** (nenhum import externo do tipo).
- `TONE_OF_VOICE_HINT` (42–43), `TONE_OF_VOICE_COMPLEMENTS_HINT` (49–50).
- `TONE_OF_VOICE_DESCRIPTIONS: Record<StoreToneOfVoice, string>` (53–62).
- `TONE_OF_VOICE_OPTIONS` (labels) NÃO está aqui — duplicada como constante local no form.

### Regras de negócio / contratos intactos

- `formData.tone_of_voice` e `setField` — `use-store-form.ts:39,193` (sem mudança).
- Autosave/draft/persistência — sem mudança.
- `needs_tone_of_voice` — `tabs.ts`/`reason-text.ts` (sem mudança).
- **Consumidores recebem `tone_of_voice` como `string`** (brief, copy mapper, `art-director-briefing.ts` default `"profissional"`, brand-director/profiler/text-only-inference/identity-art-director, snapshot, banco, APIs). Nenhum enumera os 8 valores em runtime — `popular` é aceito **sem migration**.

### Specs canônicas que hoje exigem "descrição após a seleção" (e citam "8 opções")

1. `openspec/specs/contextual-field-help/spec.md` — item 2 do Requirement "Quatro mecanismos…" e Scenario "Descrição contextual da opção selecionada" (16, 28–32).
2. `openspec/specs/store-field-orientation/spec.md` — Requirement "Tom de voz como campo crítico…" (42–64) e Scenario "Descrição contextual por opção selecionada" (54–58).
3. `openspec/specs/store-identity-ui/spec.md` — Delta F49 (205), bullet "→ **Tom de Voz**" (221), Scenario "Tom de Voz orienta e reflete a regra real" (278–282).

### Testes que exigem "exatamente 8" (co-migrar obrigatoriamente)

1. `src/lib/store-onboarding/__tests__/field-guidance.test.ts` — teste "tem exatamente as 8 descrições" (linhas 21–38) fixa as 8 chaves.
2. `src/lib/store-onboarding/__tests__/field-guidance.correspondence.test.ts` — teste "cobre exatamente as 8 opções reais" (35–48) fixa as 8 chaves.
3. `src/components/flow/__tests__/store-identity-form.orientation.test.tsx` — teste "7.3" usa `expect(entries).toHaveLength(8)` (253) e interage com o `<select>` (223, 260).

> Os demais testes usam `tone_of_voice` apenas como **fixture de dados** — sem co-migração adicional.

### Precedente de a11y / libs

- `ExpandableHelp` (`ui/expandable-help.tsx`): região sempre no DOM com `hidden`, `aria-expanded`/`aria-controls` válidos, foco visível, touch ≥44px.
- **Não há** `role="combobox"/"listbox"/"option"` nem lib de a11y (Radix/Headless). `package.json` só tem `lucide-react`. **Nenhuma dependência nova.**

### Follow-up F49 confirmado

"Futura melhoria do seletor de tom de voz" deixada fora da F49: `49-15-SUMMARY.md:123`, `49-VERIFICATION.md:168`, `49-15-PLAN.md:49`, `49-GATES.txt:408`. **Não** alterar esses documentos históricos para trocar "8" por "9".

---

## 2. Decisão técnica recomendada e alternativas rejeitadas

### Padrão ARIA adotado: **select-only combobox** (APG), fiel

Componente local sem dependência `src/components/flow/tone-of-voice-select.tsx`, implementando o **Select-Only Combobox** do W3C APG — *não* botão com `aria-haspopup`, *não* listbox com foco roving.

**Trigger:** `<input id="tone_of_voice" type="text" readOnly role="combobox" aria-autocomplete="none" aria-expanded={open} aria-controls={listboxId} aria-activedescendant={open ? activeId : undefined} aria-describedby={hintIds} />`.

- **Por que `<input readOnly role="combobox">`:** `input` é *labelable* nativo → preserva `<label htmlFor="tone_of_voice">` (nome "Tom de Voz") **e** expõe o **valor** em `value`, de modo que leitores de tela anunciam **"Tom de Voz"** (nome) e **"Popular"** (valor) separadamente. `getElementById("tone_of_voice")` continua funcionando.
- `aria-activedescendant` aponta para o `id` da opção ativa; o **foco DOM permanece no combobox**.
- `aria-selected` é **o único** indicador de seleção nas `role="option"` (seleção única). **Sem** `aria-checked`.
- `hidden` na lista fechada mantém `aria-controls` sempre resolvível.

**Popup:** `<ul role="listbox" id={listboxId} hidden={!open}>` com **9** `<li role="option" id={optionId} aria-selected>` — cada opção mostra `label` (destaque) + `TONE_OF_VOICE_DESCRIPTIONS[value]` (logo abaixo, `whitespace-normal break-words`).

**Teclado (APG Select-Only Combobox):**
- **Fechado:** ArrowDown / ArrowUp / Enter **e Espaço** abrem (Down → primeira/atual; Up → última/atual); Alt+ArrowDown abre; caractere imprimível → typeahead. (Espaço abre no exemplo oficial do APG — **ratificado**, não é decisão pendente.)
- **Aberto:** ArrowDown/ArrowUp movem a ativa (`aria-activedescendant`); Home/End; Enter/Espaço seleciona e fecha; Escape fecha e devolve foco ao combobox.

**Typeahead (com buffer + ciclo — NÃO iniciais únicas):**
- Buffer de múltiplos caracteres com janela de ~500ms entre teclas; matching por **prefixo do label, case-insensitive e sem acento**.
- `"po"` → Popular; `"pr"` → Profissional; letra repetida **cicla** entre correspondências (teclar `p` repetidamente alterna Profissional ↔ Popular de forma previsível).
- Adotado porque a lista tem **9 opções** (>7, recomendação APG) e há iniciais colidindo (`P`).

**Interação de ponteiro e foco (sem conflito `focusout` × clique):**
- **Abertura por ponteiro:** clicar/tocar no combobox **alterna** aberto/fechado (onClick no input). Testado explicitamente.
- Seleção por `onClick` no `<li>`, com `onMouseDown={e => e.preventDefault()}` para o foco não sair do combobox.
- Fechamento por **clique/toque externo**: listener `pointerdown` no `document` (`!rootRef.current?.contains(target)`). **Não** fecha por `focusout` (o foco permanece no combobox e o popup não tem elementos focáveis — evita fechar antes do clique na opção).
- Foco visível: `focus-visible:ring-2`.

**Viewport móvel (popup utilizável em 320×480) — altura real calculada:**
- Posicionamento `absolute left-0 right-0 z-50 w-full`. Ao abrir (`useLayoutEffect`), medir via `getBoundingClientRect()` e `window.innerHeight`:
  1. **espaço abaixo** = `innerHeight - triggerRect.bottom`;
  2. **espaço acima** = `triggerRect.top`;
  3. aplicar uma **margem do viewport** (ex.: `8px` em cada lado);
  4. **escolher o lado com maior espaço útil** (descontada a margem);
  5. **altura máxima real** = `min(320, espaçoDisponívelDoLadoEscolhido - margem)`;
  6. aplicar esse valor calculado ao popup (via `style={{ maxHeight }}`, `top-full mt-1` se abaixo, ou `bottom-full mb-1` se acima).
- **Mínimo utilizável:** se nenhum lado comportar um mínimo (ex.: `MIN = 160px`), usar o lado com maior espaço e rolagem interna — nunca cortar além do viewport.
- `overflow-y-auto overscroll-contain`; `scrollIntoView({ block: "nearest" })` na opção ativa. As **9 opções** alcançáveis por rolagem interna, **sem scroll horizontal**.
- `id`s de listbox/opções derivados de `useId()` (instance-safe, sem colisão).

### "Limpar seleção" (ação separada, no componente PAI)

- A linha do rótulo "Tom de Voz" + a ação **"Limpar seleção"** são renderizadas **diretamente em `store-identity-form.tsx`** (o componente pai), **não** via prop `labelAction`.
- `ToneOfVoiceSelect` fica responsável **somente** pelo combobox/listbox (props: `{ value, onChange, inputId?, ariaDescribedby? }`).
- "Limpar seleção": visível **apenas quando há valor válido selecionado**; `onClick={() => setField("tone_of_voice", "")}`; `min-h-[44px]`; nome acessível "Limpar seleção". Restaura `needs_tone_of_voice`.
- **"Limpar seleção" fica fora do `<label>`** — mesmo que visualmente na mesma linha, é um elemento irmão do `<label>` (não aninhado), evitando interação aninhada (`label` envolve somente o combobox).

### Alternativas rejeitadas

| Alternativa | Rejeitada porque |
|---|---|
| `<select>` nativo com label+descrição | Truncamento mobile + `<option>` inconsistente (vetado). |
| Listbox com foco roving nos `<li>` (button trigger) | Botão não expõe valor como combobox; `aria-activedescendant` resolve nome×valor (parecer). |
| Botão com `aria-haspopup="listbox"` | Mesma imprecisão. |
| Componente genérico em `ui/` | Abstração prematura (vetado). |
| Adicionar `@radix-ui/react-select` | Dependência nova para um único campo (vetado). |
| Reescrever prompts p/ "popular" | Fora de escopo: prompts já recebem valores não enumerados (Acolhedor/Divertido/Jovem/Tradicional/Luxuoso); `popular` segue o mesmo contrato textual. |

---

## 3. Arquivos previstos para alteração

**Produção**
1. `src/lib/store-onboarding/field-guidance.ts` — adicionar `"popular"` à união `StoreToneOfVoice`, à `TONE_OF_VOICE_DESCRIPTIONS` e mover/exportar `TONE_OF_VOICE_OPTIONS` (9 opções) como fonte única.
2. `src/components/flow/tone-of-voice-select.tsx` — **novo** (select-only combobox + 9 opções + typeahead com buffer/ciclo + flip/clamp mobile).
3. `src/components/flow/store-identity-form.tsx` — substituir `<select>` pelo `<ToneOfVoiceSelect>`; renderizar "Tom de Voz" + "Limpar seleção" no pai; remover `toneDescriptionId`/`toneDescription` e a descrição abaixo do campo; manter `id="tone_of_voice"`, `htmlFor`, `aria-describedby=[toneHintId, toneComplementsId]` e os dois `FieldHint`.

**Testes**
4. `src/components/flow/__tests__/tone-of-voice-select.test.tsx` — **novo** (Task 1).
5. `src/components/flow/__tests__/store-identity-form.orientation.test.tsx` — co-migrar (Task 2).
6. `src/lib/store-onboarding/__tests__/field-guidance.test.ts` — co-migrar (Task 2).
7. `src/lib/store-onboarding/__tests__/field-guidance.correspondence.test.ts` — co-migrar (Task 2).

**Specs canônicas (sincronizar na implementação)**
8. `openspec/specs/contextual-field-help/spec.md`
9. `openspec/specs/store-field-orientation/spec.md`
10. `openspec/specs/store-identity-ui/spec.md`

**Não alterar (fences):** APIs, banco, schemas, prompts, `src/lib/ai/**`, gateway, geração de IA, `tabs.ts`/`reason-text.ts`, `use-store-form.ts`, snapshot/domínio, as 8 descrições F49, documentos históricos da F49.

---

## 4. Plano de implementação em tarefas pequenas e verificáveis

> 3 tarefas, atômicas, cada teste pertence a uma tarefa executável (nenhum teste só na estratégia).

### Task 1 — Conteúdo (9ª opção + fonte única) + componente + teste do componente

- **files:** `src/lib/store-onboarding/field-guidance.ts`, `src/components/flow/tone-of-voice-select.tsx` (novo), `src/components/flow/__tests__/tone-of-voice-select.test.tsx` (novo).
- **action:**
  1. `field-guidance.ts`: adicionar `"popular"` a `StoreToneOfVoice`; adicionar `popular: "Simples, acessível e próxima do dia a dia."` a `TONE_OF_VOICE_DESCRIPTIONS`; exportar `TONE_OF_VOICE_OPTIONS: readonly { value: StoreToneOfVoice; label: string }[]` com **9** entradas (as 8 atuais + `{ value: "popular", label: "Popular" }`). As 8 descrições F49 ficam **inalteradas**.
  2. Criar `tone-of-voice-select.tsx` conforme §2 (combobox APG, 9 opções, typeahead com buffer+ciclo, flip/clamp mobile, `useId()`, `scrollIntoView`, sem `aria-checked`, valor vazio/legado seguro).
  3. Criar `tone-of-voice-select.test.tsx` cobrindo os itens 1–11 de §5 (incl. abertura por ponteiro, typeahead "po"/"pr"/"p" repetido, flip/clamp alcançável).
- **verify:** `npm run typecheck`; `npx eslint src/lib/store-onboarding/field-guidance.ts src/components/flow/tone-of-voice-select.tsx`; `npx vitest run src/components/flow/__tests__/tone-of-voice-select.test.tsx`.
- **done:** união/descrições/opções sincronizadas em 9; componente renderiza 9 opções com label+descrição; typeahead correto; abertura por ponteiro/teclado; teste do componente verde.

### Task 2 — Substituir o `<select>` + co-migrar os 3 testes existentes

- **files:** `src/components/flow/store-identity-form.tsx`, `src/components/flow/__tests__/store-identity-form.orientation.test.tsx`, `src/lib/store-onboarding/__tests__/field-guidance.test.ts`, `src/lib/store-onboarding/__tests__/field-guidance.correspondence.test.ts`.
- **action:**
  1. `store-identity-form.tsx`: importar `TONE_OF_VOICE_OPTIONS` de `field-guidance` e remover a constante local (58–67); substituir o `<select>` por `<ToneOfVoiceSelect value={formData.tone_of_voice} onChange={(v) => setField("tone_of_voice", v)} ariaDescribedby={[toneHintId, toneComplementsId].join(" ")} />`; renderizar a linha do rótulo com `"Tom de Voz"` + ação **"Limpar seleção"** (visível com valor válido, `setField("tone_of_voice","")`); remover `toneDescriptionId`/`toneDescription` e o `FieldHint` condicional (122, 127–130, 2025–2027); manter os dois `FieldHint` de finalidade.
  2. Co-migrar `field-guidance.test.ts`: "tem exatamente as **9** descrições" (adicionar `popular` à lista esperada) + nova asserção de sincronia (opções/descrições/união com 9 e mesmo conjunto de `value`).
  3. Co-migrar `field-guidance.correspondence.test.ts`: "cobre exatamente as **9** opções" + novo caso `popular` satisfaz `needs_tone_of_voice` (não vazio → `unlocked: true`).
  4. Co-migrar `store-identity-form.orientation.test.tsx`: `toHaveLength(8)` → `9`; reescrever "7.3" para o combobox (9 opções com label+descrição, descrição não persiste abaixo, trigger só label, reabertura `aria-selected`); novo caso "Limpar seleção" (limpa e restaura bloqueio).
- **verify:** `npm run typecheck`; `npx eslint src/components/flow/store-identity-form.tsx`; `rg -n "toneDescriptionId|toneDescription" src/components/flow/store-identity-form.tsx` → **0**; `npx vitest run` (suíte completa).
- **done:** campo fechado mostra só o label; aberto mostra 9 opções; seleção atualiza `setField`; "Limpar seleção" restaura vazio/`needs_tone_of_voice`; 3 testes co-migrados verdes.

### Task 3 — Sincronizar as specs canônicas

- **files:** os 3 `openspec/specs/.../spec.md`.
- **action:** atualizar o contrato para **"descrição apresentada na superfície de escolha; trigger fechado mantém somente o label"**, **9 opções** (incl. `popular`) e a ação "Limpar seleção":
  1. `contextual-field-help/spec.md`: item 2 do Requirement "Quatro mecanismos…" + Scenario (renomear para "Descrição na superfície de escolha"); onde "8 opções" aparecer, tornar genérico ("as opções definidas") ou 9.
  2. `store-field-orientation/spec.md`: Requirement "Tom de voz…" e Scenario "Descrição contextual por opção selecionada" → descrição na superfície de escolha + ação de limpar + 9 opções (listar `popular`).
  3. `store-identity-ui/spec.md`: Delta F49 (205), bullet "→ **Tom de Voz**" (221) e Scenario "Tom de Voz orienta…" (278–282) → 9 opções + descrição na superfície de escolha + ação de limpar.
  - **Não** alterar documentos históricos da F49 (49-*.md) para trocar 8→9.
- **verify:** `rg -n "8 opções|8 opções|oito|exatamente as 8" openspec/specs/contextual-field-help openspec/specs/store-field-orientation openspec/specs/store-identity-ui` — revisar hits; `rg -n "popular" openspec/specs/store-field-orientation openspec/specs/store-identity-ui` presente.
- **done:** specs coerentes (9 opções, descrição na escolha, trigger só label, limpar preservado).

---

## 5. Plano de testes automatizados e UAT

### Testes automatizados

**`tone-of-voice-select.test.tsx` (novo — Task 1):**
1. Fechado: `value=""` + placeholder "Selecione" (vazio) ou **somente** o label selecionado (sem descrição no `value`).
2. Aberto: **9** opções com label + descrição canônica (importando de `field-guidance`, sem literais).
3. Seleção chama `onChange(value)`; **selecionar Popular chama `onChange("popular")`**.
4. Reabertura marca `aria-selected` na opção correta.
5. **Nome e valor/estado:** `getByRole("combobox", { name: "Tom de Voz" })` (nome) + `value === "Popular"` (valor) — não apenas existência de atributos.
6. Teclado: ArrowDown/ArrowUp/Enter abrem; setas movem a ativa (`aria-activedescendant`); Home/End; Enter/Espaço seleciona; Escape fecha e devolve foco.
7. **Abertura por ponteiro:** clicar/tocar no combobox alterna aberto/fechado.
8. **Typeahead (buffer + ciclo):** `"po"` → Popular; `"pr"` → Profissional; teclar `p` repetidamente alterna entre Profissional e Popular de forma previsível.
9. Clique/toque externo fecha; `focusout` **não** fecha antes do clique na opção.
10. Valor vazio: nenhum `aria-selected`, placeholder; valor legado/desconhecido: placeholder, nenhum `aria-selected`, sem crash; **`popular` é reconhecido como valor válido (não legado)**.
11. ARIA: `aria-expanded` coerente; `aria-controls` resolve para `role="listbox"` existente mesmo fechado (`hidden`); `aria-activedescendant` aponta para id existente; **sem** `aria-checked`; sem ids órfãos.
12. Touch target ≥44px (combobox e opções). **Altura real calculada** (mock de `getBoundingClientRect`/`innerHeight`): (a) espaço suficiente abaixo → abre abaixo com `maxHeight = min(320, abaixo - margem)`; (b) mais espaço acima → abre acima; (c) ambos os lados com menos de 240px → usa o lado com maior espaço e rolagem interna, sem corte; (d) em todos os casos o popup **nunca ultrapassa o viewport**.

**Co-migração (Task 2):**
- `field-guidance.test.ts` — 9 descrições (com `popular`), frases canônicas de profissional/moderno/luxuoso inalteradas + `popular` = "Simples, acessível e próxima do dia a dia."; sincronia opções↔descrições↔união (9 e mesmo conjunto de valores).
- `field-guidance.correspondence.test.ts` — 9 opções; `popular` não vazio → `unlocked: true`; descrições positivas (a nona não contém `não|nunca|evite`).
- `store-identity-form.orientation.test.tsx` — `toHaveLength(9)`; "7.3" reescrita (9 opções; selecionar Popular → trigger só "Popular"; descrição não persiste abaixo); asserção de "descrição ausente" corrigida (§ abaixo); caso "Limpar seleção" (limpa → `needs_tone_of_voice` volta).

**Assertiva de "descrição ausente" (corrigida):**
- A descrição selecionada **não existe fora** da listbox (`within(listbox).getByText(description)`; nenhum outro elemento fora dela a contém).
- A listbox fechada tem `hidden` (`expect(listbox).not.toBeVisible()`).
- O `value`/texto do combobox contém **somente** o label.
- A descrição **não integra** o `aria-describedby` (só hint + complements).

**Regressão:** autosave/draft (`draft-store-autosave.test.ts`), desbloqueio (`tabs.test.ts`, `use-onboarding-tabs.test.ts`), demais fixtures — sem mudança esperada; rodar suíte completa.

### UAT manual (responsiva + leitores de tela)

- **Larguras/dispositivos:** 320px, 375px, desktop (≥1024px), Android (Chrome + **TalkBack**), iOS (Safari + **VoiceOver**).
- **Cenários:** (a) abrir e ver label+descrição por opção (9); (b) escolher e fechar → só o label; (c) reabrir → opção correta destacada; (d) teclado completo (Tab → Enter → setas → Escape); (e) typeahead ("po"/"pr"); (f) **viewport de baixa altura** (320×480, zoom, barras do navegador) → 9 opções alcançáveis, sem corte/scroll horizontal, flip acima quando sem espaço; (g) toque: áreas ≥44px + abrir por toque; (h) "Limpar seleção" → trigger "Selecione" + Direção Visual volta a bloquear; (i) **editorial:** o aprovador entende Popular como linguagem simples/acessível/cotidiana, **não** confunde com preço baixo, baixa qualidade, Acolhedor, Divertido ou Jovem, e **valida a redação final da nona descrição**.
- Registrar em `260919-hju-UAT.md` (aprovador, data, veredito por cenário, incl. VoiceOver/TalkBack e a validação editorial da nona descrição).

---

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Regressão de foco/teclado/leitor de tela por ARIA manual | Select-only combobox APG fiel + testes nome/valor/`aria-activedescendant` + UAT VoiceOver/TalkBack. |
| Perda da associação label↔campo | `<input id="tone_of_voice">` é *labelable*; `<label htmlFor>` preservado; testar `getByRole("combobox", { name: "Tom de Voz" })`. |
| `focusout` fechando antes do clique na opção | Não fechar por `focusout`; fechar por `pointerdown` externo; `onMouseDown.preventDefault()` na opção. |
| Quebrar testes "exatamente 8" | Co-migrar os 3 arquivos listados (Task 2) — `field-guidance.test.ts`, `field-guidance.correspondence.test.ts`, `store-identity-form.orientation.test.tsx`. |
| Typeahead com iniciais colidindo (`P`) | Buffer multi-caractere + ciclo entre correspondências; testes de "po"/"pr"/"p" repetido. |
| Duplicação de `TONE_OF_VOICE_OPTIONS` | Mover para `field-guidance.ts` (fonte única) e remover a cópia local. |
| Descrições F49 reescritas | Não tocar as 8; nona adicionada isoladamente; testes importam a constante. |
| "popular" quebrar prompt/consumidor | Consumidores tratam `tone_of_voice` como string; sem enum runtime; sem migration; prompts fora de escopo. |
| Popup inutilizável em 320×480 | Altura real calculada (`min(320, espaçoDoLado - margem)`), lado com maior espaço, mínimo utilizável + rolagem interna; UAT de baixa altura. |
| Ids duplicados/órfãos | `useId()` para listbox/opções; `aria-controls` sempre válido via `hidden`. |
| Remoção acidental da capacidade de limpar | Ação "Limpar seleção" no pai + teste de regressão que restaura `needs_tone_of_voice`. |
| Nona descrição inadequada | Validada editorialmente na UAT (cenário i); sem associação depreciativa. |

---

## 7. Confirmação de contratos e regras de negócio intactos

- **Valores internos:** os 8 valores F49 permanecem; adiciona-se `popular` (nono valor, não destrutivo).
- **Estado:** `formData.tone_of_voice` e `setField("tone_of_voice", value)` inalterados (incl. `onChange("")` ao limpar).
- **Autosave/draft/persistência:** inalterados.
- **Desbloqueio:** `needs_tone_of_voice` inalterado; `popular` (não vazio) satisfaz a regra como qualquer outro valor.
- **Descrições canônicas:** as 8 da F49 preservadas integralmente; a nona é nova e aguarda UAT.
- **Consumidores/banco/APIs/snapshot:** recebem `tone_of_voice` como `string`; `popular` aceito sem migration. **Sem** mudança em prompts (os cinco valores atuais **não enumerados explicitamente** nas diretrizes — Acolhedor, Divertido, Jovem, Tradicional e Luxuoso — seguem contrato textual idêntico ao que `popular` seguirá).
- **Não alterados:** APIs, banco, schemas, prompts, `src/lib/ai/**`, gateway, geração de IA, direção visual, snapshot, domínio e contratos externos.

---

## 8. Checkpoint final — aguardando revisão

**Confirmação de escopo:** continua **adequado ao GSD Quick** (1 módulo de conteúdo + 1 componente + 1 form + 4 arquivos de teste + 3 specs; sem migration/banco/IA/dependência). **Não recomendo OpenSpec.**

**Incorporações desta rodada:**
1. **9ª opção "popular"** adicionada à união, `TONE_OF_VOICE_OPTIONS` e `TONE_OF_VOICE_DESCRIPTIONS`; 8 descrições F49 preservadas; nona aguarda UAT editorial.
2. **Contagens** 8→9 em tarefas, testes e specs; documentos históricos F49 intocados.
3. **Co-migração** de `field-guidance.test.ts` e `field-guidance.correspondence.test.ts` (antes só citados) + cobertura de 9 opções/sincronia/`popular` válido/`onChange("popular")`/`needs_tone_of_voice`.
4. **Typeahead** com buffer multi-caractere + ciclo (`po`→Popular, `pr`→Profissional, `p` repetido alterna).
5. **Consumidores/fences** confirmados (string, sem migration, sem prompts).
6. **UAT editorial** do Popular (cenário i).
7. **Estrutura de tarefas** corrigida: cada teste pertence a uma tarefa (`tone-of-voice-select.test.tsx` na Task 1; co-migrações na Task 2).
8. **"Limpar seleção"** renderizado no pai (removida a prop `labelAction`); `ToneOfVoiceSelect` só combobox/listbox.
9. **Abertura por ponteiro** explícita e testada.
10. **Viewport móvel** concreto: altura real calculada (`min(320, espaçoDoLado - margem)`), lado com maior espaço, mínimo utilizável + rolagem interna; UAT prova 9 opções alcançáveis.

**Ratificações finais desta rodada:**
- **Espaço abre o combobox fechado** — ratificado (comportamento do exemplo oficial do APG); não é mais decisão pendente.
- **Altura real do popup** — substituído o limiar fixo de 256px + `min(320px,50vh)` pela medição real de espaço acima/abaixo e `maxHeight = min(320, espaçoDoLado - margem)`, com mínimo utilizável e rolagem interna.
- **"Limpar seleção"** renderizado **fora do `<label>`** (irmão na mesma linha visual, sem interação aninhada).

**Status: aprovado para execução** via `/gsd-quick resume 260919-hju-ajuste-localizado-no-campo-tom-de-voz-da`. Sem necessidade de nova fase OpenSpec.
