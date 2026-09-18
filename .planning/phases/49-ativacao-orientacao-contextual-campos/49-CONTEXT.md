# Phase 49: Ativação e Orientação Contextual de Campos — Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Source of truth:** `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/` (proposal.md / design.md D1–D15 / 7 specs / tasks.md)
**Numbering:** F49 (v1.5). F44 (Temas) e Stripe/Monetização Pública permanecem fora da numeração.
**Plan naming:** diretório `.planning/phases/49-ativacao-orientacao-contextual-campos`; arquivos `49-XX-PLAN.md` (convenção GSD).

> Este CONTEXT é a síntese fiel da base técnica OpenSpec. **Nenhuma decisão de produto foi ampliada.** A investigação técnica (consumidores reais, regra de desbloqueio, precedente de a11y) vive em `design.md` e foi re-verificada em código em 2026-09-18 (ver `<domain>`). **Interpretação do D1 (resolvida com o usuário):** a proibição de atualizar trackings/roadmap valia **somente** para a geração inicial dos artefatos OpenSpec; a partir do planejamento/execução GSD, o tracking normal da fase é **obrigatório**.

<domain>
## Phase Boundary

A F49 é uma fase de **orientação contextual de campos** — não um tour guiado, não um checklist global de ativação e não uma mudança de pipeline. Ela melhora o que o lojista **lê e entende no próprio campo ou seção** dos dois formulários que alimentam a geração: a identidade da loja (`/loja`, painel de abas da F36) e o brief da campanha (`/campanhas/nova`), incluindo a tela de revisão do brief (F43).

**O que esta fase entrega:**

1. **Padrão reutilizável e mínimo de ajuda de campo (D2)** — composição de quatro primitivos locais, **não** um componente genérico complexo:
   - (a) **hint inline curto** sempre visível;
   - (b) **descrição contextual da opção selecionada** para selects;
   - (c) **ajuda expansível** (progressive disclosure, colapsada por padrão) para exemplos longos/regras combinatórias;
   - (d) **feedback dinâmico** derivado dos valores preenchidos por função pura.
   - Associação campo↔ajuda via `aria-describedby` com ids de `useId` (precedente `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx`). Disclosure acionável por teclado com `aria-expanded` e foco visível. Touch targets ≥ 44px.
