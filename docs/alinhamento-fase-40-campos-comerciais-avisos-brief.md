# Alinhamento Fase 40 — Campos Comerciais e Avisos do Brief (v1.5)

> **Renumeração (esta fase):** F40 = **Campos Comerciais e Avisos do Brief** (nova, v1.5). Stripe / Monetização Pública deslocada de F40 para **F41** (v1.7, pós-beta — segue o precedente de renumeração da F39 D1, que seguiu a F37 D11: a fase conflitante é incrementada, não apagada). A atualização dos trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) está documentada como runbook na seção **D1** deste documento.
>
> **Decisão central (D6):** a F40 **remove a instrução incondicional** "SEMPRE acrescente a arte o seguinte texto: 'Imagem meramente ilustrativa'" que existe hoje nos **4 prompts do diretor** (herança do UAT-3, `2026-07-13`), substituindo-a por um **bloco condicional de composição**: o aviso ilustrativo só entra na arte quando o brief trouxer `legalNotice.enabled=true`. Isso torna o checkbox um **controle real**, mantém a inteligência visual herdada do UAT-3 (tipografia mínima, visível/legível, posição lateral) e **preserva o comportamento atual por default** (checkbox default = marcado).
>
> **Decisão de validade (D5):** `validity.displayText` é **frase nua, sem o rótulo "Oferta válida"** (ex.: `"até 30/09"`, `"somente hoje"`). As superfícies atuais do prompt compõem seus próprios rótulos a partir do `displayText` nu (`buildCommercialRepertoire` → `- Oferta válida: ${displayText}`; template offer/base → `**Validade da oferta:** {{validity}}`). Evita duplicação ("Oferta válida: Oferta válida até 30/09") sem mudar o backend.

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                       ✓
  ├── F31.1 — Modelo Comercial — Formulário                      ✓
  ├── F31.2 — Diretores por Intenção                             ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                             ✓
  ├── F33 — Verificação CNPJ Freemium                            ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)     ✓
  ├── F35 — Changelog / Novidades                                ✓
  ├── F36 — Onboarding: Navegação por Abas                       ✓
  ├── F38 — Tabela de Custos por Operação                        ✓
  ├── F38.1 — Apuração de Custos de IA por Entrega               ✓
  ├── F38.2 — Admin de Custos + Config. Econômicas               ✓
  ├── F38.2.1 — Snapshot Econômico                               ✓
  ├── F39 — Brief Estruturado de Campanha                        ✓ (deixou o backend pronto)
  ├── F40 — Campos Comerciais e Avisos do Brief                  ← esta fase (UI sobre o domínio)
  ├── F37 — Revisão e Aprovação da Arte                          ○ depois (consome o snapshot)
  │        (experimento controlado beta, human-in-the-loop)
  └── F41 — Stripe / Monetização Pública                         ○ v1.7, pós-beta (renumerada de F40)

Depois desta fase (sequenciamento recomendado):
  F40 (campos/avisos) → F37 (revisão/aprovação) → [catálogo — fase futura] → F41 (Stripe)
