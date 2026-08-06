## ADDED Requirements

### Requirement: autoSave em use-store-form (save silencioso de campos válidos)

O sistema SHALL prover o método `autoSave(fields: Partial<StoreFormData>): Promise<{ ok: boolean }>` em `src/components/flow/use-store-form.ts` (D4), reutilizando o `save()` existente:

- Salva de forma **silenciosa** (sem mensagens de sucesso obrigatórias no fluxo de troca de aba)
- Persiste **apenas campos válidos** — campos inválidos são ignorados, não bloqueiam o save
- Se já existe `storeId` → PATCH silencioso (mesmo endpoint do `save()`)
- Se não existe `storeId` e o mínimo de criação está válido (nome + segmento + aceite legal) → `POST /api/store` em **modo draft** (cria a loja sem CNPJ — D15)
- Se não existe `storeId` e o mínimo **não** está válido → **não cria loja**; retorna `{ ok: false }` e o draft vai para o `localStorage` (D5)
- Retorna `{ ok: true }` em sucesso, `{ ok: false }` em falha (para o `saveStatus` do hook)

#### Scenario: Auto-save com loja existente faz PATCH silencioso

- **WHEN** `autoSave({ name: "Nova Loja" })` é chamado com `storeId` existente
- **THEN** um PATCH é enviado ao endpoint de edição da loja
- **AND** retorna `{ ok: true }` em sucesso

#### Scenario: Auto-save cria a loja em modo draft sem CNPJ

- **WHEN** `autoSave` é chamado sem `storeId`
- **AND** nome + segmento + aceite legal estão válidos
- **AND** CNPJ está vazio
- **THEN** `POST /api/store` é chamado em modo draft (sem CNPJ)
- **AND** a loja é criada (readiness fiscal pendente)
- **AND** retorna `{ ok: true }`

#### Scenario: Auto-save sem mínimo não cria loja

- **WHEN** `autoSave` é chamado sem `storeId`
- **AND** nome, segmento ou aceite legal estão ausentes
- **THEN** `POST /api/store` NÃO é chamado
- **AND** retorna `{ ok: false }`
- **AND** o draft permanece no `localStorage`

#### Scenario: Auto-save ignora campos inválidos

- **WHEN** `autoSave` é chamado com um campo inválido (ex: nome com 1 caractere) junto de campos válidos
- **THEN** o campo inválido é ignorado
- **AND** os campos válidos são persistidos

#### Scenario: Falha no auto-save retorna ok false

- **WHEN** o PATCH ou POST do auto-save falha
- **THEN** retorna `{ ok: false }`
- **AND** o estado do hook vira `saveStatus: "error"` (badge "Não salvo" + toast)
- **AND** o impacto na navegação depende do contexto: PATCH falha não bloqueia (pode navegar); falha na criação da loja mantém o usuário na aba Dados (ver cenários do `useOnboardingTabs`)

### Requirement: Hook useOnboardingTabs — orquestração de aba, auto-save e URL

O sistema SHALL prover o hook `src/hooks/use-onboarding-tabs.ts` (D4/D6/D13) que orquestra:

- `activeTab` / `setActiveTab(next)` — troca de aba; **roda `autoSave()` antes de navegar** (aguarda o save)
- `tabStates: Record<OnboardingTab, TabState>` — derivado de `computeTabState` (D7) para cada aba
- `saveStatus: "idle" | "saving" | "saved" | "error"` — feedback do auto-save
- `handleInternalNavigation(e)` — intercepta cliques em links internos (dashboard, campanhas, conta) e roda `autoSave()` antes de sair (D4 momento 2)
- `handlePageHide()` / `handleVisibilityChange()` — grava o draft síncrono (D4/D5)
- `onNavigate`/`onLeave` callbacks (permitem à `StoreIdentityForm` integrar com drift — D13)

O hook SHALL **serializar saves** (fila simples) e ignorar respostas defasadas (ref/seq guard) para evitar race entre auto-save e drift (ver riscos do artefato).

#### Scenario: Troca de aba com mínimo válido cria loja e desbloqueia a próxima

- **WHEN** o usuário troca da aba Dados para Posicionamento com nome + segmento + aceite legal válidos
- **THEN** `autoSave` cria a loja (POST draft)
- **AND** o draft é limpo do `localStorage`
- **AND** a aba Posicionamento é desbloqueada
- **AND** `saveStatus` termina em `"saved"`