2. **Diferenciação obrigatório / recomendado / opcional (D3)** — por texto (nunca só cor). Obrigatório mantém `*` + validação controlada atual (`noValidate` + validação por campo + mensagens) e ganha **`aria-required="true"` sem** adicionar `required` nativo. Recomendado = badge/label textual (Posicionamento e Descrição Curta). Slogan é **opcional**, com "se sua loja já utiliza um", **sem** "Recomendado".
3. **Dados fiscais × identidade pública (D4)** — subseção "Dados fiscais" (CNPJ/Razão Social/Nome Fantasia) separada do `Nome da Loja` (nome público). Atalhos "Usar nome fantasia/razão social como nome da loja" **preservados**. CNPJ continua opcional (draft mode); lookup/read-only/fallback/readiness inalterados.
4. **Tom de voz como campo crítico + descrição contextual (D5)** — hint explica que orienta títulos/legendas/clima visual e que **complementa** (não substitui) segmento/subsegmento. Descrição curta e positiva por opção (8: profissional, moderno, elegante, divertido, acolhedor, jovem, tradicional, luxuoso). Regra real `computeTabUnlock` → `needs_tone_of_voice` **inalterada**.
5. **Posicionamento compreensível (D6)** — label "Como você quer que sua loja seja percebida?" com termo secundário "Posicionamento da marca"; hint pedindo público/proposta/diferencial; microcopy reconhecendo efeito **direto na copy** e **indireto no perfil/direção visual** (sem prometer transformação visual); placeholder atual substituído por começo de frase útil; exemplo positivo em ajuda expansível com a estrutura `Somos uma loja de [categoria] para [público], reconhecida por [diferencial].`; **sem** validador semântico.
6. **Distinção posicionamento × descrição curta × slogan (D7)** — microcopy no ponto de decisão; nenhum campo novo, nenhuma validação nova.
7. **Descrição do produto (D8)** — renomear conceitualmente "Descrição" para "Descrição do produto" mantendo `fields.description` → body `description` → `brief.product.description` → `CopyDirectorInput.description`. Microcopy de características/benefícios/uso; placeholder real de produto. **Fence:** continua alimentando **apenas** copy/publicação; **proibido** enviar ao Diretor de Arte, alterar prompts/pipeline ou exibir aviso negativo.
8. **Preços e intenção (D9)** — labels "Preço de venda (final)" / "Preço anterior (original)"; hint curto por campo; ajuda expansível "Como os preços mudam a campanha?" substituindo o bloco permanente de 3 regras; **feedback dinâmico** por função pura cobrindo 4 estados, incluindo o intermediário "só preço anterior" → mensagem **neutra** ("Informe o preço de venda para completar a oferta."), **não** "Sem preço...". `inferIntent`/`IntentSelector`/`availableOptions`/schemas **não mudam**; sem validação nova.
9. **Informações obrigatórias na arte (D10)** — label "Informações obrigatórias na arte" (alternativa "Detalhes obrigatórios na arte" decidida na UAT); microcopy positiva; placeholder multi-linha com exemplo real de produto; campo **diretamente visível** (não atrás de checkbox); **sem** advertências negativas permanentes. Transporte `mandatoryArtworkText` e prompts inalterados.
10. **Fronteiras canônicas (D11)** — responsabilidade por área: descrição→copy; informações obrigatórias→imagem; preços→valores; validade→período; aviso ilustrativo→controle próprio; selo→campo próprio. Prevenção de duplicação por organização/labels/microcopy positiva/revisão — **nunca** avisos negativos ou validadores semânticos.
11. **Revisão do brief com categorias separáveis (D12)** — aviso ilustrativo, informações obrigatórias na arte, validade e preços/oferta **separáveis e reconhecíveis** (hoje o checkbox + texto livre aparecem concatenados num único parágrafo). **Apresentação apenas:** body/snapshot/contrato HTTP intactos.
12. **A11y/mobile/desktop (D13)** — `aria-describedby`/`aria-invalid`; disclosure acessível; mobile sem scroll horizontal, touch ≥ 44px, ajuda colapsada; desktop com ajuda colapsada por padrão; sem dependência de hover; hints/feedbacks não interferem em validação/auto-save/draft/drift.
13. **Fonte única da microcopy + prova de não-divergência (D14)** — conteúdo em módulos puros (`src/lib/store-onboarding/field-guidance.ts` e `src/lib/campaign/field-guidance.ts`), consumidos por componentes e testes; testes provam correspondência com o comportamento real (4 estados de preço ↔ `inferIntent`/`availableOptions`; tom de voz ↔ `computeTabUnlock`; descrição ↔ copy mapper e ausência no `art-director-briefing`).
14. **Fences de não-mudança e co-migração (D15)** — apresentação apenas; co-migração restrita a asserções que consultam labels/placeholders/microcopy.

**O que esta fase NÃO entrega (Non-Goals):**

- Tour guiado pelo shell/dashboard; coach marks; checklist global persistente de ativação; assistente conversacional; help center.
- Redesenho geral do onboarding ou da página de campanha.
- Alteração de prompts, gateway, modelos, pipeline de IA ou novas chamadas de IA.
- Envio da descrição do produto ao Diretor de Arte (fase futura, após laboratório/baseline/UAT visual).
- Validação semântica rígida, regex de intenção ou bloqueio por qualidade de texto.
- Mudanças em schemas públicos, snapshot, domínio ou contrato HTTP; migrations/banco/storage.
- Implementação de Temas (F44).
- Comportamento baseado em exemplos negativos/advertências preventivas.

