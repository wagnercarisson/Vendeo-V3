---
phase: quick-siq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/flow/use-campaign-form.ts
  - src/components/campaign/validity-field.tsx
  - src/components/flow/campaign-input-form.tsx
  - src/components/flow/__tests__/use-campaign-form-validity.test.ts
  - src/components/campaign/__tests__/validity-field.test.tsx
  - src/components/flow/__tests__/campaign-input-form.test.tsx
  - prompts/campaign-image-director.md
  - prompts/campaign-image-director-offer.md
  - src/lib/image-generation/services/image-review-service.ts
  - src/lib/image-generation/services/__tests__/image-review-service.test.ts
  - openspec/specs/offer-validity-modes/spec.md
autonomous: false
requirements: [Q-SIQ-01, Q-SIQ-02, Q-SIQ-03, Q-SIQ-04]
must_haves:
  truths:
    - "A validade da oferta com data aparece na arte no formato dd/mm/aaaa (ex.: 'até 30/09/2026', 'de 25/09/2026 até 30/09/2026')"
    - "O input de data do formulário é um campo de texto mascarado dd/mm/aaaa, com armazenamento interno ISO YYYY-MM-DD e conversão determinística por string (sem timezone)"
    - "Data incompleta ou inválida no input mascarado produz erro inline genérico (campos validityStartDate/validityEndDate)"
    - "Os erros de data chegam à UI via props do ValidityField (startDateError/endDateError) + blur (onStartDateBlur/onEndDateBlur), integrados em campaign-input-form.tsx — sem isso a validação bloquearia o fetch sem feedback ao usuário"
    - "No modo range, data inicial > data final BLOQUEIA a geração (validação no frontend, via validateField/submit, sem mudar contrato da rota)"
    - "O parent do ValidityField é atualizado em toda mudança do draft — nunca mantém ISO antigo quando o campo visível mudou (anti-ISO-stale)"
    - "Os prompts do diretor de arte e do revisor reforçam a preservação de dia/mês/ano quando a validade tiver data"
  artifacts:
    - path: "src/components/flow/use-campaign-form.ts"
      provides: "Helpers de data (formatDateDisplay, formatDateInput, parseDateInput, isValidDateInput) + validação de datas (incompleta/inválida + ordem range) no validateField/submit"
      contains: "formatDateDisplay"
      exports: ["formatDateDisplay", "formatDateInput", "parseDateInput", "isValidDateInput"]
    - path: "src/components/campaign/validity-field.tsx"
      provides: "Inputs de data mascarados dd/mm/aaaa com draft local, anti-ISO-stale, props de erro/blur e helper text atualizado"
      contains: "inputMode=\"numeric\""
    - path: "src/components/flow/campaign-input-form.tsx"
      provides: "Integração dos erros de data: passa startDateError/endDateError/onStartDateBlur/onEndDateBlur ao ValidityField"
      contains: "startDateError"
    - path: "src/components/flow/__tests__/campaign-input-form.test.tsx"
      provides: "Teste de integração: erro de data vindo de fieldErrors/touched é renderizado na UI (ValidityField real)"
      contains: "Informe uma data válida"
    - path: "src/components/flow/__tests__/use-campaign-form-validity.test.ts"
      provides: "Testes co-migrados (dd/mm/aaaa) + novos (helpers, validação por modo, range start>end bloqueando submit/fetch)"
      contains: "até 30/09/2026"
    - path: "src/components/campaign/__tests__/validity-field.test.tsx"
      provides: "Testes de componente da máscara (sem type=\"date\", placeholder/inputMode, digitação→ISO, anti-stale, re-sync externo)"
      contains: "dd/mm/aaaa"
    - path: "prompts/campaign-image-director.md"
      provides: "Reforço para exibir data completa dd/mm/aaaa"
      contains: "dd/mm/aaaa"
    - path: "prompts/campaign-image-director-offer.md"
      provides: "Reforço para exibir data completa dd/mm/aaaa"
      contains: "dd/mm/aaaa"
    - path: "src/lib/image-generation/services/image-review-service.ts"
      provides: "buildValidityTextSection reforçada para exigir fidelidade dia/mês/ano"
      contains: "buildValidityTextSection"
    - path: "openspec/specs/offer-validity-modes/spec.md"
      provides: "Spec atualizada do formato dd/mm → dd/mm/aaaa"
      contains: "dd/mm/aaaa"
  key_links:
    - from: "src/components/flow/use-campaign-form.ts"
      to: "src/components/campaign/validity-field.tsx"
      via: "validityStartDate/validityEndDate ISO YYYY-MM-DD; conversão display dd/mm/aaaa por helpers puros"
      pattern: "formatDateInput"
    - from: "src/components/campaign/validity-field.tsx"
      to: "src/components/flow/use-campaign-form.ts"
      via: "onStartDateChange/onEndDateChange emitem ISO (ou \"\" quando inválido) → validateField valida por ISO no submit"
      pattern: "onEndDateChange"
    - from: "src/lib/image-generation/services/image-review-service.ts"
      to: "prompts/campaign-image-reviewer.md"
      via: "buildValidityTextSection alimenta {{validityTextSection}}"
      pattern: "buildValidityTextSection"
