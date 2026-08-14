## Context

A F39 estrutureu o domínio `CampaignBrief` e deixou o backend **~90% pronto** para os campos comerciais e avisos — mas **sem UI**:

- `commercial.validity { enabled, displayText?, endDate? }` e `commercial.legalNotice { enabled, text? }` vivem no domínio (`src/lib/campaign/brief.ts:82-83`) e no zod (`brief-schema.ts:36,43`).
- `buildCampaignBriefFromFlat` (`brief.ts:146`) já converte `validity` (string) → `{ enabled: true, displayText }` (`brief.ts:153-155`) e `mandatoryArtworkText` → `legalNotice { enabled: true, text }` (`brief.ts:157-159`) — ambos **nunca fabricados** quando ausentes (`brief.ts:189-190`).
- O snapshot `campaign_brief_v1` já persiste `commercial.validity`/`legalNotice` via `buildCampaignBriefSnapshot`, com teste de ausência/presença.
- A pipeline já lê os campos: `buildPromptVariables` expõe `validity`/`mandatoryArtworkText`; `buildCommercialRepertoire` decide por `validity.enabled && displayText && campaignIntent === "offer"` → `- Oferta válida: ${displayText}` (`image-generation-service.ts:738-739`); o revisor já tem `validityTextSection`/`mandatoryArtworkTextSection` com rigor literal (`image-review-service.ts:185-223`).
- **O form nunca envia `validity`** — o body do `use-campaign-form.ts` (`:625-638`) só contém `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext`, `mandatoryArtworkText`, `productImageDataUrl`.
- **`mandatoryArtworkText` é string livre** (`mandatory-artwork-field.tsx`): textarea com placeholder "Ex: Imagens meramente ilustrativas", `maxLength 200`, renderizado em `campaign-input-form.tsx:503-505`. A semântica de "ligado" é confundida com "string não vazia" — **não existe checkbox**.
- **Os 4 prompts do diretor hardcodam o aviso ilustrativo como instrução incondicional** (herança UAT-3, `2026-07-13`): `campaign-image-director.md:130`, `-offer.md:131`, `-spotlight.md:129`, `-exclusive.md:138` → `SEMPRE acrescente a arte o seguinte texto ... : "Imagem meramente ilustrativa"`. Isso contradiz a F39 D9 (`enabled=false` → nada na arte): mesmo desmarcado, a arte exibe o aviso. **Se a F40 adicionasse o checkbox sem tocar nos prompts, o checkbox seria no-op.**
- **`endDate` (ISO) permanece reservado** (F39 D8): datas na UI apenas geram `displayText`; o backend continua recebendo texto final — sem envio de `endDate`.
- **Copy Director fora:** `CopyDirectorInput` (`src/lib/copy/schema.ts`) não recebe `validity`/`legalNotice` — coerente com F25 e revisor ("Não repetir o texto obrigatorio em legenda; o texto e escopo da arte, nao da legenda", `image-review-service.ts:205`).
- **Inconsistência de string:** singular ("Imagem meramente ilustrativa" — prompts UAT-3 e fixtures) × plural ("Imagens meramente ilustrativas" — placeholder do form e várias fixtures). A F40 unifica numa constante (D2).
- **Campos adormecidos permanecem sem UI:** `availabilityNotes`, `campaignDetails`, `additionalDetails`, `hook`, `cta`, `objective`, `targetChannel`, `format`, `sensitiveConstraints` — já no schema HTTP/prompts/mapper, sem formulário.

O objetivo da F40 é **trazer para o formulário** os campos comerciais e avisos que a F39 estrutureu mas que ainda não têm UI, com a semântica `enabled`/`displayText` já existente no backend — e **remover a instrução incondicional dos prompts** para que o checkbox seja um controle real.

## Goals / Non-Goals