#### Scenario: Troca de aba sem mínimo não cria loja

- **WHEN** o usuário tenta trocar da aba Dados para Posicionamento sem nome, segmento ou aceite válidos
- **THEN** o draft é gravado no `localStorage`
- **AND** `POST /api/store` NÃO é chamado
- **AND** a aba Posicionamento permanece bloqueada
- **AND** o usuário **permanece na aba Dados** (hard-block D16 — a aba bloqueada não é ativada)
- **AND** um feedback claro do que falta é exibido (na aba atual), sem ativar a aba bloqueada

#### Scenario: Troca para aba bloqueada não navega nem persiste (D16)

- **WHEN** o usuário tenta trocar para uma aba bloqueada (ex.: Posicionamento sem mínimo, ou Direção Visual sem tom de voz)
- **THEN** o `activeTab` NÃO muda para a aba bloqueada
- **AND** nenhum auto-save de navegação é disparado pelo alvo bloqueado (não há saída a persistir)
- **AND** o usuário permanece na aba atual com o motivo do bloqueio visível

#### Scenario: Dados → Posicionamento com mínimo válido cria a loja e navega (única exceção de alvo "bloqueado")

- **WHEN** o usuário tenta trocar de Dados para Posicionamento
- **AND** nome + segmento + aceite legal estão válidos mas `storeId` ainda não existe
- **THEN** o auto-save cria a loja via POST draft (D15)
- **AND** com `storeId` criado, o alvo passa a estar desbloqueado e a navegação prossegue

#### Scenario: Navegação interna roda auto-save antes de sair

- **WHEN** o usuário clica em um link interno (ex: Dashboard) com dados não salvos
- **THEN** `handleInternalNavigation` intercepta e chama `autoSave` antes de navegar

#### Scenario: Falha em PATCH não bloqueia navegação

- **WHEN** `autoSave` falha em um PATCH (com `storeId` existente) na troca de aba ou navegação interna
- **THEN** `saveStatus` vira `"error"`
- **AND** um badge "Não salvo" e toast de erro são exibidos
- **AND** o usuário ainda pode navegar (sem bloqueio) — na navegação interna, oferece "sair mesmo assim" (perde) ou "voltar" (D13)

#### Scenario: Falha na criação da loja mantém o usuário na aba Dados

- **WHEN** `autoSave` falha no `POST /api/store` (criação da loja) durante a troca Dados → Posicionamento
- **THEN** `saveStatus` vira `"error"`
- **AND** um badge "Não salvo" e toast de erro são exibidos
- **AND** o usuário permanece na aba Dados com os dados preservados
- **AND** a aba Posicionamento continua bloqueada com `needs_store_created` (a loja não foi criada)

#### Scenario: Saves concorrentes são serializados

- **WHEN** dois auto-saves são disparados em sequência (ex: troca de aba + navegação interna)
- **THEN** o segundo aguarda o primeiro (fila)
- **AND** respostas defasadas do primeiro não sobrescrevem o estado do segundo

### Requirement: Drift visual sensível/crítico preservado na navegação por abas

O drift SHALL pertencer aos **campos que alimentam a direção visual**, não a uma aba: quando a loja já tem brand profile/assinatura visual e o usuário altera campos do snapshot, qualquer tentativa de **sair do contexto atual** SHALL respeitar drift: trocar de aba, navegação interna (dashboard, campanhas), back/forward e saída da página. A detecção SHALL continuar via snapshot (`computeDriftStatus`/`getDriftPolicy`/`evaluateCriticalDrift`/`evaluateSensitiveDrift`), sem alterar a lógica de drift — apenas o momento de interceptação muda. A distinção de categorias SHALL seguir o código atual (`getDriftPolicy`):