---

<objective>
**Quick 1 — Validade/Data:** (1) validade da oferta passa a incluir ano no formato dd/mm/aaaa na arte; (2) input de data nativo `type="date"` substituído por campo de texto mascarado dd/mm/aaaa com armazenamento ISO e conversão determinística; (3) validação de data incompleta/inválida e ordem `data inicial <= data final` no frontend, antes de disparar a geração; (4) reforço nos prompts (diretor + revisor) para preservar dia/mês/ano.

**Purpose:** Reduzir risco de campanha errada (data sem ano, ordem invertida, data stale no submit) e melhorar usabilidade mobile do input de data.

**Fora deste quick (movidos para Quick 2 — Preço/Helper):** label "Preço com Desconto *" → "Preço Final", asterisco condicional, helper sob "Oferta", co-migração da mensagem de preço (D3/D4 anteriores). Nenhum arquivo de preço/helper é tocado aqui.

**Escopo (locked):** NÃO alterar nomes internos (`discountedPriceCents` etc.). NÃO alterar `buildCommercialRepertoire` nem a superfície de composição do rótulo "Oferta válida:" (`image-generation-service.ts:738-740`). NÃO mudar transporte/schema (`GenerateImageRequestSchema` mantém `validity?: string`; a rota NÃO recebe validityStartDate/validityEndDate — ordem de datas valida no FRONTEND). NÃO mexer no Copy Director.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/quick.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/flow/use-campaign-form.ts
@src/components/campaign/validity-field.tsx
@src/components/flow/__tests__/use-campaign-form-validity.test.ts
@prompts/campaign-image-director.md
@prompts/campaign-image-director-offer.md
@src/lib/image-generation/services/image-review-service.ts
@openspec/specs/offer-validity-modes/spec.md

**Estado atual confirmado por leitura:**
- `formatDDMM(isoDate)` em `use-campaign-form.ts:262-266` retorna `DD/MM` (sem ano). `buildValidityDisplayText:268-292` usa `formatDDMM` → `até 30/09`, `de 25/09 até 30/09`, `somente hoje`, `enquanto durarem os estoques`, custom normalizado.
- O displayText vira `body.validity` → `commercial.validity.displayText` → duas superfícies na arte: `buildCommercialRepertoire` (`image-generation-service.ts:738-740`) e `{{validity}}` em `campaign-image-director.md:27,82` / `campaign-image-director-offer.md:27,83`. O reviewer usa `buildValidityTextSection` (`image-review-service.ts:213-227`).
- `ValidityField` (`validity-field.tsx:62-115`) usa `type="date"` em 3 inputs (until-date: 1, range: 2), valor ISO direto, zero `useState` (design F40-05). Helper text `:140` = "A data aparece no formato dd/mm na campanha."
- **Validação de datas HOJE NÃO EXISTE no submit:** o loop de submit (`use-campaign-form.ts:716-724`) chama `validateField` para `validityMode`/`validityStartDate`/`validityEndDate`, mas `validateField:242-260` não tem cases para eles → `default: return null`. `buildValidityDisplayText(frozenFields)` (`:791`) monta o texto e envia `body.validity`. A rota só recebe `validity?: string` (`schema.ts:39`) — NÃO recebe as datas ISO → validação de ordem precisa ser no frontend.
- `touched` inicial desses campos é `false` (`:334-335`); no submit, `setTouched` marca `validityStartDate`/`validityEndDate` como true (`:741-742`).
- Testes que dependem do displayText dd/mm: apenas `use-campaign-form-validity.test.ts` (testes 2, 3, 7, 8). Os demais (`route.test.ts:976`, `brief*.test.ts`, `image-generation-service.test.ts:597`, `image-review-service.test.ts:278`) usam "até 30/09" como INPUT de teste — não quebram com a mudança de formato.

