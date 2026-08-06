## ADDED Requirements

### Requirement: Definição das abas do onboarding

O sistema SHALL definir as 3 abas do onboarding de loja em `src/lib/store-onboarding/tabs.ts`:

- `OnboardingTab = "dados" | "posicionamento" | "direcao-visual"`
- `TAB_ORDER: OnboardingTab[] = ["dados", "posicionamento", "direcao-visual"]`
- `OnboardingTabDef` com `id`, `label` ("Dados" | "Posicionamento" | "Direção Visual") e `labelMobile` ("Dados" | "Perfil" | "Visual")

O `labelMobile` SHALL ser **apenas um label responsivo** (D10) — o `id` da aba (`posicionamento`/`direcao-visual`) SHALL permanecer inalterado para query param, testes e analytics. Não deve existir um segundo vocabulário conceitual; só a string exibida muda por viewport.

#### Scenario: Aba Dados abre por padrão

- **WHEN** o onboarding é aberto sem `?tab=`
- **THEN** a aba ativa é `dados`

#### Scenario: Label mobile não muda o id da aba

- **WHEN** o viewport é mobile e a aba exibida usa `labelMobile` "Perfil"
- **THEN** o `id` da aba continua sendo `posicionamento`
- **AND** o query param continua sendo `?tab=posicionamento`

### Requirement: Desbloqueio progressivo das abas (computeTabUnlock)

O sistema SHALL prover `computeTabUnlock(tab, ctx): { unlocked: boolean; reason?: TabBlockReason }` em `src/lib/store-onboarding/tabs.ts`, função pura testável, com as seguintes regras (D1/D9/D8):

- **`dados`**: sempre `{ unlocked: true }`
- **`posicionamento`** (loja nova): exige nome + segmento + aceite legal **aceito** E `storeId` já existente (loja criada via auto-save). Se falta nome ou segmento → `reason: "needs_basic_data"` (tem **precedência** sobre o aceite). Se tem nome+segmento mas falta aceite → `reason: "needs_legal_acceptance"`. Se dados válidos mas sem `storeId` → `reason: "needs_store_created"`. **CNPJ não bloqueia** (D8)
- **`direcao-visual`** (loja nova): exige `storeId` já existente E `tone_of_voice` preenchido (D9). Posicionamento/descrição/slogan não bloqueiam. Se falta `storeId` → `reason: "needs_store_created"`. Se falta tom de voz → `reason: "needs_tone_of_voice"`
- **Loja existente**: se a loja já tem direção visual salva (`hasVisualDirection`), a aba `direcao-visual` nasce aberta mesmo sem tom de voz
- **CNPJ**: ausente não bloqueia navegação em nenhuma aba — vira pendência de readiness (`fiscal_pending`)

`TabBlockReason = "needs_basic_data" | "needs_legal_acceptance" | "needs_tone_of_voice" | "needs_store_created" | "fiscal_pending"`.

> **Delta D16 (hard-block):** `computeTabUnlock` permanece a fonte da verdade de desbloqueio. A mudança é no **uso**: aba não desbloqueada é **hard-block** — NÃO é ativável por clique, teclado, "Continuar", deep-link ou back/forward; o conteúdo funcional da aba bloqueada nunca renderiza. Motivo acessível no botão (tooltip/`aria-label`), nunca dependendo do painel ativo da aba bloqueada.

#### Scenario: Aba dados sempre desbloqueada

- **WHEN** `computeTabUnlock("dados", ctx)` é chamado com qualquer ctx
- **THEN** retorna `{ unlocked: true }`

#### Scenario: Posicionamento bloqueado sem dados básicos

- **WHEN** `computeTabUnlock("posicionamento", ctx)` é chamado sem nome ou sem segmento
- **THEN** retorna `{ unlocked: false, reason: "needs_basic_data" }`

#### Scenario: Dados básicos faltantes têm precedência sobre o aceite legal

- **WHEN** `computeTabUnlock("posicionamento", ctx)` é chamado sem nome, mesmo com aceite legal pendente
- **THEN** retorna `{ unlocked: false, reason: "needs_basic_data" }` (não `needs_legal_acceptance`)

#### Scenario: Posicionamento bloqueado sem aceite legal

- **WHEN** `computeTabUnlock("posicionamento", ctx)` é chamado com nome + segmento preenchidos mas aceite legal não aceito
- **THEN** retorna `{ unlocked: false, reason: "needs_legal_acceptance" }`

