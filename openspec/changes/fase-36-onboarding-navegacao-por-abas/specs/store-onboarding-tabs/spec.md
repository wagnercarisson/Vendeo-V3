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
- **`posicionamento`** (loja nova): exige nome + segmento + aceite legal **aceito** E `storeId` já existente (loja criada via auto-save). Se falta aceite → `reason: "needs_legal_acceptance"`. Se dados válidos mas sem `storeId` → `reason: "needs_store_created"`. **CNPJ não bloqueia** (D8)
- **`direcao-visual`** (loja nova): exige `storeId` já existente E `tone_of_voice` preenchido (D9). Posicionamento/descrição/slogan não bloqueiam. Se falta `storeId` → `reason: "needs_store_created"`. Se falta tom de voz → `reason: "needs_tone_of_voice"`
- **Loja existente**: se a loja já tem direção visual salva (`hasVisualDirection`), a aba `direcao-visual` nasce aberta mesmo sem tom de voz
- **CNPJ**: ausente não bloqueia navegação em nenhuma aba — vira pendência de readiness (`fiscal_pending`)

`TabBlockReason = "needs_legal_acceptance" | "needs_tone_of_voice" | "needs_store_created" | "fiscal_pending"`.

#### Scenario: Aba dados sempre desbloqueada

- **WHEN** `computeTabUnlock("dados", ctx)` é chamado com qualquer ctx
- **THEN** retorna `{ unlocked: true }`

#### Scenario: Posicionamento bloqueado sem aceite legal

- **WHEN** `computeTabUnlock("posicionamento", ctx)` é chamado sem nome, segmento ou aceite legal aceito
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

### Requirement: Container ARIA tabs (store-tabs)

O sistema SHALL prover o componente `store-tabs.tsx` (`src/components/flow/store-tabs.tsx`) que implementa o padrão WAI-ARIA Tabs (D11):

- `role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` e `aria-controls`
- **Roving tabindex**: apenas o tab ativo é tabulável; setas ← → e Home/End movem o foco
- `aria-describedby` no tab bloqueado apontando para a explicação do bloqueio no painel ativo
- Estados das abas (bloqueada/pronta/pendente) expostos via `aria-label` (não apenas cor)
- Touch targets ≥ 44px (herdado da F22)
- Anúncio de mudança de estado via `aria-live` na região da aba

O componente SHALL ter duas variantes:
- **Desktop**: rótulos completos (Dados / Posicionamento / Direção Visual) com motivo exibido no painel ativo
- **Mobile (compacta)**: rótulos curtos (`Dados` / `Perfil` / `Visual`), badge pequeno por estado (ponto/ícone discreto no canto da aba, não texto completo), motivo exibido no painel ativo (nunca dentro do botão da aba) e botão inferior "Continuar" sempre visível (avança para a próxima liberada ou retrocede)

#### Scenario: Tablist com ARIA tabs válidos

- **WHEN** `StoreTabs` é renderizado
- **THEN** a estrutura tem `role="tablist"`, `role="tab"` e `role="tabpanel"`
- **AND** o tab ativo tem `aria-selected="true"` e `tabIndex={0}`
- **AND** os demais tabs têm `tabIndex={-1}`

#### Scenario: Setas movem o foco entre abas

- **WHEN** o usuário pressiona ArrowRight em um tab
- **THEN** o foco move para o próximo tab
- **AND** `aria-selected` atualiza para o novo tab ativo

#### Scenario: Motivo exibido no painel, não no botão da aba

- **WHEN** uma aba está bloqueada
- **THEN** o motivo (`falta aceite legal`, `falta tom de voz`, etc.) é exibido no painel ativo
- **AND** o botão da aba exibe apenas o badge de estado (sem o texto do motivo)

#### Scenario: Mobile usa labels curtos e badge pequeno

- **WHEN** o viewport é mobile
- **THEN** as tabs exibem `Dados` / `Perfil` / `Visual`
- **AND** o badge de estado é discreto (ponto/ícone no canto)
- **AND** o botão inferior "Continuar" está sempre visível

#### Scenario: Touch targets atendem 44px

- **WHEN** o componente é inspecionado no mobile
- **THEN** todos os targets de toque têm altura ≥ 44px

### Requirement: Deep-link em aba bloqueada (nunca tela em branco)

O sistema SHALL, quando o usuário acessa `/loja?tab=<aba>` para uma aba bloqueada (D6):

- Abrir na aba solicitada com o bloqueio visível e o motivo no painel
- Exibir um link "Voltar para X" apontando para a aba anterior liberada
- NUNCA exibir tela em branco

#### Scenario: Deep-link para aba bloqueada mostra bloqueio + link

- **WHEN** o usuário acessa `/loja?tab=direcao-visual` e a aba está bloqueada (sem tom de voz)
- **THEN** a aba Direção Visual é exibida com o estado bloqueado
- **AND** um link "Voltar para Posicionamento" é exibido no painel

#### Scenario: Deep-link para aba liberada abre direto

- **WHEN** o usuário acessa `/loja?tab=posicionamento` e a aba está desbloqueada
- **THEN** a aba Posicionamento é exibida diretamente

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