- **Sensível** — campos de `SNAPSHOT_FIELDS` aplicáveis ao `identityState` (ex.: `text_only`: `name`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`)
- **Crítico (assinatura visual)** — `name`/`segment` sempre; mais `slogan`/`city`/`state` **somente** conforme `contentUsed.{slogan,city,state}` (esses campos não estão em `SNAPSHOT_FIELDS`; entram pela lógica crítica via `evaluateCriticalDrift`)

Quando houver drift novo (`driftCategory` em `critical` ou `sensitive`) e o usuário tentar sair do contexto com edições locais que tocam campos do snapshot, o sistema SHALL disparar o fluxo de drift **antes de persistir qualquer um desses campos**:

- `driftCategory === 'critical'` (com `criticalDrift.status === 'new'`) SHALL abrir o `DriftCriticalModal`
- `driftCategory === 'sensitive'` SHALL abrir o `DriftDecisionModal`
- A interceptação SHALL valer também para o **save explícito** (botão "Salvar e continuar") de **qualquer** aba que persiste campos do snapshot — inclusive a aba Dados (`name`/`segment`/`subsegment`) — abrindo o modal **antes** do PATCH
- A persistência (PATCH) dos campos do snapshot fica **adiada** até a decisão do usuário
- A decisão reutiliza os efeitos e endpoints atuais: `dismissCriticalDrift()` → **POST** `/api/store/{storeId}/visual-signature/dismiss-critical-drift`; `realinhar()` → **POST** `/api/store/{storeId}/brand-profile/realign`; `ignorar()` → **PATCH** `/api/store/{storeId}/brand-profile/metadata` com `{ drift_dismissed_snapshot: currentSnapshot }`
- A origem do save interceptado SHALL determinar a persistência pós-decisão: aba Dados (`'step1'`) → `save()`; aba Posicionamento (`'step2'`) → `save()` + efeitos visuais (cores/logo/inferência)
- **Realinhar** SHALL **persistir os dados aceitos ANTES do POST `/realign`** — a rota reconstrói o snapshot a partir do banco; salvar depois realinhar deixaria o snapshot stale e o drift voltaria
- **Ignorar / "Manter e salvar" / dismiss crítico** SHALL persistir os dados aceitos **sem** realinhar
- **Cancelar** o modal SHALL manter o usuário no contexto atual, **sem** persistir os campos do snapshot e sem decidir drift
- O drift **não é one-shot**: após realinhar/ignorar/dismiss, uma **nova divergência** em campos do snapshot SHALL reabrir o fluxo (refs de guard do `useDriftDetection` sincronizados com o estado público)
- Campos que **não** entram no snapshot (ex.: fiscal/billing, visuais não relacionados) SHALL poder auto-save normalmente, mesmo com drift pendente
- Após a decisão, o PATCH dos campos do snapshot e a navegação pretendida SHALL prosseguir
- A capacidade de assinaturas visuais (`totalGeneratedSignatures`) e o gatilho de limite SHALL permanecer inalterados

#### Scenario: Saída do contexto com drift sensível abre DriftDecisionModal antes de salvar

- **WHEN** o usuário edita um campo do snapshot e tenta sair do contexto (trocar de aba, clicar em gerar campanha, dashboard, back/forward) com drift sensível novo
- **THEN** o `DriftDecisionModal` abre
- **AND** nenhum PATCH dos campos do snapshot é enviado antes da decisão

#### Scenario: Drift crítico abre DriftCriticalModal

- **WHEN** `driftCategory === 'critical'` e `criticalDrift.status === 'new'` ao tentar sair do contexto
- **THEN** o `DriftCriticalModal` abre (não o `DriftDecisionModal`)
- **AND** a navegação/persistência é adiada até `dismissCriticalDrift()`

#### Scenario: Cancelar o modal mantém o usuário no contexto atual

- **WHEN** o usuário cancela o modal de drift (sem decidir realinhar/ignorar/dismiss)
- **THEN** o contexto atual é mantido
- **AND** os campos do snapshot não são persistidos

#### Scenario: Decisão de drift prossegue com o save e a navegação

- **WHEN** o usuário decide `realinhar()`, `ignorar()` ou `dismissCriticalDrift()`
- **THEN** a operação de drift é executada
- **AND** o auto-save dos campos do snapshot pendentes prossegue
- **AND** a navegação alvo é concluída

#### Scenario: Save explícito da aba Dados intercepta drift antes do PATCH

- **WHEN** o usuário clica em "Salvar e continuar" na aba Dados com drift novo e edições locais em `name`/`segment`/`subsegment`
- **THEN** o modal de drift abre (decisão se sensível; crítico se assinatura visual)
- **AND** **nenhum PATCH** de `/api/store/{storeId}` é enviado antes da decisão
- **AND** a origem `'step1'` é registrada para a persistência pós-decisão

#### Scenario: Realinhar persiste os dados aceitos antes do POST /realign

- **WHEN** o usuário escolhe "Realinhar" após um save interceptado
- **THEN** a persistência da origem interceptada roda **primeiro** (`save()` para Dados; `save()` + efeitos visuais para Posicionamento)
- **AND** somente depois o **POST** `/api/store/{storeId}/brand-profile/realign` é disparado
- **AND** o snapshot reconstruído pela rota reflete os dados recém-persistidos (drift não retorna)

#### Scenario: Ignorar ou manter e salvar persiste sem realinhar

- **WHEN** o usuário escolhe "Ignorar" ou "Manter e salvar" após um save interceptado
- **THEN** a persistência da origem interceptada roda **sem** chamar `/realign`
- **AND** no caso "Ignorar", o `drift_dismissed_snapshot` é gravado (badge some)
- **AND** no caso "Manter e salvar", o badge de drift permanece

#### Scenario: Cancelar o save interceptado não persiste nada

- **WHEN** o usuário cancela o modal aberto por um save explícito interceptado
- **THEN** nenhum PATCH dos campos do snapshot é enviado
- **AND** o usuário permanece na aba atual com as edições locais preservadas

#### Scenario: Drift reabre em nova divergência após realinhar/ignorar

- **WHEN** o usuário resolve um drift (realinhar/ignorar/dismiss) e depois altera novamente um campo do snapshot
- **THEN** a detecção re-classifica o estado (ex.: `'new'`) e o fluxo de drift abre novamente
- **AND** a resolução anterior não torna o drift one-shot

#### Scenario: Campos fora do snapshot são salvos normalmente com drift pendente

- **WHEN** há drift novo pendente e o usuário troca de aba com edições em campos que não entram no snapshot (ex.: fiscal/billing)
- **THEN** o auto-save desses campos roda normalmente
- **AND** o fluxo de drift só bloqueia os campos do snapshot

#### Scenario: Capacidade de assinaturas visuais é preservada

- **WHEN** a loja já tem assinatura visual ativa e o fluxo de drift roda
- **THEN** `totalGeneratedSignatures` permanece intacto
- **AND** o gatilho de limite de assinaturas não é alterado

### Requirement: Computação de estado por aba (computeTabState)

O sistema SHALL prover `computeTabState(tab, ctx): { state: TabState; reason?: TabBlockReason }` em `src/lib/store-onboarding/tab-state.ts` (D7), função pura:

- `ctx: { hasLocalEdits, isPersisted, unlocked, readiness }` onde `readiness` é `StoreReadiness` da F34 (`check_store_readiness`)
- Estados: `blocked` (Bloqueada) / `draft` (Rascunho) / `saved` (Salva) / `ready` (Pronta) / `pending_generation` (Pendente para gerar)
- **Prioridade** se dois estados aplicam: `pending_generation` > `blocked` > `draft` > `ready` > `saved`

#### Scenario: Aba bloqueada retorna estado blocked

- **WHEN** `computeTabState("posicionamento", { unlocked: false, ... })` é chamado
- **THEN** retorna `{ state: "blocked", reason }`

#### Scenario: Edição local não salva retorna draft

- **WHEN** `computeTabState("dados", { hasLocalEdits: true, isPersisted: false, ... })` é chamado
- **THEN** retorna `{ state: "draft" }`

#### Scenario: Aba persistida e completa retorna ready

- **WHEN** `computeTabState("dados", { hasLocalEdits: false, isPersisted: true, unlocked: true, ... })` é chamado
- **THEN** retorna `{ state: "ready" }`

#### Scenario: Readiness incompleta retorna pending_generation

- **WHEN** `computeTabState("dados", { readiness: { ready: false, missing: ["cadastro_fiscal"] }, ... })` é chamado
- **THEN** retorna `{ state: "pending_generation", reason: "fiscal_pending" }`

#### Scenario: Prioridade favor rece pending_generation sobre blocked

- **WHEN** um estado `pending_generation` e `blocked` aplicam simultaneamente
- **THEN** retorna `pending_generation`