**Estado real verificado em código (2026-09-18):**

- `src/components/flow/store-identity-form.tsx` (2601 linhas) — `TONE_OF_VOICE_OPTIONS` em `:37` (8 opções), render do select em `:1961`; `Nome da Loja` ~`:1629`; atalhos fiscal→nome ~`:1607-1622`; card informativo do Posicionamento ~`:1951`; `Posicionamento` (placeholder `Ex: A melhor loja de...`) ~`:1968`; `Descrição Curta` ~`:1972`; `Slogan` ~`:1976`. **Sem microcopy** de nome público/tom de voz/distinção.
- `src/components/flow/campaign-input-form.tsx` (651 linhas) — seção Produto com `Descrição (opcional)` e placeholder promocional `Ex: 20% OFF em todo o estoque` (~`:386`); bloco permanente de 3 regras de preço (~`:427-432`); `Preço Original (opcional)`/`Preço Final`; `IntentSelector`; `ValidityField`; seção Avisos com `IllustrativeNoticeField` (`showIllustrativeNotice` em `:595-596`) + `MandatoryArtworkField` (`mandatoryArtworkTextFree` em `:600-601`).
- `src/components/campaign/mandatory-artwork-field.tsx` (32 linhas) — textarea `Texto obrigatório na arte` com hint de regras/restrições.
- `src/components/campaign/validity-field.tsx` (237 linhas) — **NÃO é modificado**; entra apenas como regressão.
- `src/components/flow/campaign-brief-review.tsx` (289 linhas) — `buildMandatoryArtworkText(fields.showIllustrativeNotice, fields.mandatoryArtworkTextFree)` em `:72-73`; seção Avisos renderiza o resultado como bloco único (~`:235-240`).
- `src/components/flow/use-campaign-form.ts` (1182 linhas) — `mandatoryArtworkText` (compat), `showIllustrativeNotice`, `mandatoryArtworkTextFree` (`:128-130`, defaults `:209-210`); helpers `buildValidityDisplayText`/`buildMandatoryArtworkText`/`inferIntent`/`prepareCampaignImages`/`buildCampaignGenerationBody` — **intocados**.
- `src/lib/store-onboarding/tabs.ts` (95 linhas) — `computeTabUnlock` em `:62`, retorna `{ unlocked: false, reason: "needs_tone_of_voice" }` em `:94`.
- `src/lib/store-onboarding/reason-text.ts` (40 linhas) — `tabBlockReasonText`; caso `needs_tone_of_voice` em `:34`.
- `src/lib/image-generation/services/art-director-briefing.ts` (460 linhas) — **não consome** `product.description` (verificado por grep).
- `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx` (66 linhas) — precedente de `useId` + `aria-describedby` (erro + hint) e `min-h` de toque.
- **Não há `<details>`/disclosure no código atual** — a ajuda expansível é padrão novo, mínimo e acessível.
- `src/components/ui/` tem apenas: badge, button, card, empty-state, error-state, input, loading-skeleton, page-header, pagination, skeleton. **Não** há select/textarea/dialog/table/tabs/radio/toast — os primitivos de ajuda são locais (`src/components/ui/` **ou** `src/components/campaign/`, decidido na execução).

</domain>

<decisions>
## Implementation Decisions

### Nomenclatura e rastreabilidade (LOCKED)
- Fase lógica **49**; diretório `.planning/phases/49-ativacao-orientacao-contextual-campos`; planos `49-XX-PLAN.md`; branch/OpenSpec `fase-49-ativacao-orientacao-contextual-campos`.
- Requirements dos planos: usar os **slugs das capabilities** (`contextual-field-help`, `store-field-orientation`, `campaign-field-orientation`, `store-identity-ui`, `campaign-input-ui`, `mandatory-artwork-text`, `campaign-brief-review`). Não há REQ-IDs no `REQUIREMENTS.md`.
- **Interpretação do D1 (confirmada pelo usuário em 2026-09-18):** a proibição de atualizar trackings/roadmap valia **somente** para a geração inicial dos artefatos OpenSpec; durante planejamento, execução e fechamento GSD o tracking normal é **obrigatório**.