**Goals:**
- Checkbox "Exibir 'Imagem meramente ilustrativa'" como controle real (D2/D6) — default marcado, injeta a constante única no `mandatoryArtworkText` final; desmarcado + sem texto → campo ausente → `legalNotice.enabled=false` → nada na arte
- Remover a instrução incondicional "SEMPRE acrescente..." dos 4 prompts do diretor e substituí-la pelo bloco condicional de composição (D6); manter a inteligência visual herdada do UAT-3
- Validade da oferta em 6 modos estruturados (D4/D5), visível apenas para `offer`, gerando `displayText` nu; form passa a enviar `validity: displayText`
- Transporte normalizado (D3): checkbox + texto obrigatório via mesmo campo `mandatoryArtworkText` concatenado com `\n`; UI preserva campos distintos; form state separado (autosave/restore)
- Constante única `ILLUSTRATIVE_NOTICE_TEXT` (singular) em `src/lib/campaign/constants.ts`; co-migração de fixtures (D2)
- Sem mudança de contrato HTTP/domínio/snapshot (D9); sem migration SQL
- Testes (modos de validade, checkbox × texto, prompt condicional, golden por intent, regressão); `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros
- Renumeração de trackings (D1): F40 = Campos Comerciais e Avisos do Brief (v1.5), Stripe → F41 (v1.7)

**Non-Goals:**
- **Ativar campos adormecidos na UI** (`campaignDetails`, `additionalDetails`, `availabilityNotes`, `hook`, `cta`, `objective`, `targetChannel`, `format`, `sensitiveConstraints`) — D8; "Detalhes da oferta/produto" = Descrição existente (`product.description`)
- **`endDate` (ISO) estruturado no envio** — D4/F39 D8: datas da UI só geram `displayText`; `endDate` reservado
- **Copy Director com validade/aviso na legenda** — D7
- **Página de campanha exibindo validade/aviso** — F37 (revisão/aprovação) consome o snapshot; fora da F40
- **Migration SQL / mudança de contrato** — D9; `campaign_brief_v1` reusa `commercial.validity`/`legalNotice`
- **Persistência da separação checkbox/texto no snapshot** — D3: transporte normaliza para texto final; decisão futura se necessária
- **Catálogo de produtos por loja** — fase subsequente (F39 D3)
- **Stripe / Monetização Pública** — F41 (v1.7, pós-beta) — renumeração D1
- **F37 — Revisão e Aprovação da Arte** — fase própria, após F40
- **Novo campo `campaignDetails` no form** — D8: reusar "Descrição" existente

## Decisions

### D1 — Numeração: F40 = Campos Comerciais e Avisos do Brief (v1.5), Stripe → F41 (v1.7) + runbook de trackings

`DECIDIDO` (segue o precedente da F39 D1 / F37 D11: a fase conflitante é incrementada, não apagada)

| Antes | Depois |
|-------|--------|
| F40 = Stripe / Monetização Pública (v1.7, pós-beta) | **F40 = Campos Comerciais e Avisos do Brief** (nova, v1.5) |
| — | **F41 = Stripe / Monetização Pública** (v1.7, pós-beta) |

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 40 → "Campos Comerciais e Avisos do Brief \| v1.5 \| 0/0 \| ○ Pending"; adicionar linha 41 → "Stripe / Monetização Pública \| v1.7 \| 0/0 \| ○ Pending". Atualizar menções a "F40 (Stripe)" para "Stripe (F41)". Adicionar bullet da F40 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F40 = Campos Comerciais e Avisos do Brief (v1.5), F41 = Stripe/Monetização Pública (v1.7)". Linha da tabela Progress 40 → Campos/avisos; adicionar linha 41 → Stripe. Atualizar notas de renumeração e menções "Phase 40 (Stripe)" em Dependencies → F41. Atualizar Dependency Graph. Adicionar seção "### Phase 40 — Campos Comerciais e Avisos do Brief". Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 40`. Tabela "Next Phases": F40 → "○ In progress — Campos Comerciais e Avisos do Brief (v1.5)"; F41 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta, renumerada de F40)". Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... F40 (v1.7)" → **F41**. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F40/v1.7" → **F41/v1.7** |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F40)" → **(F41)** |

Regras gerais (padrão F37 D11 / F39 D1): artefatos históricos não são reescritos; `openspec/changes/fase-40-campos-comerciais-avisos-brief/` é a fonte da verdade da fase; renumeração de fases futuras segue a regra da fase conflitante incrementada.