```

O objetivo da F40 é **trazer para o formulário** os campos comerciais e avisos que a F39 já estruturou no domínio (`commercial.validity` e `commercial.legalNotice`) mas que **ainda não têm UI**: o checkbox "Imagem meramente ilustrativa" (controle real, desacoplado da instrução incondicional do prompt) e a validade da oferta em **modos estruturados** — ambos com a semântica `enabled`/`displayText` já existente no backend.

**Estado real em código (explorado nesta fase):**

- **O backend da F39 deixou ~90% pronto — o gap real é o form e os prompts.**
  - `commercial.validity { enabled, displayText?, endDate? }` e `commercial.legalNotice { enabled, text? }` já vivem no domínio (`src/lib/campaign/brief.ts:82-83`) e no zod (`brief-schema.ts:36,43`).
  - `buildCampaignBriefFromFlat` (`brief.ts:146`) já converte: `validity` (string) → `{ enabled: true, displayText }` (`brief.ts:153-155`) e `mandatoryArtworkText` → `legalNotice { enabled: true, text }` — ambos **nunca fabricados** quando ausentes (`brief.ts:189-190`).
  - O snapshot `campaign_brief_v1` já persiste `commercial.validity` e `commercial.legalNotice` (`buildCampaignBriefSnapshot`), com teste de ausência/presença (`brief-snapshot.test.ts:70-86`).
  - A pipeline já lê os campos: `buildPromptVariables` expõe `validity`/`mandatoryArtworkText` (`image-generation-service.ts:917-924`); `buildCommercialRepertoire` decide por `validity.enabled && displayText && campaignIntent === "offer"` → `- Oferta válida: ${displayText}` (`image-generation-service.ts:738-740`); o revisor já tem `validityTextSection`/`mandatoryArtworkTextSection` com rigor literal para aviso legal (`image-review-service.ts:185-223`).
- **O form nunca envia `validity`.** O body do `use-campaign-form.ts` (`:625-638`) só contém: `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext`, `mandatoryArtworkText`, `productImageDataUrl`. `validity` está no schema HTTP e nos prompts, mas **sem UI** — o lojista não tem como informar validade.
- **`mandatoryArtworkText` hoje é string livre** (`mandatory-artwork-field.tsx`): textarea com placeholder "Ex: Imagens meramente ilustrativas", `maxLength 200`, renderizado em `campaign-input-form.tsx:503-505`. A semântica de "ligado" é confundida com "string não vazia" — não existe checkbox.
- **Os 4 prompts do diretor hardcodam o aviso ilustrativo como instrução incondicional** (herança do UAT-3, `2026-07-13`): `campaign-image-director.md:130`, `-offer.md:131`, `-spotlight.md:129`, `-exclusive.md:138` → `SEMPRE acrescente a arte o seguinte texto ... : "Imagem meramente ilustrativa"`. Isso contradiz a semântica F39 D9 (`enabled=false` → nada na arte): **mesmo desmarcado, a arte hoje exibe o aviso**. Se a F40 adicionasse o checkbox sem tocar nos prompts, o checkbox seria **no-op**.
- **`endDate` (ISO) permanece reservado** (F39 D8): a F40 usa datas estruturadas na UI apenas para **gerar o `displayText`** ("até 30/09"); o backend continua recebendo **texto final** — sem envio de `endDate`.
- **Copy Director fora:** `CopyDirectorInput` (`src/lib/copy/schema.ts`) não recebe `validity`/`legalNotice` — coerente com o design F25 e com o revisor ("Não repetir o texto obrigatorio em legenda; o texto e escopo da arte, nao da legenda", `image-review-service.ts:205`).
- **Inconsistência de string do aviso:** singular ("Imagem meramente ilustrativa" — prompts UAT-3 e fixtures de teste) × plural ("Imagens meramente ilustrativas" — placeholder do form e várias fixtures). A F40 **unifica numa constante** (D2).
- **Campos adormecidos permanecem sem UI** (F40 não os ativa): `availabilityNotes`, `campaignDetails`, `additionalDetails`, `hook`, `cta`, `objective`, `targetChannel`, `format`, `sensitiveConstraints` — já no schema HTTP/prompts/mapper, sem formulário.

---

## Propósito

1. **Checkbox de aviso ilustrativo como controle real (D2/D6)** — criar checkbox "Exibir 'Imagem meramente ilustrativa'" que injeta o texto fixo (constante única) no `mandatoryArtworkText` final; remover a instrução incondicional dos 4 prompts e substituí-la por bloco condicional de composição. **Default marcado** preserva o comportamento atual e a proteção legal do UAT-3, mas cria o **opt-out**.
2. **Validade da oferta em modos estruturados (D4/D5)** — seção de validade no form (apenas para `campaignIntent === "offer"`) com 6 modos (Sem validade / Até uma data / De... até... / Somente hoje / Enquanto durarem os estoques / Texto personalizado), cada um gerando `displayText` **nu, sem prefixo**. O form passa a enviar `validity: displayText`.
3. **Preservar o texto obrigatório livre (D2)** — o textarea continua existindo e coexiste com o checkbox; são campos distintos na UI com intenções distintas (aviso ilustrativo fixo × texto livre obrigatório).
4. **Transporte normalizado, UI preservada (D3)** — checkbox + texto obrigatório são enviados pelo mesmo campo legado `mandatoryArtworkText`, **concatenados** (ex.: `"Imagem meramente ilustrativa\nConsulte condições na loja."`). A UI mantém os campos distintos; o mapper/snapshot continuam inalterados. Sem migration SQL.
5. **Prompt reframe com regressão por intent (D6)** — os 4 prompts do diretor perdem o hardcode e ganham o bloco condicional. A regressão garante **duas coisas distintas**: (a) o **conjunto de variáveis/keys do prompt permanece idêntico** para o mesmo input (golden `EXPECTED_KEYS` = 38) — o **texto do prompt muda intencionalmente** (D6); (b) o **comportamento visual default é preservado** (checkbox marcado → aviso na arte como hoje).
6. **Descrição existente permanece como está (D8)** — "Detalhes da oferta/produto" é a **Descrição existente** (`product.description`), **sem** novo campo `campaignDetails` nesta fase.

**Entrega verificável:**
- Checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) + textarea "Texto obrigatório na arte" coexistindo no form
- Validade da oferta com 6 modos, visível só para `offer`, gerando `displayText` nu e enviando `validity` no body
- 4 prompts do diretor sem instrução incondicional; bloco condicional de composição presente
- Constante única do aviso ilustrativo (singular) unificada no form, prompts e testes
- `validity` e `mandatoryArtworkText` concatenado chegando ao mapper → `commercial.validity`/`legalNotice` (sem mudança de contrato)
- Testes: modos de validade, checkbox × texto, prompt condicional, golden por intent, regressão
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Estado Atual / Base Para F40

```
                                                ESTADO ATUAL (pós-F39)            DEPOIS (F40)
═══════════════════════════════════════════════════════════════════════════════════════════════

Aviso ilustrativo:
  Controle no form                      inexistente (só textarea livre)          checkbox "Exibir 'Imagem
                                                                                   meramente ilustrativa'"
                                                                                   (default marcado) + textarea
  Prompts do diretor                   "SEMPRE acrescente ... Imagem             bloco condicional (só quando
                                        meramente ilustrativa" (hardcode,        legalNotice.enabled=true)
                                        incondicional nos 4 prompts)
  String do aviso                      inconsistente (singular × plural)         constante única (D2)
  Transporte                           mandatoryArtworkText (string livre)       mesmo campo; checkbox+texto
                                                                                   concatenados com "\n" (D3)