#### Scenario: Posicionamento desbloqueado com mínimo + loja criada

- **WHEN** `computeTabUnlock("posicionamento", ctx)` é chamado com nome + segmento + aceite legal aceito + `storeId` existente
- **THEN** retorna `{ unlocked: true }`

#### Scenario: Posicionamento bloqueado aguardando criação da loja

- **WHEN** `computeTabUnlock("posicionamento", ctx)` é chamado com nome + segmento + aceite, mas `storeId` é `null`
- **THEN** retorna `{ unlocked: false, reason: "needs_store_created" }`

#### Scenario: Direção Visual bloqueada sem tom de voz

- **WHEN** `computeTabUnlock("direcao-visual", ctx)` é chamado com `storeId` existente mas `tone_of_voice` vazio
- **THEN** retorna `{ unlocked: false, reason: "needs_tone_of_voice" }`

#### Scenario: Direção Visual bloqueada aguardando loja criada

- **WHEN** `computeTabUnlock("direcao-visual", ctx)` é chamado sem `storeId` (mesmo com tom de voz no rascunho)
- **THEN** retorna `{ unlocked: false, reason: "needs_store_created" }`

#### Scenario: Direção Visual desbloqueada com storeId + tom de voz

- **WHEN** `computeTabUnlock("direcao-visual", ctx)` é chamado com `storeId` existente + `tone_of_voice` preenchido e posicionamento/descrição/slogan vazios
- **THEN** retorna `{ unlocked: true }`

#### Scenario: Direção Visual aberta para loja existente com direção visual salva

- **WHEN** `computeTabUnlock("direcao-visual", ctx)` é chamado com `hasVisualDirection: true` mesmo sem tom de voz
- **THEN** retorna `{ unlocked: true }`

#### Scenario: CNPJ não bloqueia Posicionamento

- **WHEN** `computeTabUnlock("posicionamento", ctx)` é chamado com nome + segmento + aceite + `storeId`, mas sem CNPJ
- **THEN** retorna `{ unlocked: true }`

#### Scenario: Aba não desbloqueada nega ativação (hard-block D16)

- **WHEN** `computeTabUnlock(tab, ctx)` retorna `{ unlocked: false }` para qualquer tab (exceto o fluxo Dados → Posicionamento com auto-save criando a loja)
- **THEN** a aba NÃO é ativada por clique, teclado, botão "Continuar", deep-link ou back/forward
- **AND** o usuário permanece na aba anterior válida
- **AND** o motivo do bloqueio é acessível no botão da aba (tooltip/`aria-label`)

### Requirement: Container ARIA tabs (store-tabs)

O sistema SHALL prover o componente `store-tabs.tsx` (`src/components/flow/store-tabs.tsx`) que implementa o padrão WAI-ARIA Tabs (D11):

- `role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` e `aria-controls`
- **Roving tabindex**: apenas o tab ativo é tabulável; setas ← → e Home/End movem o foco
- Tab bloqueado com `aria-disabled="true"` (ou `disabled`), NÃO aciona `onTabChange`, e o motivo é acessível via `aria-label`/`aria-describedby`/tooltip no próprio botão (nunca depende de painel ativo da aba bloqueada — D16)
- Estados das abas (bloqueada/pronta/pendente) expostos via `aria-label` (não apenas cor)
- Touch targets ≥ 44px (herdado da F22)
- Anúncio de mudança de estado via `aria-live` na região da aba

O componente SHALL ter duas variantes:
- **Desktop**: rótulos completos (Dados / Posicionamento / Direção Visual) com motivo acessível no botão da aba (tooltip/`aria-label`)
- **Mobile (compacta)**: rótulos curtos (`Dados` / `Perfil` / `Visual`), badge pequeno por estado (ponto/ícone discreto no canto da aba, não texto completo), motivo acessível no botão da aba e botão inferior "Continuar" sempre visível — **desabilitado quando a próxima aba está bloqueada**, com microcopy indicando o que falta (avança para a próxima liberada ou retrocede)

#### Scenario: Tablist com ARIA tabs válidos

- **WHEN** `StoreTabs` é renderizado
- **THEN** a estrutura tem `role="tablist"`, `role="tab"` e `role="tabpanel"`
- **AND** o tab ativo tem `aria-selected="true"` e `tabIndex={0}`
- **AND** os demais tabs têm `tabIndex={-1}`

#### Scenario: Setas movem o foco sem selecionar