### D2 — Checkbox ilustrativo coexiste com texto obrigatório; default marcado; constante única

`DECIDIDO` (rejeição da opção A1 — "substituir textarea pelo checkbox")

- **Quatro intenções distintas** no form, sem fusão:
  1. **Ilustrativo** → checkbox "Exibir 'Imagem meramente ilustrativa'" (texto fixo);
  2. **Validade** → modos estruturados (D4);
  3. **Detalhes da oferta/produto** → **Descrição existente** (`product.description`, D8);
  4. **Texto obrigatório na arte** → textarea livre (campo atual mantido).
- **Checkbox default = marcado** na primeira versão: preserva o comportamento atual (arte sempre exibiu o aviso via UAT-3) e a proteção legal contra drift de imagem, criando o **opt-out**.
- **Constante única** `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` (singular, alinhada ao UAT-3 e aos prompts) em `src/lib/campaign/constants.ts` — módulo **neutro** (sem `server-only`), para o frontend importar sem arrastar o builder/domínio do brief. Normaliza as referências plurais ("Ex: Imagens meramente ilustrativas" no placeholder e várias fixtures).
- O checkbox, quando marcado, **injeta** o texto fixo no texto obrigatório final (D3); quando desmarcado e sem texto livre, `mandatoryArtworkText` fica ausente → `legalNotice.enabled=false` → **nada entra na arte** (regra F39 D9 preservada, agora com controle real).

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

### D5 — `displayText` frase nua sem prefixo; as superfícies do prompt compõem o rótulo

`DECIDIDO` (opção 1 — mantém backend estável)

- `validity.displayText` representa **apenas o conteúdo da validade**, sem o rótulo "Oferta válida". Exemplos: `"até 30/09"`, `"de 25/09 até 30/09"`, `"somente hoje"`, `"enquanto durarem os estoques"`, `"toda sexta-feira"`.
- **Existem DUAS superfícies que exibem a validade no prompt** (não um único ponto de composição):
  1. `buildCommercialRepertoire` → `- Oferta válida: ${displayText}` (`image-generation-service.ts:739`) — repertório comercial;
  2. template offer/base → `**Validade da oferta:** {{validity}}` (`campaign-image-director-offer.md:83`) — dado direto no bloco de restrições.
  Com `displayText` nu, cada superfície compõe o rótulo uma única vez ("Oferta válida: até 30/09" e "Validade da oferta: até 30/09"). Existe uma **repetição informacional já existente** (o mesmo fato em duas seções do prompt) — aceita, e a F40 **não mexe em nenhuma das duas superfícies**. O `displayText` nu evita duplicação de rótulo ("Oferta válida: Oferta válida até 30/09") e divergência entre superfícies.
- **Sem mudança** em `buildCommercialRepertoire`, revisor, `buildPromptVariables` ou testes existentes. A **UI é responsável** por não deixar o lojista salvar "Oferta válida..." quando escolhe modos estruturados.
- **Texto personalizado — normalização leve:** aceitar `até 30/09` como está; se o usuário digitar `Oferta válida até 30/09`, **limpar o prefixo** antes de enviar. Se o texto não tiver relação temporal (ex.: "somente para clientes cadastrados"), é sinal de que é mais "texto obrigatório" do que validade — orientação de UI, sem bloqueio.
- Fixtures existentes com strings completas ("válida até 30/09", "Oferta válida até 31/12") são **normalizadas** nesta fase (o contrato continua o mesmo: displayText livre).

### D6 — Prompt reframe: remover hardcode incondicional → bloco condicional de composição

`DECIDIDO` (refinamento do usuário sobre a opção "remover hardcode + default marcado")

- **Antes** (herança UAT-3, nos 4 prompts do diretor):
  ```
  SEMPRE acrescente a arte o seguinte texto (esse texto pode ser minúsculo mas deve ser legível - e deve ser posicionado nas margens da arte, horizontal ou vertical): "Imagem meramente ilustrativa"
  ```
- **Depois** — bloco condicional de composição, no mesmo local:
  ```
  Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte.
  Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.
  ```