### D1 — Escopo: orientação no próprio campo, sem tour e sem checklist
`DECIDIDO`. Entrega **orientação contextual** nos campos que alimentam direção visual, identidade, brief e informações obrigatórias da arte. Fica **fora**: checklist persistente de ativação, tour/coach marks, eventos de conclusão/tempo/abandono por etapa e redesenho do onboarding (change próprio, se retomados).

### D2 — Padrão reutilizável de ajuda de campo (mínimo, sem overengineering)
`DECIDIDO`. Quatro mecanismos com caso de uso claro (tabela acima). Implementação por **primitivos locais pequenos e declarativos** (ex.: `FieldHint`, `ExpandableHelp`, descrição contextual renderizada pelo próprio select, feedback como texto de função pura). **Sem** API genérica de formulário, context ou registry de campos. A11y: `aria-describedby` (ids de `useId`); disclosure `<button aria-expanded>` + região revelada (ou `<details>/<summary>`), foco visível. **Proibido:** depender exclusivamente de `title`/tooltip; listas permanentes de regras; avisos negativos preventivos.

### D3 — Obrigatório, recomendado e opcional
`DECIDIDO`. Obrigatório: `*` + validação controlada atual + **`aria-required="true"`** (sem `required` nativo; o atributo nativo hoje **não existe**). Recomendado: badge/label textual para **Posicionamento** e **Descrição Curta** (não bloqueante). **Slogan NÃO é recomendado** — é opcional ("se sua loja já utiliza um"). "Imagens adicionais" permanece opcional explícito. Opcional: `(opcional)` preservado. **Tom de Voz** é o único crítico para avançar (D5), dito de forma positiva. Nunca cor como único diferenciador.

### D4 — Dados fiscais × identidade pública (loja)
`DECIDIDO`. Subseção "Dados fiscais" (dentro da aba Dados) agrupando CNPJ/Razão Social/Nome Fantasia, com rótulo/helper de dados cadastrais/oficiais (Receita Federal) usados para verificação/readiness. `Nome da Loja` com microcopy de identidade pública. Atalhos preservados exatamente como hoje. Sem mudança de comportamento (CNPJ opcional/draft, lookup/read-only/fallback/readiness).

### D5 — Tom de voz: campo crítico com descrição contextual por opção
`DECIDIDO`. Hint: "Define como sua loja se comunica. O Vendeo usa essa escolha nos títulos, legendas e no clima visual das campanhas." Descrição contextual positiva por opção (8), em módulo puro (D14). Microcopy deixa claro que o tom **complementa** (não substitui) segmento/subsegmento (alinhado ao `art-director-briefing`, `storeTone` default `"profissional"`). **Sem mudança de regra:** `computeTabUnlock` continua exigindo `storeId` + tom; `reason-text.ts` permanece a fonte do motivo.

### D6 — Posicionamento: label compreensível, hint e exemplo expansível
`DECIDIDO`. Label "Como você quer que sua loja seja percebida?" + termo secundário "Posicionamento da marca" (chave `positioning` mantida). Hint de público/proposta/diferencial. Microcopy reconhece efeito direto na copy e indireto no perfil/direção visual (sem prometer transformação visual). Ajuda expansível com exemplo `[categoria]/[público]/[diferencial]`. Placeholder substituído por começo de frase útil (ex.: `Ex: Somos uma loja de...`). **Sem validador** (não bloquear adjetivo único, sem regex de intenção).

### D7 — Descrição curta × slogan × posicionamento
`DECIDIDO`. Posicionamento = como deseja ser percebida (recomendado). Descrição curta = o que vende/para quem/diferencial factual (recomendada). Slogan = frase pública já adotada (**opcional**, "se sua loja já utiliza um"; **não** recomendado). Hints curtos por campo; nenhum campo/validação nova.