<interfaces>
<!-- Contratos que o executor deve usar diretamente — sem exploração adicional. -->

From src/components/flow/use-campaign-form.ts (estado atual):
```typescript
export function formatDDMM(isoDate: string): string; // "2026-09-30" → "30/09"
export function buildValidityDisplayText(fields: {
  validityMode: ValidityMode;
  validityStartDate: string;
  validityEndDate: string;
  validityCustomText: string;
}): string | undefined;
```

ValidityField props (presentacional, ISO): `{ mode, startDate, endDate, customText, disabled, onModeChange, onStartDateChange, onEndDateChange, onCustomTextChange }`.

> **Alvo pós-mudança (Task 2):** props do ValidityField passam a incluir `startDateError?: string`, `endDateError?: string`, `onStartDateBlur?: () => void`, `onEndDateBlur?: () => void`. `campaign-input-form.tsx:529-541` integra `touched.validityStartDate/validityEndDate`, `fieldErrors.validityStartDate/validityEndDate` e `handleBlur("validityStartDate"/"validityEndDate")` (padrão dos campos de preço `:410-420`).

CampaignFormFields inclui `validityStartDate: string` e `validityEndDate: string` (ISO).

`validateField(field, fields)` (`:242-260`) — switch sem cases de data; loop de submit em `:716-724`; bloqueio de submit em `:726-747` (setFieldErrors + setTouched + return ANTES do fetch). Mensagens de erro atuais usam o padrão `{fieldErrors[field]}` no form (`campaign-input-form.tsx`).

PromptLoader substitui `{{key}}` literalmente; variáveis com `{{` não podem existir. `buildValidityTextSection` já aplica `sanitizePromptText`.
</interfaces>

<decisions_pending>
<!-- Decisões revisadas e aprovadas em direção (revisão 1). Aguardam liberação final do revisor para execução. -->

| # | Decisão | Recomendação final | Status |
|---|---------|--------------------|--------|
| D1 | Renomear `formatDDMM` → `formatDateDisplay` (retorno DD/MM/AAAA) | Renomear — nome atual ficaria enganoso | ✅ aprovado (revisão 1) |
| D2 | Data incompleta/inválida no input mascarado | Erro inline genérico "Informe uma data válida (dd/mm/aaaa)"; hook valida por ISO vazio quando o modo exige data; validação fina de calendário nos helpers/evento do componente (não em raw armazenado) | ✅ aprovado (revisão 1) |
| D5 | Ordem `data inicial <= data final` no modo range | Validar no FRONTEND (`validateField` + loop de submit), bloqueando geração antes do fetch; rota não recebe as datas (sem mudança de contrato) | ✅ aprovado (revisão 1) |

> **Fora deste quick (Quick 2 — Preço/Helper):** D3 (mensagem "Preço final é obrigatório para ofertas" — form + rota + testes) e D4 (renomear `campaign-adjustments-panel.tsx`), além do label "Preço Final" condicional e do helper sob "Oferta". Removidos deste artefato; serão planejados em `/gsd-quick` separado.
</decisions_pending>

<tasks>