Validade:
  UI                                   inexistente (campo dorme no schema)       6 modos estruturados (D4)
  Visibilidade                         sempre no prompt (se string)              só quando intent=offer
  displayText                          string livre (heurística antiga)          frase nua, sem prefixo (D5)
                                                                                   ex.: "até 30/09"
  Envio no body                       NÃO enviado pelo form                       validity: displayText

Descrição:
  Campo                                "Descrição" → product.description          inalterada (D8 — sem novo
                                                                                   campo campaignDetails)
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F40) |
|------|-------------------|------------------|
| **Checkbox ilustrativo** | Opção A1: "substituir o textarea pelo checkbox" | **Rejeitado (D2)**: checkbox **coexiste** com o textarea livre — quatro intenções distintas (ilustrativo, validade, detalhes, texto obrigatório) |
| **Prompts do diretor** | "F40 só mexe no form; prompts intocados" | **D6 — a F40 toca os 4 prompts**: remove o hardcode incondicional do UAT-3 e insere bloco condicional; default marcado preserva comportamento. Amplia escopo para prompt engineering + testes de regressão |
| **Validade** | "string livre no form" | **Modos estruturados (D4)**: 6 modos, só para oferta, gerando `displayText` determinístico |
| **displayText com prefixo** | "Oferta válida até 30/09" no campo | **Frase nua (D5)**: `"até 30/09"`; as duas superfícies compõem o rótulo (`buildCommercialRepertoire` e template offer/base) — sem mudança em backend/reviewer/testes |
| **Transporte de campos distintos** | "enviar checkbox e texto como campos separados" | **Normalização (D3)**: mesmo campo legado `mandatoryArtworkText`, concatenados; UI preserva campos distintos; snapshot guarda texto final |
| **Detalhes da oferta/produto** | "criar `campaignDetails`" | **Reusar "Descrição" existente (D8)**: nenhum campo novo; `campaignDetails`/`additionalDetails`/`availabilityNotes` permanecem adormecidos sem UI |
| **Copy Director com validade/aviso** | "validade na legenda" | **Fora (D7)**: validade e aviso são escopo da arte/review, não da legenda |
| **Numeração** | "F40 já era Stripe nos trackings" | **F40 = Campos Comerciais e Avisos do Brief; Stripe → F41 (D1)**; runbook de trackings |

---

## Decisões de Alinhamento

### D1 — Numeração: F40 = Campos Comerciais e Avisos do Brief (v1.5), Stripe → F41 (v1.7) + runbook de trackings

`DECIDIDO` (segue o precedente da F39 D1 / F37 D11)

| Antes | Depois |
|-------|--------|
| F40 = Stripe / Monetização Pública (v1.7, pós-beta) | **F40 = Campos Comerciais e Avisos do Brief** (nova, v1.5) |
| — | **F41 = Stripe / Monetização Pública** (v1.7, pós-beta) |

A fase conflitante é **incrementada** (não apagada).

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 40 → "Campos Comerciais e Avisos do Brief \| v1.5 \| 0/0 \| ○ Pending"; adicionar linha 41 → "Stripe / Monetização Pública \| v1.7 \| 0/0 \| ○ Pending". Atualizar menções a "F40 (Stripe)" para "Stripe (F41)". Adicionar bullet da F40 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F40 = Campos Comerciais e Avisos do Brief (v1.5), F41 = Stripe/Monetização Pública (v1.7)". Linha da tabela Progress 40 → Campos/avisos; adicionar linha 41 → Stripe. Atualizar notas de renumeração e menções "Phase 40 (Stripe)" em Dependencies → F41. Atualizar Dependency Graph. Adicionar seção "### Phase 40 — Campos Comerciais e Avisos do Brief". Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 40`. Tabela "Next Phases": F40 → "○ In progress — Campos Comerciais e Avisos do Brief (v1.5)"; F41 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta, renumerada de F40)". Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... F40 (v1.7)" → **F41**. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F40/v1.7" → **F41/v1.7** |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F40)" → **(F41)** |

**Regras gerais (padrão F37 D11 / F39 D1):**
- Artefatos históricos (alinhamentos F26–F39.x, quick-plans, CONTEXT de fases concluídas) **não são reescritos** — refletem o estado da época.
- O `openspec/changes/fase-40-campos-comerciais-avisos-brief/` será a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele.
- Renumeração de fases futuras segue a regra: a fase conflitante é incrementada (não apagada).

---

### D2 — Checkbox ilustrativo coexiste com texto obrigatório; default marcado; constante única

`DECIDIDO` (rejeição da opção A1 — "substituir textarea pelo checkbox")

- **Quatro intenções distintas** no form, sem fusão:
  1. **Ilustrativo** → checkbox "Exibir 'Imagem meramente ilustrativa'" (texto fixo);
  2. **Validade** → modos estruturados (D4);
  3. **Detalhes da oferta/produto** → **Descrição existente** (`product.description`, D8);
  4. **Texto obrigatório na arte** → textarea livre (campo atual mantido).