### D8 — Descrição do produto + fence do Diretor de Arte
`DECIDIDO`. Label "Descrição do produto" (campo permanece `fields.description` → body → `brief.product.description` → `CopyDirectorInput.description`). Microcopy: "Descreva características, benefícios ou formas de uso que ajudam a apresentar o produto na comunicação da campanha." Placeholder real: `Ex.: Tênis leve para corrida e uso diário, com solado antiderrapante.` **Fence obrigatório:** apenas copy/publicação; **proibido** enviar ao Diretor de Arte, alterar prompts/briefing/pipeline ou exibir o aviso negativo. **Teste de não-mudança:** `product.description` chega ao copy mapper e **não** ao `art-director-briefing`.

### D9 — Preços e intenção: labels, ajuda expansível e feedback dinâmico
`DECIDIDO`. Labels "Preço de venda (final)" / "Preço anterior (original)" (chaves `discountedPriceCents`/`originalPriceCents` mantidas). Hint curto por campo. Ajuda expansível "Como os preços mudam a campanha?" preserva as 3 regras (dois preços = Oferta; só venda = Oferta ou Destaque; sem preço = Destaque ou Exclusividade). Feedback dinâmico por função pura:
- dois preços → "A campanha será apresentada como oferta: de R$ X por R$ Y.";
- só preço de venda → "Com apenas o preço de venda, você poderá escolher entre Oferta e Destaque.";
- **só preço anterior** → mensagem neutra "Informe o preço de venda para completar a oferta." (**não** "Sem preço...");
- sem nenhum preço → "Sem preço, a campanha será de Destaque ou Exclusividade.".
Estado intermediário "só anterior" **não** bloqueia e **não** cria validação; `inferIntent` cai no caminho sem preço (atual). **Fence:** `inferIntent`/`IntentSelector`/`availableOptions`/schemas/contratos não mudam — o feedback apenas espelha.

### D10 — Informações obrigatórias na arte: visível, positiva e multi-linha
`DECIDIDO`. Label "Informações obrigatórias na arte" (alternativa "Detalhes obrigatórios na arte" decidida na UAT). Chave `mandatoryArtworkTextFree` e transporte `mandatoryArtworkText` mantidos. Microcopy: "Informe características ou detalhes que precisam aparecer na imagem. Use uma linha para cada item." Placeholder multi-linha (ex.: `Intensidade 8` / `Torra clássica` / `Peso líquido 500 g`). Campo **diretamente visível**; **sem** advertências negativas permanentes. Comportamento de inclusão na arte e prompts inalterados.

### D11 — Fronteiras canônicas entre informações
`DECIDIDO`. Tabela de responsabilidade por área (descrição→comunicação/copy; informações obrigatórias→imagem; preços→valores comerciais; validade→período/data/limitação; aviso ilustrativo→controle próprio; selo→campo próprio). Prevenção por organização/labels/microcopy positiva/revisão estruturada — **nunca** avisos negativos ou validadores semânticos frágeis (aprendizado F44/F45).

### D12 — Revisão do brief com categorias separáveis
`DECIDIDO`. `campaign-brief-review.tsx` mantém **separáveis e reconhecíveis**: aviso ilustrativo, informações obrigatórias na arte, validade e preços/oferta (hoje checkbox + texto livre concatenados num único parágrafo). **Sem alteração de contrato:** `fields`, `buildMandatoryArtworkText`, body, snapshot e HTTP idênticos; separação derivada dos valores já disponíveis (`showIllustrativeNotice`/`mandatoryArtworkTextFree`). Rótulos alinhados ("Informações obrigatórias na arte", "Preço de venda", "Preço anterior").