<task type="auto">
  <name>Task 1: Helpers de data + validade com ano + validação de datas (incl. ordem range) no submit</name>
  <files>src/components/flow/use-campaign-form.ts, src/components/flow/__tests__/use-campaign-form-validity.test.ts</files>
  <action>
    Em `src/components/flow/use-campaign-form.ts`:

    1. **D1:** renomear `formatDDMM` → `formatDateDisplay` e incluir ano:
       - `formatDateDisplay("2026-09-30")` → `"30/09/2026"`; `formatDateDisplay("")` → `""`; entrada sem 3 partes após split "-" → retorna a entrada original (comportamento atual preservado).
       - Atualizar os 2 usos internos em `buildValidityDisplayText` (`:278,281`) — concatenação "até ..."/"de ... até ..." idêntica, só o formato muda.
       - Exportar a função renomeada; NÃO manter `formatDDMM` (co-migração total).

    2. Novos helpers puros exportados (conversão determinística por string, SEM `new Date()`/timezone — `src/lib/changelog/format-date.ts` é a referência de estilo):
       - `formatDateInput(iso: string): string` — ISO `YYYY-MM-DD` → `dd/mm/aaaa` (para exibir no input). Vazia/inválida → `""`.
       - `parseDateInput(ddmmYYYY: string): string` — `dd/mm/aaaa` → ISO `YYYY-MM-DD` via split("/"). Incompleta/inválida/ano<4 dígitos → `""` (determinístico, nunca `new Date`).
       - `isValidDateInput(ddmmYYYY: string): boolean` — máscara completa E data de calendário real (dia/mês válidos, anos bissextos p/ 29/02). Incompleta → false.
       - Sempre que o form receber ISO, exibir máscara via `formatDateInput`; sempre que o input emitir máscara, persistir ISO via `parseDateInput`.

    3. **D2/D5 — validação de datas em `validateField` (frontend, antes do fetch):**
       - **Modelo explícito ("campo visível" × "ISO armazenado"):** o hook NÃO armazena a máscara; só enxerga ISO. Data inválida/incompleta chega como `""` (via `parseDateInput` no componente). O hook valida PELO ISO com erro genérico.
       - Case `validityEndDate`: quando o modo ativo requer a data (`until-date` → endDate; `range` → endDate) e `validityEndDate` é `""` → erro "Informe uma data válida (dd/mm/aaaa)".
       - Case `validityStartDate`: quando `mode === "range"` e `validityStartDate` é `""` → erro genérico.
       - **Ordem de checagem no range (observação do revisor):** se `validityEndDate` ainda estiver `""`, o case `validityStartDate` NÃO emite o erro de ordem (priorizar o erro genérico de data incompleta — que será emitido no case `validityEndDate`). Só comparar ordem quando ambas as datas estão preenchidas.
       - **Critério aprovado é `data inicial <= data final` (datas iguais PERMITIDAS):** quando start > end (comparação lexicográfica de ISO é segura: `YYYY-MM-DD`) → erro "Data inicial não pode ser posterior à data final" (mensagem que não rejeita igualdade).
       - **A validação fina de calendário** (31/02, 29/02 não bissexto) NÃO fica no hook — fica em `isValidDateInput`, aplicada no evento do componente (ValidityField) para emitir `""`. O hook nunca valida texto mascarado que não possui.
       - today/stock/custom → null (comportamento atual de não exigir datas permanece).
       - O loop de submit (`:716-724`) e o bloqueio (`:726-747`) já cobrem esses cases automaticamente — validação de ordem bloqueia geração ANTES de montar `body.validity`.

    4. Co-migração de `src/components/flow/__tests__/use-campaign-form-validity.test.ts`:
       - Teste 2: `até 30/09` → `até 30/09/2026`; descrição do it atualizada para dd/mm/aaaa.
       - Teste 3: `de 25/09 até 30/09` → `de 25/09/2026 até 30/09/2026`.
       - Teste 7: `formatDDMM(...)` → `formatDateDisplay("2026-09-30")` → `"30/09/2026"`.
       - Teste 8: `body.validity` → `até 30/09/2026`.
       - Adicionar testes: `formatDateInput`/`parseDateInput` round-trip (ISO→máscara→ISO), `parseDateInput` com data incompleta → `""`, `isValidDateInput` falso para 31/02 e 29/02/2023 (não bissexto).
       - **Teste específico (D5):** modo `range` com `validityStartDate > validityEndDate` (ambas preenchidas) → `handleSubmit` NÃO chama `fetch` (fetchMock não chamado), `fieldErrors.validityStartDate` preenchido com "Data inicial não pode ser posterior à data final". Espelhar o padrão do teste 8 (sessionStorage + fetchMock + renderHook + act).
       - Teste de igualdade permitida: range com start === end (ex.: 25/09/2026 e 25/09/2026) → `handleSubmit` segue e chama `fetch` (sem erro de ordem).
       - Teste de prioridade de erro: range com start preenchida e end vazia → erro genérico em `fieldErrors.validityEndDate` (NÃO emite erro de ordem).
       - Teste de required por modo: `until-date` sem `validityEndDate` → `handleSubmit` bloqueia sem fetch; erro genérico em `fieldErrors.validityEndDate`.
  </action>
  <verify>
    <automated>npx vitest run src/components/flow/__tests__/use-campaign-form-validity.test.ts 2>&1 | Select-String "Test Files|Tests "</automated>
  </verify>
  <done>formatDateDisplay/formatDateInput/parseDateInput/isValidDateInput exportados e testados; buildValidityDisplayText produz dd/mm/aaaa; validação por ISO + erro genérico + ordem range (<= permitido, sem erro de ordem quando end vazia) bloqueando submit/fetch (D5) coberta por teste; use-campaign-form-validity.test.ts co-migrado e verde.</done>