- **Checkbox default = marcado** na primeira versão: preserva o comportamento atual (arte sempre exibiu o aviso via UAT-3) e a proteção legal contra drift de imagem do produto, criando o **opt-out**.
- **Constante única** `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` (singular, alinhada ao UAT-3 e aos prompts): normaliza as referências plurais existentes ("Ex: Imagens meramente ilustrativas" no placeholder e várias fixtures de teste).
- O checkbox, quando marcado, **injeta** o texto fixo no texto obrigatório final (D3); quando desmarcado e sem texto livre, `mandatoryArtworkText` fica ausente → `legalNotice.enabled=false` → **nada entra na arte** (regra F39 D9 preservada, agora com controle real).

---

### D3 — Transporte normaliza para texto final; UI preserva campos distintos

`DECIDIDO` (aceita concatenação no campo legado para F40)

- Checkbox + texto obrigatório são enviados pelo **mesmo campo legado** `mandatoryArtworkText`, concatenados com `\n`:
  - checkbox marcado + texto livre → `"Imagem meramente ilustrativa\nConsulte condições na loja."`
  - checkbox marcado sem texto → `"Imagem meramente ilustrativa"`
  - checkbox desmarcado + texto livre → só o texto
  - checkbox desmarcado + sem texto → campo ausente (`undefined`)
- **A UI preserva campos distintos** (checkbox e textarea separados); o transporte normaliza para um texto final. Registrado explicitamente no proposal para evitar futura ambiguidade.
- **Form state mantém os campos separados até o submit (autosave/restore):** o estado do form guarda `showIllustrativeNotice` (boolean) e `mandatoryArtworkTextFree` (string) **separadamente**; a concatenação acontece **apenas na montagem do body**. O autosave/draft salva e restaura os dois campos distintos — se salvar só o `mandatoryArtworkText` final, ao restaurar "checkbox marcado + texto livre" fica **indistinguível** de texto livre digitado com a frase (perda de intenção).
- **Sem mudança de contrato/backend:** o mapper F39 (`mandatoryArtworkText` → `legalNotice { enabled, text }`) e o snapshot `campaign_brief_v1` continuam como estão — o snapshot guarda o texto final concatenado (aceitável para F40).
- **Sem migration SQL.**

---

### D4 — Validade: 6 modos estruturados, visível apenas para oferta

`DECIDIDO` (validade como campo estruturado de modos, não string livre)

- A seção "Validade da oferta" **só aparece quando `campaignIntent === "offer"`** (coerente com `buildCommercialRepertoire`, `image-generation-service.ts:738`).
- **Modos** (select/cards) → geração de `displayText`:

| Modo | UI | displayText gerado |
|------|-----|---------------------|
| Sem validade | nada | (ausente — não envia) |
| Até uma data | date end | `até 30/09` |
| De... até... | date start + date end | `de 25/09 até 30/09` |
| Somente hoje | opção | `somente hoje` |
| Enquanto durarem os estoques | opção | `enquanto durarem os estoques` |
| Texto personalizado | input livre | texto do usuário (com normalização leve, D5) |

- A UI pode ter **datas estruturadas** (date pickers) mas o backend recebe **texto final** — `validity: displayText` no body. `endDate` (ISO) permanece **reservado, sem envio** (F39 D8 mantido).
- O form passa a enviar `validity` (antes nunca enviado): `use-campaign-form.ts:625-638` ganha `validity: <displayText ou undefined>`.
- **Decisão operacional — troca de intent (D4):** se o usuário preenche validade em `offer` e **troca para spotlight/exclusive**, o form **não envia `validity`** no body, mas **preserva o rascunho internamente** (form state) — se voltar para `offer`, a validade preenchida reaparece. Não há perda de dados na navegação entre intents; só o envio é condicionado a `offer`.

---

### D5 — `displayText` frase nua sem prefixo; as superfícies do prompt compõem o rótulo

`DECIDIDO` (opção 1 — mantém backend estável)

- `validity.displayText` representa **apenas o conteúdo da validade**, sem o rótulo "Oferta válida". Exemplos:
  ```ts
  displayText = "até 30/09"
  displayText = "de 25/09 até 30/09"
  displayText = "somente hoje"
  displayText = "enquanto durarem os estoques"
  displayText = "toda sexta-feira"
  ```
- **Existem DUAS superfícies que exibem a validade no prompt** (não um único ponto de composição):
  1. `buildCommercialRepertoire` → `- Oferta válida: ${displayText}` (`image-generation-service.ts:739`) — repertório comercial;
  2. template offer/base → `**Validade da oferta:** {{validity}}` (`campaign-image-director-offer.md:83`) — dado direto no bloco de restrições.
  Com `displayText` nu ("até 30/09"), cada superfície compõe o rótulo uma única vez ("Oferta válida: até 30/09" e "Validade da oferta: até 30/09"). Existe uma **repetição informacional já existente** (o mesmo fato em duas seções do prompt) — aceita, e a F40 **não mexe em nenhuma das duas superfícies**. O `displayText` nu evita o erro de duplicação de rótulo ("Oferta válida: Oferta válida até 30/09") e a divergência entre superfícies.