### D13 — A11y, mobile e desktop
`DECIDIDO`. Associação por `aria-describedby` (ids de `useId`); `aria-invalid` preservado. Disclosure acionável por teclado com `aria-expanded`/foco visível. Mobile: touch ≥ 44px (F22), ajuda expansível em vez de texto permanente, sem scroll horizontal, hints curtos. Desktop: mesmos conteúdos, ajuda colapsada por padrão. Sem dependência de hover. Hints/feedbacks **não** interferem em validação/auto-save/draft/drift.

### D14 — Fonte única da microcopy e prova de não-divergência
`DECIDIDO`. Conteúdo de orientação em **módulos puros** (sem JSX/side-effects), consumidos por componentes e testes:
- `src/lib/store-onboarding/field-guidance.ts` — labels/hints/exemplos/descrições de tom de voz e fronteiras posicionamento/descrição/slogan;
- `src/lib/campaign/field-guidance.ts` — labels/hints/exemplos e mensagens de feedback dinâmico de preço.
Testes de correspondência: feedback de preço derivado da **mesma** lógica de `inferIntent`/`availableOptions` (4 estados, incl. neutro); tom de voz ↔ `computeTabUnlock`; descrição ↔ copy mapper **e** ausência no `art-director-briefing`. **Sem duplicação divergente.**