</task>

<task type="auto">
  <name>Task 2: UI — máscara no ValidityField com anti-ISO-stale + integração de erros/blur + testes de componente</name>
  <files>src/components/campaign/validity-field.tsx, src/components/flow/campaign-input-form.tsx, src/components/campaign/__tests__/validity-field.test.tsx, src/components/flow/__tests__/campaign-input-form.test.tsx</files>
  <action>
    Em `src/components/campaign/validity-field.tsx`:

    1. Substituir os 3 `type="date"` (`:70-78`, `:90-98`, `:105-113`) por `type="text"` + `inputMode="numeric"` + `autoComplete="off"` + `maxLength={10}` com placeholder "dd/mm/aaaa", mantendo as classes de input e `aria-label`/ids existentes.
    2. Máscara com **draft local** (`useState`) e **regra anti-ISO-stale (crítica — risco de bug real):**
       - O componente mantém draft local APENAS para exibição; o parent (`onStartDateChange`/`onEndDateChange`) DEVE ser atualizado em **toda** mudança do draft:
         - draft completo e válido (`isValidDateInput`) → emitir ISO (`parseDateInput(draft)`);
         - draft incompleto OU inválido → emitir `""`;
         - **NUNCA manter o ISO antigo quando o campo visível já mudou** — um usuário que apaga `30/09/2026` não pode deixar o form com o ISO antigo (senão o submit enviaria data anterior).
       - Máscara no `onChange`: aceita só dígitos, insere "/" automaticamente após 2º e 4º dígito, tolera apagar separadores. **Manter simples (orientação do revisor):** ao digitar, se válido emite ISO; se incompleto/inválido emite `""`; **nunca apagar o texto parcial do usuário durante a digitação.**
       - Ressincronização do draft com a prop ISO externa via `useEffect` **apenas quando o campo não estiver em edição ou quando o ISO mudar por fonte externa** (restauração de draft, mudança de modo/limpeza). Guarda de "foco/edição" (`onFocus`/`onBlur`) ou equivalência ISO derivado do draft ≠ prop ISO — o executor escolhe a mais simples que NÃO sobrescreva digitação em andamento e documenta no código.
       - **⚠️ Desvio consciente do design "zero useState" da F40-05 — necessário para a máscara.**
    3. **NOVO — props de erro e blur (bloqueador real identificado pelo revisor):** estender as props com `startDateError?: string`, `endDateError?: string`, `onStartDateBlur?: () => void`, `onEndDateBlur?: () => void` e renderizar, abaixo do input de data correspondente (e do input inicial no modo range), o erro no padrão do form (`campaign-input-form.tsx:415-420`): `<p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs"><AlertCircle className="w-3.5 h-3.5" />{error}</p>` (importar `AlertCircle` de `lucide-react`). Sem `type="date"` nem erro: nada renderizado.
    4. Atualizar o helper text `:140` → "A data aparece no formato dd/mm/aaaa na campanha."
    5. (D1) os valores continuam ISO nas props; o form nunca vê máscara como fonte de verdade.

    Em `src/components/flow/campaign-input-form.tsx` — ponto de integração (`:529-541`, uso do `ValidityField`):

    6. Passar ao ValidityField:
       - `startDateError={touched.validityStartDate ? (fieldErrors.validityStartDate ?? null) : null}`
       - `endDateError={touched.validityEndDate ? (fieldErrors.validityEndDate ?? null) : null}`
       - `onStartDateBlur={() => handleBlur("validityStartDate")}`
       - `onEndDateBlur={() => handleBlur("validityEndDate")}`
       - (espelha o padrão de `touched.X && fieldErrors.X` dos campos de preço `:410-420`; `handleBlur` já existe nas props do FormContent `:191`).

    Testes de componente (novos arquivos):

    7. `src/components/campaign/__tests__/validity-field.test.tsx` (render real do ValidityField, `@vitest-environment jsdom`, `@testing-library/jest-dom`):
       - NENHUM input com `type="date"`; inputs têm `placeholder="dd/mm/aaaa"` e `inputMode="numeric"`.
       - Digitar `30092026` em until-date → `onEndDateChange("2026-09-30")` chamado.
       - Apagar até deixar incompleto → `onEndDateChange("")` (anti-ISO-stale).
       - Prop ISO externa mudando (restauração/mode change) → máscara re-sincroniza, sem apagar digitação em andamento.
       - `endDateError`/`startDateError` renderizam a mensagem abaixo do input correspondente.
       - Blur no input de data chama `onEndDateBlur`/`onStartDateBlur`.
    8. `src/components/flow/__tests__/campaign-input-form.test.tsx` (integração — valida o bloqueador do revisor):
       - Render real do `CampaignInputForm` com `useCampaignForm` mockado (espelho do setup de `campaign-flow-credits.test.tsx`, mas SEM mockar `ValidityField`), devolvendo `campaignIntent: "offer"`, `validityMode: "until-date"`, `touched.validityEndDate: true`, `fieldErrors.validityEndDate: "Informe uma data válida (dd/mm/aaaa)"` e `handleBlur: vi.fn()`.
       - Assertar que a mensagem "Informe uma data válida (dd/mm/aaaa)" aparece no DOM (erro vindo do hook chega à UI via ValidityField).
  </action>
  <verify>
    <automated>npx vitest run src/components/campaign/__tests__/validity-field.test.tsx src/components/flow/__tests__/campaign-input-form.test.tsx src/components/flow/__tests__/use-campaign-form-validity.test.ts 2>&1 | Select-String "Test Files|Tests "</automated>
  </verify>
  <done>ValidityField com máscara dd/mm/aaaa (anti-ISO-stale), props startDateError/endDateError/onStartDateBlur/onEndDateBlur renderizando erro inline; campaign-input-form.tsx integra fieldErrors/touched/handleBlur ao ValidityField; testes de componente cobrem máscara, anti-stale, re-sync, render de erro e blur; teste de integração prova o feedback na UI.</done>