- **Sem mudança** em `buildCommercialRepertoire`, revisor, `buildPromptVariables` ou testes existentes. A **UI é responsável** por não deixar o lojista salvar "Oferta válida..." quando escolhe modos estruturados.
- **Texto personalizado — normalização leve:** aceitar `até 30/09` como está; se o usuário digitar `Oferta válida até 30/09`, **limpar o prefixo** antes de enviar. Se o texto não tiver relação temporal (ex.: "somente para clientes cadastrados"), é sinal de que é mais "texto obrigatório" do que validade — orientação de UI, sem bloqueio.
- Fixtures existentes com strings completas ("válida até 30/09", "Oferta válida até 31/12") são **normalizadas** nesta fase (o contrato continua o mesmo: displayText livre).

---

### D6 — Prompt reframe: remover hardcode incondicional → bloco condicional de composição

`DECIDIDO` (refinamento do usuário sobre a opção "remover hardcode + default marcado")

- **Antes** (herança UAT-3, nos 4 prompts do diretor):
  ```text
  SEMPRE acrescente a arte o seguinte texto (esse texto pode ser minúsculo mas deve ser legível - e deve ser posicionado nas margens da arte, horizontal ou vertical): "Imagem meramente ilustrativa"
  ```
- **Depois** — bloco condicional de composição, no mesmo local:
  ```text
  Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte.
  Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.
  ```
- Mantém a **inteligência visual herdada do UAT-3** (legibilidade, posição lateral, não competir com o produto/preço) mas **respeita o checkbox como controle real**: `legalNotice.enabled=false` → o aviso **não** entra na arte.
- A linha condicional do texto obrigatório já existente ("Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}})... Não o repita na legenda.") é **mantida**.
- **Escopo ampliado para prompt engineering + testes de regressão** (por intent: offer/spotlight/exclusive) — inevitável: manter o hardcode faz o checkbox mentir; remover sem instrução perde qualidade visual.

---

### D7 — Copy Director fora de escopo (validade e aviso são da arte/review)

`DECIDIDO` (coerente com F25 e revisor)

- `CopyDirectorInput` **não recebe** `validity`/`legalNotice` (sem mudança em `src/lib/copy/schema.ts`).
- Validade e aviso são **informação da arte**, não da legenda — revisor já instrui: "Não repetir o texto obrigatorio em legenda; o texto e escopo da arte, nao da legenda" (`image-review-service.ts:205`).
- O Copy Director continua consumindo apenas os campos comerciais atuais (preços, badge, intent).

---

### D8 — "Detalhes da oferta/produto" = Descrição existente; sem novo `campaignDetails`

`DECIDIDO` (esclarecimento do usuário — reusar a Descrição, não criar campo novo)

- O item "Detalhes da oferta/produto [textarea livre]" do layout inicial é a **Descrição existente** (`product.description`, `maxLength 120`, `campaign-input-form.tsx:391-422`), descrição comercial curta do produto/oferta. **Não se transforma em campo novo.**
- **Nenhum campo adormecido ganha UI nesta fase** — `campaignDetails`, `additionalDetails` e `availabilityNotes` continuam dormindo (já no schema HTTP/prompts/mapper, sem formulário). Criar `campaignDetails` abriria outra frente de UX (diferença entre "Descrição", "Detalhes adicionais", "Contexto da campanha", "Texto obrigatório" e "Validade") — nebuloso para o lojista.
- **Agrupamento alvo da UI** (orientativo para P40-03; a "Descrição" permanece onde fizer mais sentido no fluxo do produto):
  ```text
  Produto
  - Nome
  - Descrição

  Oferta
  - Preço
  - Condição/benefício
  - Validade da oferta

  Avisos e texto obrigatório
  [ ] Exibir "Imagem meramente ilustrativa"
  - Texto obrigatório na arte
  ```

---

### D9 — Snapshot sem mudança de contrato

`DECIDIDO` (reuso do que a F39 já construiu)

- `campaign_brief_v1` continua como está: `commercial.validity` (via `validity` no body) e `commercial.legalNotice` (via `mandatoryArtworkText` concatenado) — **sem nova chave, sem migration**.
- `getCampaignLegalNotice` (`brief.ts:134`, testado) permanece o helper canônico para leitura (F37 consumirá).
- O snapshot registra o **texto final** (concatenado/quando aplicável) — a UI é quem preserva os campos distintos (D3). Se uma fase futura precisar persistir a separação checkbox/texto, será decisão posterior.

---

```
ARQUIVOS MODIFICADOS (principais — planejamento da fase):
═══════════════════════════════════════════════════════════════

src/lib/campaign/constants.ts                ← NOVO — constante neutra ILLUSTRATIVE_NOTICE_TEXT
                                                (frontend importa sem arrastar o builder/domínio — D2)
src/components/flow/use-campaign-form.ts        ← estado do checkbox (default true), modos de validade,
                                                  datas, displayText gerado, concatenação, envio de
                                                  validity + mandatoryArtworkText (D3/D4/D5)
src/components/flow/campaign-input-form.tsx     ← seções Produto/Oferta/Avisos (D8), checkbox +
                                                  textarea coexistindo, seletor de validade offer-only
src/components/campaign/mandatory-artwork-field.tsx
                                               ← mantém textarea; placeholder/constante unificada (D2)
src/components/campaign/illustrative-notice-field.tsx
                                               ← NOVO — checkbox do aviso ilustrativo (ou integrado
                                                  ao mandatory-artwork-field)
src/components/campaign/validity-field.tsx      ← NOVO — 6 modos de validade → displayText

prompts/campaign-image-director.md              ← remover hardcode incondicional (linha ~130) → bloco
prompts/campaign-image-director-offer.md        ←   condicional (D6); manter linha do texto obrigatório
prompts/campaign-image-director-spotlight.md    ←   e não repetir em legenda
prompts/campaign-image-director-exclusive.md    ←

Testes (novos/co-migrados):
src/lib/campaign/__tests__/brief.test.ts        ← casos checkbox/validade (constante via constants.ts)
src/components/flow/__tests__/use-campaign-form-navigation.test.ts  ← novos campos no EMPTY_FIELDS
src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx  ← mock MandatoryArtworkField co-migrado
src/lib/image-generation/services/__tests__/image-generation-service.test.ts  ← fixtures singular/plural
src/lib/image-generation/services/__tests__/image-review-service.test.ts  ← fixtures + seções
src/app/api/campaign/generate-image/__tests__/route.test.ts   ← fixtures validity/mandatoryArtworkText
```