### D15 — Fences de não-mudança e co-migração de testes
`DECIDIDO`. **Não muda:** prompts (`prompts/**`), gateway/modelos (`src/lib/ai/**`), `src/lib/campaign/brief*.ts`, snapshot `campaign_brief_v1`, `GenerateImageRequestSchema`, `use-campaign-form.ts` (helpers e body), `use-store-form`/`draft-store` (auto-save/draft), `use-drift-detection`/`lib/drift.ts`, rotas HTTP, banco/storage. **Testes de não-mudança:** goldens existentes + diff de prompts/pipeline/body/snapshot. **Co-migração:** apenas asserções que consultam labels/placeholders/microcopy alterados (`campaign-input-form.test.tsx`, `campaign-brief-review.test.tsx`, `store-identity-form.*`, `use-campaign-form-*.test.ts`, `validity-field.test.tsx`) — sem alterar o comportamento testado. **Proibido:** validadores semânticos rígidos, regex de intenção, novas chamadas de IA.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade OpenSpec
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/proposal.md` — Why/What/Impact e escopo.
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/design.md` — D1–D15, tabela de consumidores, riscos, migration plan.
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/tasks.md` — grupos 1–9 (baseline, conteúdo, primitivos, loja, campanha, revisão, testes, co-migração, gates/UAT).
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/contextual-field-help/spec.md`
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/store-field-orientation/spec.md`
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/campaign-field-orientation/spec.md`
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/store-identity-ui/spec.md`
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/campaign-input-ui/spec.md`
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/mandatory-artwork-text/spec.md`
- `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/specs/campaign-brief-review/spec.md`

### Formulário da loja
- `src/components/flow/store-identity-form.tsx` — campos, `TONE_OF_VOICE_OPTIONS`, atalhos fiscais.
- `src/lib/store-onboarding/tabs.ts` — `computeTabUnlock`.
- `src/lib/store-onboarding/reason-text.ts` — `tabBlockReasonText`.
- `src/lib/store-onboarding/draft-store.ts`, `src/hooks/use-onboarding-tabs.ts` — auto-save/draft/tabs (fence).

### Formulário da campanha
- `src/components/flow/campaign-input-form.tsx` — seções Produto/Oferta/Avisos.
- `src/components/campaign/mandatory-artwork-field.tsx` — campo de texto obrigatório.
- `src/components/campaign/illustrative-notice-field.tsx` — checkbox ilustrativo.
- `src/components/campaign/validity-field.tsx` — **não modificado** (regressão).
- `src/components/flow/use-campaign-form.ts` — `fields`, helpers `inferIntent`/`buildValidityDisplayText`/`buildMandatoryArtworkText`/`buildCampaignGenerationBody` (fence).

### Revisão do brief
- `src/components/flow/campaign-brief-review.tsx` — seções Produto/Oferta/Imagens/Avisos/Custo/Tema.

### Consumidores reais (fonte dos efeitos)
- `src/lib/campaign/brief.ts`, `src/lib/campaign/brief-schema.ts` — `CampaignBrief`/snapshot (fence).
- `src/lib/image-generation/services/art-director-briefing.ts` — **não consome** `product.description`.
- `src/lib/ai/copy-director/**` (ou equivalente do copy mapper) — `CopyDirectorInput.description`.
- `src/lib/store-onboarding/**` + `brand-director`/`brand-profiler`/`identity-art-director`/`text-only-inference` — efeito indireto de posicionamento/descrição curta.

### Precedente de a11y e primitivos
- `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx`, `lab-select.tsx` — `useId` + `aria-describedby`.
- `src/components/ui/` — primitivos disponíveis (badge, button, card, empty-state, error-state, input, loading-skeleton, page-header, pagination, skeleton).

### Testes a co-migrar/regressão
- `src/components/flow/__tests__/campaign-input-form.test.tsx`, `campaign-input-form-price-helper.test.tsx`, `campaign-brief-review.test.tsx`, `use-campaign-form-*.test.ts`, `store-tabs.test.tsx`, `store-identity-form.*.test.tsx`, `store-page-client.test.tsx`, `src/components/campaign/__tests__/validity-field.test.tsx`.

### Tracking
- `.planning/ROADMAP.md`, `ROADMAP.md`, `.planning/STATE.md` — F49 registrada em 2026-09-18.
- `AGENTS.md` — workflow GSD e skills do projeto.

</canonical_refs>

<specifics>
## Specific Ideas

- **Strings canônicas (fonte única nos módulos de conteúdo):**
  - Nome da Loja: "Este é o nome público da sua loja. Ele aparece no Vendeo e é usado para identificar e assinar suas campanhas."
  - Tom de voz hint: "Define como sua loja se comunica. O Vendeo usa essa escolha nos títulos, legendas e no clima visual das campanhas."
  - Posicionamento exemplo: "Somos uma loja de [categoria] para [público], reconhecida por [diferencial]."
  - Descrição do produto: "Descreva características, benefícios ou formas de uso que ajudam a apresentar o produto na comunicação da campanha." / placeholder `Ex.: Tênis leve para corrida e uso diário, com solado antiderrapante.`
  - Informações obrigatórias: "Informe características ou detalhes que precisam aparecer na imagem. Use uma linha para cada item." / placeholder multi-linha `Intensidade 8` / `Torra clássica` / `Peso líquido 500 g`.
  - Ajuda de preços: "Como os preços mudam a campanha?" com as 3 regras.
- **Descrições de tom de voz (exemplos ilustrativos, redação final na execução):** `profissional` → "Direta, confiável e sem exageros."; `moderno` → "Atual, objetiva e com energia contemporânea."; `luxuoso` → "Sofisticada, exclusiva e com senso de premium.".
- **4 estados de preço** (dois, só venda, só anterior→neutro, nenhum) testados contra `inferIntent`/`availableOptions`.
- **Primitivos:** `FieldHint`, `ExpandableHelp`, indicador "Recomendado"; localização final (`src/components/ui/` × `src/components/campaign/`) decidida na execução.
- **Ordem de execução sugerida (design.md):** (1) conteúdo puro + primitivos (com unit tests); (2) campos da loja; (3) campos da campanha + revisão; (4) co-migração das asserções; (5) 4 gates; (6) UAT humana desktop/mobile de compreensão.

</specifics>

<deferred>
## Deferred Ideas

- Tour guiado/coach marks, checklist persistente de ativação, eventos por etapa, redesenho do onboarding (change próprio).
- Envio de `product.description` ao Diretor de Arte (fase futura, após laboratório/baseline/UAT visual).
- Temas de Campanha (F44) e Monetização pública/Stripe (diferida, v1.7+, fora da numeração).
- Qualquer validador semântico, regex de intenção ou bloqueio por qualidade de texto.

</deferred>

<scope_fence>
## Scope Fences (não-mudança)

- **Proibido alterar:** `prompts/**`, `src/lib/ai/**` (gateway/modelos/adapters), `src/lib/campaign/brief*.ts`, snapshot `campaign_brief_v1`, `GenerateImageRequestSchema`, `use-campaign-form.ts` (helpers/body), `use-store-form`/`draft-store`, `use-drift-detection`/`lib/drift.ts`, rotas HTTP, banco/storage.
- **Sem** migration SQL, sem novas chamadas de IA, sem validadores semânticos/regex de intenção, sem avisos negativos permanentes, sem tooltip exclusivo, sem listas permanentes de regras.
- `src/components/campaign/validity-field.tsx` **não** é modificado (apenas regressão).
- **Não** enviar `product.description` ao Diretor de Arte.
- Tracking/roadmap: atualização normal do GSD **autorizada** (D1 reinterpretado).

</scope_fence>

<risk_summary>
## Risk Summary

| Risco | Mitigação |
|---|---|
| Microcopy prometer efeito que o pipeline não produz | D8/D9/D14 — fences + fonte única + testes de correspondência |
| Descrição do produto influenciar a arte por engano | D8/D15 — `art-director-briefing` não consome `description`; teste de não-mudança |
| Poluição visual por excesso de ajuda | D2/D13 — hint curto + progressive disclosure; UAT avalia **ausência de poluição** |
| Tooltip-only / informação essencial escondida | D2/D13 — hint visível sempre presente |
| Ajuda divergir do comportamento (feedback ≠ opções reais) | D14 — mesma lógica de `inferIntent`/`availableOptions`; testes dos 4 estados |
| Revisão do brief quebrar contrato ao separar categorias | D12/D15 — apresentação apenas; body/snapshot/HTTP cobertos |
| Regressão em auto-save/draft/drift | D15 — helpers/hooks intocados; co-migração restrita; regressão obrigatória |
| Mobile: ajuda empurrando conteúdo/scroll horizontal | D13 — expansível colapsada, touch ≥ 44px; UAT 320px/375px |
| Escopo escorregar para tour/checklist | D1 — fronteira explícita; non-goals registrados |
| UAT avaliar presença de textos em vez de compreensão | Tasks de UAT de **compreensão** (desktop + mobile) exigidas |

</risk_summary>

<divergences_resolved>
## Divergências resolvidas

- **D1 × tracking GSD:** o `design.md` dizia "trackings/roadmap não são atualizados na elaboração/execução". Interpretado como restrição **apenas** da geração inicial dos artefatos OpenSpec; o tracking normal do GSD (planejamento/execução/fechamento) é **obrigatório**. Confirmado pelo usuário em 2026-09-18 (escolha 1/1/1).
- **Nenhuma divergência substantiva** entre `design.md` e o código real (arquivos, campos e consumidores verificados em 2026-09-18). Contagens de linha divergem levemente (ex.: `store-identity-form.tsx` 2601 vs ~2735 no design) — não afeta o escopo.
- **Research:** pulado (`research=false`); `proposal.md`/`design.md`/specs são a fonte técnica. `RESEARCH.md`/`VALIDATION.md` (Nyquist) dispensados, conforme precedente F48.1; verificações por tarefa, plan-check, 4 gates e UAT humana **mantidos**.
- **UI-SPEC:** gerado a partir dos artefatos OpenSpec (`49-UI-SPEC.md`), sem novas decisões de produto, para satisfazer o `ui_safety_gate`.

</divergences_resolved>

---

*Phase: 49-ativacao-orientacao-contextual-campos*
*Context gathered: 2026-09-18 via OpenSpec source of truth + verificação de âncoras de código*