- **WHEN** o usuário pressiona ArrowRight em um tab
- **THEN** o foco move para o próximo tab (roving focus)
- **AND** `aria-selected` NÃO muda (a seleção só muda com Enter/Space/clique em aba liberada)

#### Scenario: Motivo acessível no botão, não no painel da aba bloqueada

- **WHEN** uma aba está bloqueada
- **THEN** o motivo (`falta aceite legal`, `falta tom de voz`, etc.) é acessível via `aria-label`/`aria-describedby`/tooltip no próprio botão da aba
- **AND** o botão da aba exibe apenas o badge de estado (sem o texto completo do motivo)

#### Scenario: Aba bloqueada não aciona onTabChange (hard-block D16)

- **WHEN** o usuário clica (ou ativa por teclado) em uma aba bloqueada
- **THEN** `onTabChange` NÃO é chamado para a aba bloqueada
- **AND** a aba bloqueada tem `aria-disabled="true"` (ou `disabled`)
- **AND** o usuário permanece na aba ativa atual

#### Scenario: Mobile usa labels curtos e badge pequeno

- **WHEN** o viewport é mobile
- **THEN** as tabs exibem `Dados` / `Perfil` / `Visual`
- **AND** o badge de estado é discreto (ponto/ícone no canto)
- **AND** o botão inferior "Continuar" está sempre visível

#### Scenario: Mobile "Continuar" desabilitado quando a próxima aba está bloqueada (D16)

- **WHEN** o viewport é mobile
- **AND** a próxima aba (segundo o fluxo) está bloqueada
- **THEN** o botão inferior "Continuar" está `disabled`
- **AND** exibe microcopy específica do que falta via `tabBlockReasonText` (ex.: "Aceite os Termos de Uso e a Política de Uso Aceitável para liberar Perfil.", não apenas "Complete Dados para liberar Posicionamento")
- **AND** "Continuar" só navega quando a próxima aba está desbloqueada

#### Scenario: Touch targets atendem 44px

- **WHEN** o componente é inspecionado no mobile
- **THEN** todos os targets de toque têm altura ≥ 44px

### Requirement: Deep-link em aba bloqueada (redireciona para a primeira aba válida)

O sistema SHALL, quando o usuário acessa `/loja?tab=<aba>` para uma aba bloqueada (D6/D16):

- NÃO abrir a aba bloqueada com conteúdo funcional
- Redirecionar/sincronizar para a **primeira aba anterior válida**:
  - `posicionamento` bloqueada → abre `dados`
  - `direcao-visual` bloqueada → abre `posicionamento` se liberada, senão `dados`
- Exibir aviso contextual na aba aberta: **"Complete esta etapa para liberar {aba}"** com o motivo específico (`tabBlockReasonText`)
- NUNCA exibir tela em branco

> **Delta D16 (auto-avanço refinado):** após o deep-link bloqueado redirecionar, o re-check do alvo NÃO pode puxar o usuário de volta para o alvo automaticamente. Auto-avançar só é permitido quando o desbloqueio vier de **data-load** (`hasVisualDirection === true`). Desbloqueio por **edição do usuário** (ex.: preencher `tone_of_voice`) NUNCA auto-avança — o deep-link é consumido, o aviso é limpo e o avanço fica manual. Isso evita que um re-render posterior com `hasVisualDirection === true` arraste o usuário para fora do contexto de edição.

#### Scenario: Deep-link para aba bloqueada redireciona para a aba anterior válida

- **WHEN** o usuário acessa `/loja?tab=direcao-visual` e a aba está bloqueada (sem tom de voz)
- **AND** a aba Posicionamento está liberada
- **THEN** a aba ativa passa a ser `posicionamento`
- **AND** um aviso "Complete esta etapa para liberar Direção Visual" é exibido
- **AND** nenhum conteúdo funcional de Direção Visual é renderizado

#### Scenario: Deep-link para aba bloqueada sem anterior válida abre Dados

- **WHEN** o usuário acessa `/loja?tab=posicionamento` e a aba está bloqueada (sem mínimo/aceite)
- **THEN** a aba ativa passa a ser `dados`
- **AND** um aviso "Complete esta etapa para liberar Posicionamento" é exibido

#### Scenario: Deep-link para aba liberada abre direto

- **WHEN** o usuário acessa `/loja?tab=posicionamento` e a aba está desbloqueada
- **THEN** a aba Posicionamento é exibida diretamente

#### Scenario: Preencher o tom de voz NÃO auto-avança para Direção Visual