</task>

<task type="auto">
  <name>Task 3: Reforço dia/mês/ano nos prompts (diretor + revisor) + spec offer-validity-modes</name>
  <files>prompts/campaign-image-director.md, prompts/campaign-image-director-offer.md, src/lib/image-generation/services/image-review-service.ts, src/lib/image-generation/services/__tests__/image-review-service.test.ts, openspec/specs/offer-validity-modes/spec.md</files>
  <action>
    Em `prompts/campaign-image-director.md` e `prompts/campaign-image-director-offer.md` (blocos `**Validade da oferta:** {{validity}}`, `:82-83`):

    1. Adicionar instrução de reforço (uma ou duas frases, no padrão de tom dos prompts): quando a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado — NÃO truncar para dd/mm nem omitir o ano. Não inventar ou alterar a data.

    Em `src/lib/image-generation/services/image-review-service.ts` — `buildValidityTextSection` (`:213-227`):

    2. Reforçar o texto da seção para exigir fidelidade de dia/mês/ano: quando o texto de validade contiver data, a arte deve reproduzi-la completa (dd/mm/aaaa) — divergência de dia, mês OU ano é reprovação (issue CRÍTICA, type `illegible_text`). Manter `sanitizePromptText` e o cabeçalho `## Validade da Oferta`.

    Em `src/lib/image-generation/services/__tests__/image-review-service.test.ts`:

    3. Testes novos (seguir padrão existente com `mockLoader`):
       - `buildValidityTextSection` com `validityText: 'até 30/09/2026'` → seção contém `até 30/09/2026` E exigência de dia/mês/ano (ex.: contém `dd/mm/aaaa` ou `ano`).
       - `buildValidityTextSection` vazia → `''` (regressão, já coberta em 8.20 mas manter).
       - Sem `{{` em nenhum valor de vars (sanitização mantida).
       - Atualizar a fixture 8.20 (`image-review-service.test.ts:278` usa `'Até 30/09'`) para `'Até 30/09/2026'` se a asserção depender do conteúdo — caso contrário, apenas adicionar os novos asserts acima.

    Em `openspec/specs/offer-validity-modes/spec.md`:

    4. Tabela e scenarios: `dd/mm` → `dd/mm/aaaa` (ex.: `até 30/09/2026`, `de 25/09/2026 até 30/09/2026`). Ajustar a linha "O formato de data usado no displayText é dd/mm (ex.: 30/09)".
  </action>
  <verify>
    <automated>npx vitest run src/lib/image-generation/services/__tests__/image-review-service.test.ts 2>&1 | Select-String "Test Files|Tests "</automated>
  </verify>
  <done>Diretor (base + offer) e revisor exigem preservação de dia/mês/ano em validade com data; novos testes de buildValidityTextSection verdes; spec offer-validity-modes reflete dd/mm/aaaa; sem placeholders não resolvidos.</done>