---

## Contratos de Integração

```typescript
// src/lib/campaign/constants.ts — constante neutra compartilhada (D2)
// Frontend importa AQUI, sem arrastar o builder/domínio do brief.
export const ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa";

// Aviso ilustrativo → texto obrigatório final (D2/D3)
// checkbox marcado:
//   textFree ? `${ILLUSTRATIVE_NOTICE_TEXT}\n${textFree}` : ILLUSTRATIVE_NOTICE_TEXT
// checkbox desmarcado:
//   textFree ?? undefined        // ausente → legalNotice.enabled=false → nada na arte
```

```typescript
// Validade — modos → displayText (D4/D5); o campo é SOMENTE para intent=offer
export type ValidityMode =
  | "none"            // Sem validade → não envia validity
  | "until_date"      // "até 30/09"
  | "range"           // "de 25/09 até 30/09"
  | "today_only"      // "somente hoje"
  | "while_stocks"    // "enquanto durarem os estoques"
  | "custom";         // texto do usuário (normalização leve: limpa prefixo "Oferta válida")

// Formato de data usado no displayText: dd/mm (ex.: "30/09")

// Exemplo de body enviado pelo form (D3/D4):
// {
//   storeId, productName, originalPriceCents, discountedPriceCents,
//   description, badgeText, campaignIntent,
//   ...(campaignIntent === "offer" ? {} : { preserveImageContext }),
//   validity: "até 30/09",                            // NOVO — displayText nu (D5)
//   mandatoryArtworkText: "Imagem meramente ilustrativa\nConsulte condições na loja.", // concatenação (D3)
//   productImageDataUrl,
// }
```

```typescript
// Sem mudança de contrato HTTP/domínio/snapshot:
// GenerateImageRequestSchema  → validity?: string | undefined (já existe)
//                              → mandatoryArtworkText?: string | undefined (já existe)
// buildCampaignBriefFromFlat  → validity string → { enabled: true, displayText } (já existe — brief.ts:153-155)
//                              → mandatoryArtworkText → legalNotice { enabled, text } (já existe)
// buildCampaignBriefSnapshot  → persiste commercial.validity/legalNotice (já existe)
// getCampaignLegalNotice      → helper de leitura (já existe — brief.ts:134)
```

```text
// Prompt do diretor — bloco condicional no lugar do hardcode (D6)
// ANTES:
//   SEMPRE acrescente a arte o seguinte texto ... : "Imagem meramente ilustrativa"
// DEPOIS:
//   Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte.
//   Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível
//   e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.
```

```sql
-- NENHUMA migration nesta fase
-- (campaign_brief_v1 continua jsonb; validade/aviso já persistidos — D9)
```

---

## Testes

Padrão do repositório (vitest + Testing Library). Suíte estimada ~21+ testes novos. Referências: D2–D6.

### Validade (modos → displayText) — 8 testes
| # | Teste | Valida |
|---|-------|--------|
| 1 | Modo "Sem validade" → `validity` ausente no body; mapper → campo ausente (nunca `enabled:false`) | D4/D5 |
| 2 | Modo "Até uma data" (date end) → `displayText` = `"até 30/09"` (dd/mm) | D4/D5 |
| 3 | Modo "De... até..." (start+end) → `displayText` = `"de 25/09 até 30/09"` | D4/D5 |
| 4 | Modo "Somente hoje" → `"somente hoje"` | D4/D5 |
| 5 | Modo "Enquanto durarem os estoques" → `"enquanto durarem os estoques"` | D4/D5 |
| 6 | Modo "Texto personalizado" → texto do usuário; prefixo "Oferta válida" limpo se digitado | D5 |
| 7 | Validade só aparece/é enviada para `campaignIntent === "offer"`; troca offer→spotlight/exclusive NÃO envia `validity` mas preserva o rascunho no form state (voltar a `offer` restaura a validade preenchida) | D4 |
| 8 | `displayText` nu não duplica rótulo — nas DUAS superfícies: `buildCommercialRepertoire` gera `- Oferta válida: até 30/09` e o template mantém `**Validade da oferta:** até 30/09` (repetição informacional aceita, sem duplicação de rótulo) | D5 |