- Mantém a **inteligência visual herdada do UAT-3** (legibilidade, posição lateral, não competir com o produto/preço) mas **respeita o checkbox como controle real**: `legalNotice.enabled=false` → o aviso **não** entra na arte.
- A linha condicional do texto obrigatório já existente ("Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}})... Não o repita na legenda.") é **mantida** (`campaign-image-director.md:132`, `-offer.md:133`, `-spotlight.md:131`, `-exclusive.md:140`).
- **Escopo ampliado para prompt engineering + testes de regressão** (por intent: offer/spotlight/exclusive) — inevitável: manter o hardcode faz o checkbox mentir; remover sem instrução perde qualidade visual.

### D7 — Copy Director fora de escopo (validade e aviso são da arte/review)

`DECIDIDO` (coerente com F25 e revisor)

- `CopyDirectorInput` **não recebe** `validity`/`legalNotice` (sem mudança em `src/lib/copy/schema.ts`).
- Validade e aviso são **informação da arte**, não da legenda — revisor já instrui: "Não repetir o texto obrigatorio em legenda; o texto e escopo da arte, nao da legenda" (`image-review-service.ts:205`).
- O Copy Director continua consumindo apenas os campos comerciais atuais (preços, badge, intent).

### D8 — "Detalhes da oferta/produto" = Descrição existente; sem novo `campaignDetails`

`DECIDIDO` (esclarecimento do usuário — reusar a Descrição, não criar campo novo)

- O item "Detalhes da oferta/produto [textarea livre]" do layout inicial é a **Descrição existente** (`product.description`, `maxLength 120`, `campaign-input-form.tsx:391-422`), descrição comercial curta do produto/oferta. **Não se transforma em campo novo.**
- **Nenhum campo adormecido ganha UI nesta fase** — `campaignDetails`, `additionalDetails` e `availabilityNotes` continuam dormindo. Criar `campaignDetails` abriria outra frente de UX (diferença entre "Descrição", "Detalhes adicionais", "Contexto da campanha", "Texto obrigatório" e "Validade") — nebuloso para o lojista.
- **Agrupamento alvo da UI** (orientativo para P40-03; a "Descrição" permanece onde fizer mais sentido no fluxo do produto):
  ```
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

### D9 — Snapshot sem mudança de contrato

`DECIDIDO` (reuso do que a F39 já construiu)

- `campaign_brief_v1` continua como está: `commercial.validity` (via `validity` no body) e `commercial.legalNotice` (via `mandatoryArtworkText` concatenado) — **sem nova chave, sem migration**.
- `getCampaignLegalNotice` (`brief.ts:134`, testado) permanece o helper canônico para leitura (F37 consumirá).
- O snapshot registra o **texto final** (concatenado/quando aplicável) — a UI é quem preserva os campos distintos (D3). Se uma fase futura precisar persistir a separação checkbox/texto, será decisão posterior.

## Risks / Trade-offs

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

## Migration Plan

**Migration SQL:** NENHUMA (D9). `campaign_brief_v1` continua `jsonb` tolerante; `commercial.validity`/`legalNotice` já persistidos — sem nova chave, sem CHECK.

**Deploy:** código no mesmo PR (padrão Vercel). Rollback: reverter o commit — não há mudança de schema de banco. Campanhas antigas (pré-F40) com `input_snapshot` sem esses campos continuam exibindo/baixando normalmente (sem migração destrutiva).

**Prompts:** os 4 prompts do diretor mudam de texto (D6) no mesmo deploy do checkbox — ambos são coordenados para o comportamento visual default permanecer (checkbox marcado).

**Trackings (D1 — runbook):** aplicar atualizações em `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md` na ordem listada na D1.

## Open Questions

- **Nenhuma bloqueante.** Decisões explícitas registradas no alinhamento: a string do aviso é unificada em constante única singular (D2); o transporte concatena com `\n` no campo legado (D3); o form state guarda os campos separados até o submit (D3); `endDate` permanece reservado (D4); o snapshot guarda o texto final concatenado (D9); nenhum campo adormecido ganha UI (D8).