- **WHEN** o usuário foi redirecionado de um deep-link para `direcao-visual` bloqueada e está em `posicionamento`
- **AND** o usuário preenche `tone_of_voice` (edição, desbloqueio por edição)
- **THEN** o usuário PERMANECE em `posicionamento`
- **AND** o aviso de bloqueio é limpo
- **AND** NENHUM `autoSave`/navegação automática é disparado pelo desbloqueio
- **AND** um `hasVisualDirection === true` posterior NÃO auto-avança (o deep-link já foi consumido)

#### Scenario: Editar o tom de voz atualiza o estado da aba NA HORA (memo reactivo)

- **WHEN** o usuário está em `posicionamento` com a loja criada (`storeId` existente)
- **AND** `hasLocalEdits` já é `true` (houve edição anterior em qualquer campo)
- **AND** o usuário seleciona `tone_of_voice`
- **THEN** `tabStates["direcao-visual"]` NÃO permanece `blocked` — o estado da aba é recomputado imediatamente (a memoização reage a `formData`/`storeId`/`legalAccepted`/`hasVisualDirection`, não apenas ao booleano `hasLocalEdits`)
- **AND** a aba Direção Visual e o botão "Continuar" ficam liberados para avanço manual

#### Scenario: Aceitar o legal atualiza o estado de Posicionamento sem edição de campo

- **WHEN** o usuário tem nome + segmento + `storeId` e passa a aceitar o legal (`legalAccepted` → `true`) sem editar nenhum campo
- **THEN** `tabStates["posicionamento"]` é recomputado e deixa de ser `blocked` (`needs_legal_acceptance`)

#### Scenario: Data-load de loja existente auto-abre Direção Visual após deep-link bloqueado

- **WHEN** o usuário foi redirecionado de um deep-link para `direcao-visual` bloqueada e está em `posicionamento`
- **AND** o desbloqueio vem de **data-load** (`hasVisualDirection` passa a `true`)
- **THEN** a aba ativa passa a `direcao-visual` automaticamente
- **AND** `autoSave` é disparado uma vez pelo avanço

### Requirement: Back/forward entre abas

O sistema SHALL manter a aba ativa no history (D6): a navegação entre abas deve atualizar o `?tab=` no URL, e back/forward SHALL alternar a aba corretamente.

#### Scenario: Navegar entre abas altera o history

- **WHEN** o usuário troca de aba Dados para Posicionamento
- **THEN** o URL passa a `?tab=posicionamento`

#### Scenario: Back/forward restaura a aba

- **WHEN** o usuário pressiona back após ir de Dados para Posicionamento
- **THEN** a aba ativa volta para Dados
- **WHEN** o usuário pressiona forward
- **THEN** a aba ativa volta para Posicionamento

#### Scenario: Back/forward para aba bloqueada nega ativação (D16)

- **WHEN** o histórico tenta voltar/avançar para uma aba agora bloqueada
- **THEN** a aba bloqueada NÃO é ativada
- **AND** o usuário permanece/sincroniza na primeira aba anterior válida
- **AND** a URL é atualizada para refletir a aba realmente ativa

### Requirement: URL ?tab= e compat com required= legado

O sistema SHALL parsear `?tab=` em `store-page-client.tsx` para determinar a aba inicial (`initialTab`), e SHALL continuar aceitando o parâmetro legado `required=` (compat F36, D6/D12) mapeando para a aba correspondente:

- `required=cadastro-fiscal` → `?tab=dados&fiscal=pending`
- `required=visual-direction` → aba `direcao-visual`

O parâmetro `message=` (ex: `needs-visual-direction`) SHALL continuar sendo lido para exibir banner contextual na aba alvo.

#### Scenario: ?tab= define a aba inicial

- **WHEN** `/loja?tab=posicionamento` é acessado
- **THEN** a aba inicial é `posicionamento`

#### Scenario: ?tab=direcao-visual define a aba inicial

- **WHEN** `/loja?tab=direcao-visual` é acessado
- **THEN** a aba inicial é `direcao-visual`

#### Scenario: required= visual-direction legado mapeia para a aba ③

- **WHEN** `/loja?required=visual-direction` é acessado
- **THEN** a aba inicial é `direcao-visual` (compat)

#### Scenario: Sem parâmetros abre na aba Dados

- **WHEN** `/loja` é acessado sem `?tab=` e sem `required=`
- **THEN** a aba inicial é `dados`