### Checkbox × texto obrigatório — 7 testes
| # | Teste | Valida |
|---|-------|--------|
| 9 | Checkbox marcado + sem texto → `mandatoryArtworkText` = `ILLUSTRATIVE_NOTICE_TEXT` | D2/D3 |
| 10 | Checkbox marcado + texto → concatenação `"Imagem meramente ilustrativa\n{texto}"`; mapper → `legalNotice.text` | D2/D3 |
| 11 | Checkbox desmarcado + texto → apenas o texto | D2/D3 |
| 12 | Checkbox desmarcado + sem texto → campo ausente → `legalNotice` ausente → nada na arte | D2/D3 |
| 13 | Default do checkbox = marcado (estado inicial do form) | D2 |
| 14 | Constante única usada no form, prompts e fixtures (sem strings soltas/divergentes singular×plural) | D2 |
| 15 | Autosave/restore preserva a intenção: `showIllustrativeNotice` e `mandatoryArtworkTextFree` salvos/restaurados separados; concatenação só no submit (checkbox marcado + texto livre ≠ texto livre digitado com a frase) | D3 |

### Prompt reframe — 6 testes
| # | Teste | Valida |
|---|-------|--------|
| 16 | Os 4 prompts do diretor NÃO contêm a instrução incondicional "SEMPRE acrescente ... Imagem meramente ilustrativa" | D6 |
| 17 | Os 4 prompts contêm o bloco condicional (texto obrigatório informado → exibir exatamente; tipografia mínima/visível/legível, posição lateral, sem competir com oferta/produto/preço) | D6 |
| 18 | `legalNotice.enabled=false` → `mandatoryArtworkText` vazio no prompt e `mandatoryArtworkTextSection` vazio no revisor | D2/D6 |
| 19 | `validity.enabled` + displayText (offer) → `validityTextSection` montado no revisor; ausente → vazio | D4/D5 |
| 20 | Golden por intent (offer/spotlight/exclusive) — **conjunto de variáveis/keys idêntico** (EXPECTED_KEYS = 38) com os novos campos preenchidos; **o texto do prompt muda intencionalmente** (D6) | D6 |
| 21 | Reviewer com checkbox default marcado → seção "Texto Obrigatorio na Arte" contém `ILLUSTRATIVE_NOTICE_TEXT`; rigor literal para aviso legal preservado | D2/D6 |