</task>

</tasks>

<verification>
1. `npx vitest run src/components/flow/__tests__/use-campaign-form-validity.test.ts` — co-migrado + novos testes (helpers, required por modo, range start>end bloqueando submit/fetch) verdes
2. `npx vitest run src/components/campaign/__tests__/validity-field.test.tsx src/components/flow/__tests__/campaign-input-form.test.tsx` — máscara, anti-stale, re-sync, render de erro, blur e integração hook→UI verdes
3. `npx vitest run src/lib/image-generation/services/__tests__/image-review-service.test.ts` — novos testes + regressão verdes
4. `npx vitest run src/app/api/campaign/generate-image/__tests__/route.test.ts src/lib/campaign/__tests__/brief.test.ts src/lib/campaign/__tests__/brief-mapper.test.ts src/lib/campaign/__tests__/brief-snapshot.test.ts` — regressão de pipeline (inputs de teste "até 30/09" intactos — não quebram com o formato novo)
5. `npm run typecheck` — sem erros (valida wiring das novas props ValidityField ← campaign-input-form)
6. `npm run lint` — sem erros
7. Grep gate: `Select-String -Pattern "formatDDMM" -Path src -Recurse` → zero ocorrências (renomeado); `Select-String -Pattern "type=\"date\"" -Path src/components/campaign/validity-field.tsx` → zero; `Select-String -Pattern "dd/mm na campanha" -Path src/components/campaign/validity-field.tsx` → zero
</verification>

<success_criteria>
- A arte exibe validade com ano (dd/mm/aaaa) quando a validade tem data — nos dois modos (até/intervalo) e nas duas superfícies (diretor + revisor validam fidelidade de dia/mês/ano).
- Input de data é máscara de texto dd/mm/aaaa no mobile; armazenamento/envio permanece ISO YYYY-MM-DD sem parsing de timezone; o parent é atualizado em toda mudança (nunca mantém ISO antigo quando o campo visível mudou); data incompleta/inválida chega como `""` e tem erro inline genérico.
- **Os erros de data são exibidos na UI** (ValidityField encapsula startDateError/endDateError; campaign-input-form.tsx integra fieldErrors/touched/handleBlur) — o usuário entende por que o fetch foi bloqueado.
- Modo range com `data inicial > data final` BLOQUEIA a geração no frontend (validateField + submit), sem mudar o contrato da rota.
- Testes de componente cobrem a parte visual/interativa (não só helpers): ausência de `type="date"`, placeholder/inputMode, digitação→ISO, anti-stale, re-sync externo, render de erro e blur; teste de integração prova o feedback na UI.
- Sem mudança de contrato de domínio/pipeline; suítes focadas + regressão + typecheck + lint verdes.
- Preço/helper NÃO são tocados neste quick (ficam para o Quick 2).
</success_criteria>

<output>
Create `.planning/quick/260820-siq-ajustes-formulario-validade-preco/260820-siq-SUMMARY.md` when done (após aprovação e execução)
</output>