### Regressão (obrigatória)
- `generate-image` — fluxo completo (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o mesmo payload
- Co-migração de fixtures na mesma fase: `route.test.ts`, `image-generation-service.test.ts` (singular/plural), `image-review-service.test.ts`, `use-campaign-form-navigation.test.ts` (novos campos no `EMPTY_FIELDS`), `campaign-flow-credits.test.tsx` (mock `MandatoryArtworkField`)
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Remover o hardcode muda a arte de campanhas sem checkbox** (hoje a arte sempre exibe o aviso) | **Default marcado** (D2) preserva o comportamento atual e a proteção legal; UAT visual obrigatório antes de fechar a fase |
| **Checkbox vira no-op se os prompts não forem tocados** | **D6**: a F40 remove o hardcode incondicional dos 4 prompts e insere o bloco condicional — sem isso, o checkbox mente |
| **Duplicação de rótulo de validade** ("Oferta válida: Oferta válida até 30/09") | **D5**: displayText é frase nua; a UI não deixa salvar o prefixo em modos estruturados; normalização leve no texto personalizado + teste 8 |
| **Inconsistência singular×plural do aviso** em fixtures/placeholder | Constante única (D2) + co-migração de fixtures na mesma fase (teste 14) |
| **Autosave/restore perder a distinção checkbox×texto** (se concatenar cedo demais, "checkbox marcado + texto livre" vira indistinguível de texto livre digitado com a frase) | **D3** — form state guarda `showIllustrativeNotice` e `mandatoryArtworkTextFree` separados; concatenação só no submit; teste 15 cobre o restore |
| **Co-migração de mocks do form** (`campaign-flow-credits.test.tsx` mocka `MandatoryArtworkField: () => null`; novos campos no `EMPTY_FIELDS` quebram testes de navegação) | Atualizar mocks e `EMPTY_FIELDS` na mesma fase; rodar suíte completa de form |
| **Escopo crescer para ativar campos adormecidos** (`campaignDetails`/`additionalDetails`/`availabilityNotes`) | **D8**: nenhum campo adormecido ganha UI na F40; "Detalhes da oferta/produto" = Descrição existente |
| **`endDate` confundido como campo a enviar** | **D4**: datas na UI apenas geram `displayText`; `endDate` permanece reservado/sem envio (F39 D8) |
| **Uso indevido de validade em intents não-oferta** | **D4**: a seção só aparece para `offer`; `buildCommercialRepertoire` já restringe por intent (`:738`) |
| **Regressão no Copy Director / revisor por mudança de prompt** | Copy Director intocado (D7); revisor não muda (seções já existem); golden por intent cobre prompts (teste 20) |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Ativar campos adormecidos na UI** (`campaignDetails`, `additionalDetails`, `availabilityNotes`, `hook`, `cta`, `objective`, `targetChannel`, `format`, `sensitiveConstraints`) | **D8** — permanecem sem formulário; "Detalhes da oferta/produto" = Descrição existente |
| **`endDate` (ISO) estruturado no envio** | **D4** — datas da UI só geram `displayText`; `endDate` reservado (F39 D8) |
| **Copy Director com validade/aviso na legenda** | **D7** — validade e aviso são escopo da arte/review |
| **Página de campanha exibindo validade/aviso** | F37 (revisão/aprovação) consome o snapshot; não é escopo da F40 |
| **Migration SQL / mudança de contrato** | **D9** — `campaign_brief_v1` reusa `commercial.validity`/`legalNotice`; sem nova chave |
| **Persistência de separação checkbox/texto no snapshot** | **D3** — transporte normaliza para texto final na F40; decisão futura se necessário |
| **Catálogo de produtos por loja (persistência)** | F39 D3 — fase subsequente |
| **Stripe / Monetização Pública** | **F41** (v1.7, pós-beta) — renumeração D1 |
| **F37 — Revisão e Aprovação da Arte** | Fase própria, após F40; consome o snapshot |
| **Novo campo `campaignDetails` no form** | **D8** — reusar "Descrição" existente; evitar sobreposição de UX |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Numeração: F40 = Campos Comerciais e Avisos do Brief (v1.5), Stripe → F41 (v1.7); runbook de trackings aplicado (6 arquivos)
- [ ] D2 — Checkbox ilustrativo coexiste com texto obrigatório; default marcado; constante única `ILLUSTRATIVE_NOTICE_TEXT`
- [ ] D3 — Transporte normaliza para texto final (concatenação `\n`); UI preserva campos distintos; form state guarda `showIllustrativeNotice`/`mandatoryArtworkTextFree` separados (autosave/restore); snapshot guarda texto final
- [ ] D4 — Validade: 6 modos estruturados, visível só para `offer`, gera `displayText`; `endDate` reservado
- [ ] D5 — `displayText` frase nua sem prefixo; nas duas superfícies (`- Oferta válida:` e `**Validade da oferta:**`) sem duplicação de rótulo; normalização leve no personalizado
- [ ] D6 — Prompts do diretor sem hardcode incondicional → bloco condicional de composição; default marcado preserva comportamento
- [ ] D7 — Copy Director fora (validade/aviso = arte/review, não legenda)
- [ ] D8 — "Detalhes da oferta/produto" = Descrição existente; nenhum campo adormecido ganha UI
- [ ] D9 — Snapshot sem mudança de contrato (`campaign_brief_v1` reuso); sem migration SQL

### Fluxo (comportamento preservado + novos controles)
- [ ] Checkbox default marcado → arte mantém o aviso ilustrativo como hoje (UAT visual)
- [ ] Checkbox desmarcado + sem texto → arte SEM o aviso (opt-out real)
- [ ] Checkbox marcado + texto livre → arte exibe ambos (concatenação) no bloco condicional
- [ ] Validade só visível para `offer`; cada modo gera `displayText` correto ("até 30/09", "de 25/09 até 30/09", "somente hoje", "enquanto durarem os estoques", personalizado)
- [ ] Troca de intent preserva rascunho: preencher validade em `offer`, trocar para spotlight/exclusive (não envia), voltar a `offer` → validade reaparece (D4)
- [ ] Nenhuma duplicação de "Oferta válida" na arte
- [ ] Prompts: **conjunto de variáveis/keys idêntico** para o mesmo input (golden por intent); **texto do prompt muda intencionalmente** (D6); comportamento visual default preservado
- [ ] Autosave/restore: recarregar o rascunho restaura checkbox e textarea separados (intenção original preservada)
- [ ] Copy Director e revisor sem mudança de comportamento
- [ ] `validity` e `mandatoryArtworkText` concatenado chegam ao mapper → `commercial.validity`/`legalNotice` (sem mudança de contrato)

### Snapshot / auditoria
- [ ] `campaign_brief_v1` continua como está — `commercial.validity`/`legalNotice` persistidos sem nova chave
- [ ] `getCampaignLegalNotice` continua canônico (F37 consumirá)

### Renumeração (D1 — trackings)
- [ ] `ROADMAP.md` (raiz) — F40 = Campos/avisos; F41 = Stripe
- [ ] `.planning/ROADMAP.md` — phase numbering, tabela Progress, notas, deps, graph, seção Fase 40, rodapé
- [ ] `.planning/STATE.md` — frontmatter, Current Position, Next Phases, Last updated
- [ ] `.planning/PROJECT.md` — Stripe F40 → F41; rodapé
- [ ] `.planning/REQUIREMENTS.md` — v1.7 "F40" → "F41"
- [ ] `.planning/MILESTONES.md` — "v1.7 (F40)" → "(F41)"

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo co-migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local
- [ ] Gerar campanha offer com checkbox marcado (default) → arte com aviso ilustrativo legível, posição lateral
- [ ] Gerar campanha offer com checkbox desmarcado e sem texto → arte SEM aviso
- [ ] Gerar campanha offer com validade (modos distintos) → texto de validade correto na arte, sem duplicação de "Oferta válida"
- [ ] Rascunho com checkbox marcado + texto livre → recarregar restaura checkbox e texto separados (intenção preservada)
- [ ] Gerar campanha spotlight/exclusive → seção de validade NÃO aparece; aviso segue o checkbox
- [ ] Preencher validade em offer, trocar para spotlight e voltar → validade reaparece no form (rascunho preservado; não enviada no meio)
- [ ] Campanha antiga (pré-F40) continua exibindo/baixando normalmente (sem migração destrutiva)