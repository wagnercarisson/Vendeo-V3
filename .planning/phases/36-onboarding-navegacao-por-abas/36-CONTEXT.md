# Phase 36: Onboarding — Navegação por Abas - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-36-onboarding-navegacao-por-abas/`)

<domain>
## Phase Boundary

O onboarding de loja do Vendeo é um wizard linear de **2 steps** (`StoreIdentityForm`): o Step 1 (dados da loja) precisa salvar no banco (POST `/api/store`) para gerar um `storeId` e só então o Step 2 (Direção Visual) é liberado. Isso cria atrito real: o lojista não consegue "espiar" o que vem depois sem preencher o mínimo (nome + segmento + aceite legal), sair no meio do Step 1 **perde o que foi digitado** (não há rascunho antes do primeiro `storeId`), não há navegação livre (wizard linear), a camada de readiness (F34) é ignorada no fluxo, o aceite legal é "mais um checkbox perdido" e **beta testers usam celular** — abandono real (fechar aba, alternar app, browser descarregar a página) é comum e o rascunho precisa sobreviver a isso.

A F36 substitui o wizard 2-steps por **3 abas** (`dados` / `posicionamento` / `direcao-visual`) na rota `/loja` com `?tab=` na URL, e adiciona **escopo backend**: `POST /api/store` passa a suportar **dois modos de criação** — draft (sem CNPJ, via nova RPC `create_store_draft`, sem crédito) × verified/fiscal (com CNPJ, `create_store_with_cnpj` inalterado). A loja draft existe para permitir onboarding, posicionamento e direção visual, mas **não libera campanha nem freemium** até cadastro fiscal válido (exceto `is_test_store`).

**Dependências:** F30 (`legalClearance`, `ContractAcceptanceModal`, `getAcceptanceStatus`), F32/F33 (CNPJ obrigatório na geração/crédito, `is_test_store`, `update_store_cnpj`), F34 (`check_store_readiness` RPC, `getStoreReadiness`, `MissingItem`, guarda dupla), F22 (touch targets ≥ 44px). Design system: `openspec/design-system/MASTER.md` + `openspec/design-system/pages/store-identity.md`.
</domain>

<decisions>
## Implementation Decisions

### D1 — Três abas desbloqueáveis em sequência
`DECIDIDO`

Três abas na rota `/loja`: **① Dados** (Nome, CNPJ/fiscal opcional, segmento, subsegmento, cidade/UF, billing colapsado — aberta por padrão), **② Posicionamento** (tom de voz, posicionamento, descrição curta, slogan + card informativo de campos recomendados), **③ Direção Visual** (logo, assinatura visual, cores, preview dos 3 caminhos da F34).

Desbloqueio (loja nova):
- **① Dados** → aberta por padrão
- **② Posicionamento** → nome + segmento + **aceite legal aceito** E loja criada via auto-save (mínimo para criar a loja). CNPJ **não** bloqueia
- **③ Direção Visual** → `storeId` existente + **apenas tom de voz** preenchido (D9)

Para loja existente, o desbloqueio é calculado dos dados salvos + edições locais (não puramente sequencial — loja com direção visual já nasce com a aba ③ aberta). Contrato: `computeTabUnlock(tab, ctx)` em `src/lib/store-onboarding/tabs.ts` retorna `{ unlocked, reason? }` — motivos `needs_legal_acceptance`, `needs_tone_of_voice`, `needs_store_created`, `fiscal_pending`.

### D2 — Três conceitos separados: avanço × qualidade × permissão de gerar
`DECIDIDO`

| Dimensão | Regra | Impacto | Onde aparece na UI |
|----------|-------|---------|--------------------|
| **Avanço** | Mínimo da aba anterior válido (D1) | Controla o que dá para **navegar** | **Hard-block** das abas + motivo acessível no botão/status (tooltip/`aria-label`) |
| **Qualidade da identidade** | Campos recomendados, sem bloqueio (D9) | Melhora o resultado da arte | Card informativo "recomendado" |
| **Permissão de gerar** | Gates da F34 (readiness RPC + guarda dupla) | Controla se dá para **gerar campanha** | Estados `Pendente para gerar` + banners |

Princípio: *navegar no onboarding não deve exigir loja pronta; gerar campanha deve.*

### D3 — Aceite legal como coluna lateral global
`DECIDIDO`

O aceite sai da aba Dados e vira uma **coluna lateral global** na página `/loja` (condição do estado da loja, não campo do formulário). Componente novo `legal-acceptance-panel.tsx`:

- **Desktop:** coluna lateral **sticky dentro do conteúdo** (participa do grid, não sobrepõe)
- **Mobile:** bloco compacto no topo da aba ou antes do CTA — sem sticky persistente
- **Estados:** `Pendente` / `Aceito` / `Reaceite necessário` (enum único `LegalAcceptanceState = "pending" | "accepted" | "needs_reacceptance"`, derivado de `getAcceptanceStatus`/`legal-status` da F30 — `current` → `accepted`, `outdated` → `needs_reacceptance`, ausente → `pending`)
- **Bloqueio de avanço:** não aceito → aba Posicionamento bloqueada com `falta aceite legal`
- **Permissão de gerar:** sem aceite vigente não gera (gate F34 inalterado)
- Reutiliza `ContractAcceptanceModal` da F30 — apenas reposicionado com estado visível

### D4 — Auto-save e eventos de saída
`DECIDIDO`

| Momento | Mecanismo | Confiabilidade |
|---------|-----------|----------------|
| **Troca de aba** | `autoSave()` silencioso (PATCH ou criação da loja) antes de navegar | **Alta** — save disparado e aguardado |
| **Navegação interna** | Intercepta a navegação e roda `autoSave()` antes | **Alta** — navegação interna é interceptável |
| **Reload / fechar aba / background** | Grava o draft de forma **síncrona** no `localStorage` via `pagehide`/`visibilitychange` | **Alta** — escrita síncrona não é abortada |
| **PATCH no `unload`** | fire-and-forget se já existe `storeId` | **Best-effort** — não prometido |

Regras:
- Persiste **apenas campos válidos** (inválidos são ignorados)
- Falha de save → estado "Não salvo" explícito (badge + toast). **PATCH** falha não bloqueia a navegação; **falha na criação da loja (POST)** impede o avanço Dados → Posicionamento (permanece na aba ①, próxima aba bloqueada com `needs_store_created`)
- Com `storeId` → PATCH silencioso via `useStoreForm.save()` (mesmo endpoint da F19)
- **Antes do 1º `storeId` não se cria loja prematuramente** — o draft vai para o `localStorage` (D5)
- Direção Visual mantém botão Salvar explícito (aba que consome créditos/upload)

### D5 — Rascunho persistente: `localStorage` com TTL escopado por usuário
`DECIDIDO`

- **Chave:** `vendeo:store_draft:${userId}:new` (antes do 1º save) / `vendeo:store_draft:${userId}:${storeId}` (depois)
- **TTL:** 24h a partir da última edição (`updatedAt`). Expirado → ignorado e removido no restore
- **Escrita:** a cada campo editado (debounce ~400ms) **e** síncrona em `pagehide`/`visibilitychange`
- **Limpeza:** após o 1º save que cria a loja (migração atômica: lê draft, escreve no form, limpa chave) e no logout
- **Restauração:** ao abrir `/loja`, restaura se dentro do TTL e reconcilia com o banco (se `storeId` já existe)
- **`localStorage` (não `sessionStorage`):** sobrevive a fechar aba e alternar app; TTL evita "draft velho ressuscitado"

`draft-store.ts` expõe `draftKey(userId, storeId)`, `saveDraft(draft)`, `restoreDraft(userId, storeId)`, `clearDraft(userId, storeId?)`.

### D6 — URL `?tab=` (substitui o hack `initialStep`)
`DECIDIDO`

`/loja?tab=dados|posicionamento|direcao-visual`. `StorePageClient` lê `?tab=` via `useSearchParams` → `initialTab`. Aba ativa vive no history (back/forward funcionam). Deep-link em aba bloqueada → **não abre a aba bloqueada**: redireciona/sincroniza para a **primeira aba anterior válida** (posicionamento bloqueada → Dados; direcao-visual bloqueada → Posicionamento se liberada, senão Dados) + aviso "Complete esta etapa para liberar {aba}" (D6/D16, nunca tela em branco). `required=` legado continua aceito (compat F36), mapeando para a aba correspondente (`cadastro-fiscal` → dados, `visual-direction` → direcao-visual). `message=` continua lido para banner contextual.

### D7 — Estados por aba (badges simplificados)
`DECIDIDO`

`computeTabState(tab, ctx)` em `src/lib/store-onboarding/tab-state.ts` — função pura testável. Estados: `Bloqueada` / `Rascunho` / `Salva ✓` / `✓ Pronta` / `⚠ Pendente para gerar`. Motivo específico **acessível no botão da aba** (tooltip/`aria-label`), não dependendo do painel ativo (D16). Prioridade se dois estados aplicam: `Pendente para gerar` > `Bloqueada` > `Rascunho` > `Pronta` > `Salva`. A aba Direção Visual mantém o badge "Necessário" da F34 quando o brand profile não está syncado.

### D8 — CNPJ: não bloqueia onboarding; bloqueia geração/crédito
`DECIDIDO`

No onboarding, CNPJ não bloqueia navegação. Aba Dados mostra "Fiscal pendente" quando CNPJ/razão/nome fantasia ausentes. Avançar até a Direção Visual sem CNPJ é permitido. Na **geração e na concessão de crédito**, CNPJ continua obrigatório (guard F34 + readiness RPC + F32/F33) — exceto `is_test_store`, que gera sem CNPJ apenas com crédito/entitlement de teste concedido por admin e **nunca recebe grant freemium automático sem CNPJ**. BrasilAPI/CNPJá continuam preenchendo razão social e nome fantasia; se falharem, preenchimento manual permanece. Ao tentar gerar sem fiscal, o banner aponta para `/loja?tab=dados&fiscal=pending`.

### D9 — Regra mínima para a Direção Visual: só tom de voz
`DECIDIDO`

Para loja nova, a aba ③ desbloqueia com **`storeId` existente + apenas o tom de voz** preenchido na aba ② (o tom de voz é persistido na loja, então a aba só libera após a criação via auto-save). Posicionamento/descrição/slogan são opcionais e recomendados. Card informativo curto na aba ② ("Essas informações ajudam o Vendeo a criar artes com linguagem, estilo e argumentos mais próximos da sua loja."). Para loja existente com direção visual salva, a aba ③ nasce aberta.

### D10 — Abas no mobile: compactas, motivo acessível no botão
`DECIDIDO`

Tabs compactas horizontais: `Dados`, `Perfil`, `Visual` — **APENAS label responsivo**; o `id` da aba permanece `posicionamento`/`direcao-visual` (query param, testes, analytics). Badge pequeno por estado (ponto/ícone discreto no canto), não texto completo. Motivo acessível no botão da aba (tooltip/`aria-label`) — nunca depende do painel ativo (D16). Botão inferior "Continuar" sempre visível (avança/retrocede), **desabilitado quando a próxima aba está bloqueada** com microcopy do que falta — área de toque confortável. Touch targets ≥ 44px (F22). No desktop, labels completos (Dados / Posicionamento / Direção Visual).

### D11 — Acessibilidade (ARIA tabs)
`DECIDIDO`

`role="tablist"`/`role="tab"`/`role="tabpanel"` + `aria-selected`/`aria-controls`; roving tabindex (só o ativo tabulável; setas ←/→ e Home/End movem o foco); aba bloqueada com `aria-disabled="true"` e o motivo acessível via `aria-label`/`aria-describedby`/tooltip no próprio botão (D16); estados via `aria-label` (não só cor); `aria-live` na região da aba; aceite legal via `aria-label`/`aria-expanded`; touch targets ≥ 44px.

### D12 — Migração dos redirects/banners existentes
`DECIDIDO`

| Ponto | Arquivo | Mudança |
|-------|---------|---------|
| Guard `/campanhas/nova` | `src/app/(app)/campanhas/nova/page.tsx` | `required=cadastro-fiscal` → `?tab=dados&fiscal=pending&returnTo=/campanhas/nova`; `required=visual-direction` → `?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova` |
| Redirect `/cadastro/cnpj` | `src/app/(app)/cadastro/cnpj/page.tsx` + `cnpj-update-form.tsx` | pós-atualização → `/loja?tab=dados&fiscal=pending` (sem CNPJ pendente) ou `/loja?tab=direcao-visual&message=cnpj-updated` (sem brand profile) |
| `ReadinessBanner` | `src/components/readiness/readiness-banner.tsx` + `cnpj-update-banner.tsx` | `cadastro_fiscal` → `?tab=dados&fiscal=pending&returnTo=/dashboard`; `brand_profile` → `?tab=direcao-visual&message=needs-visual-direction` |
| Query param legado | `store-page-client.tsx` | continua aceitando `required=` (compat) mapeando para a aba correspondente |

Nenhuma mensagem contextual é perdida: `fiscal=pending`, `message=needs-visual-direction` são lidos pelo `/loja` e exibidos como banner informativo na aba alvo.

### D13 — Drift detection integrada à navegação por abas
`DECIDIDO`

- Dispara na **troca de aba** com alterações não salvas (rascunho ativo) — pergunta "Salvar alterações?"
- Dispara na **navegação interna de saída** com rascunho ativo — auto-save (D4) roda primeiro; se falhar, "sair mesmo assim" (perde) ou "voltar"
- **Abandono (reload/fechar/background):** escrita síncrona do draft (D4/D5) cobre; sem modal
- Modal de drift existente é reutilizado, ampliado para "troca de aba"

**O drift pertence aos campos que alimentam a direção visual, não à aba.** A lógica de detecção não muda (snapshot, `computeDriftStatus`, `getDriftPolicy`, `evaluateCriticalDrift`/`evaluateSensitiveDrift`); o que muda com as abas é só o **momento de interceptação** (troca de aba, dashboard, gerar campanha, back/forward, saída da página). Distinção de categorias segue o código atual (`getDriftPolicy`):

- **Sensível** → campos de `SNAPSHOT_FIELDS` aplicáveis ao `identityState` (ex.: `text_only`: `name`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`)
- **Crítico (assinatura visual)** → `name`/`segment` sempre; mais `slogan`/`city`/`state` **apenas quando** `contentUsed.{slogan,city,state}` — esses três campos **não** estão em `SNAPSHOT_FIELDS`; entram pela lógica crítica da assinatura visual (`evaluateCriticalDrift`)

**Ordem preservada (bloqueador, não regressível):** com drift **sensível ou crítico novo**, o modal abre **antes de persistir** campos do snapshot. Bifurcação e endpoints exatos (iguais ao código atual):

1. `driftCategory === 'critical'` (com `criticalDrift.status === 'new'`) → **`DriftCriticalModal`**; `dismissCriticalDrift()` → **POST** `/api/store/${store.id}/visual-signature/dismiss-critical-drift`
2. senão `driftCategory === 'sensitive'` → **`DriftDecisionModal`**; `realinhar()` → **POST** `/api/store/${store.id}/brand-profile/realign`; `ignorar()` → **PATCH** `/api/store/${store.id}/brand-profile/metadata` com `{ drift_dismissed_snapshot: currentSnapshot }`
3. só após a decisão (realinhar/ignorar/dismissCriticalDrift) o PATCH dos campos do snapshot e a navegação prosseguem

**Auto-save seletivo:** na troca de aba/navegação interna, se as edições locais tocam campos do snapshot e há drift novo, o PATCH desses campos fica **adiado** até a decisão. Campos que **não** entram no snapshot (ex.: fiscal/billing, visuais não relacionados) podem auto-save normalmente. Cancelar o modal mantém o usuário no contexto atual, sem persistir campos do snapshot. O drift **crítico** é computado **client-side contra o formData vivo** (computeCriticalDriftStatus — o GET visual-signature avalia contra o banco, estale antes do save); a capacidade de novas assinaturas é gateada por **créditos** (`canGenerateNewSignature = !creditsChargingEnabled || saldo>0`) e `totalGeneratedSignatures` permanece apenas como contagem.

### D14 — Renumeração F36/F37
`DECIDIDO`

| Antes | Depois |
|-------|--------|
| F36 = Stripe / Monetização Pública (v1.5) | **F36 = Onboarding — Navegação por Abas** (v1.5) |
| — | **F37 = Stripe / Monetização Pública** (v1.7, pós-beta) |

Já aplicado no artefato; trackings (`ROADMAP.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) atualizados.

### D15 — Backend: `POST /api/store` em dois modos (draft × verified/fiscal)
`DECIDIDO` (re-alinhamento desta revisão)

**Problema:** o artefato D1/D4/D8 exige criar a loja no auto-save **sem CNPJ**, mas o `POST /api/store` atual (F32/F33) exige CNPJ e a RPC `create_store_with_legal_acceptance` (sem CNPJ) foi removida na F32 — **não é restaurada**.

**Decisão:** `POST /api/store` passa a suportar **dois modos de criação**:

```
POST /api/store
  ├── sem cnpj → MODO DRAFT: create_store_draft(p_user_id, p_name, p_segment, ...)
  │        → insere store (cnpj null), registra 2 aceites legais, NÃO chama entitlement/grant
  │        → { store, onboardingGranted: false }
  └── com cnpj → MODO VERIFIED/FISCAL: create_store_with_cnpj(...) (caminho atual F32/F33,
           com validação BrasilAPI/CNPJá, root hash, freemium entitlement-first/grant-second)
```

**RPC `create_store_draft` (nova migration):**
- Assinatura análoga à antiga `create_store_with_legal_acceptance` (sem os parâmetros de CNPJ e sem grant): `(p_user_id UUID, p_name TEXT, p_segment TEXT, p_city TEXT, p_state TEXT, p_accepted_by_user_id UUID, p_terms_version TEXT, p_acceptable_use_version TEXT, p_ip_address TEXT, p_user_agent TEXT, p_brand_color TEXT, p_logo_url TEXT, p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT, p_short_description TEXT, p_slogan TEXT)`
- Insere em `stores` com `cnpj_normalized/cnpj_root_hash/razao_social/nome_fantasia = NULL`, registra os 2 aceites legais (`acceptance_source = 'onboarding'`), **sem** `try_grant_onboarding_entitlement` nem `grant_credits`
- `SECURITY DEFINER`, `SET search_path = ''`, service_role only (mesmo padrão)
- Retorna `{ store, onboardingGranted: false }`

**Regra (OpenSpec):** *Loja draft não é loja pronta. Ela existe para permitir onboarding, posicionamento e direção visual. Ela não libera campanha nem freemium até cadastro fiscal válido, exceto `is_test_store`.*

**CNPJ informado depois:** usa o fluxo existente `POST /api/store/update-cnpj` (`update_store_cnpj` RPC, F32/F33), que valida CNPJ, calcula root hash, avalia freemium e anexa os dados fiscais à loja existente. Nenhuma mudança nessa rota é necessária para a F36, mas os testes devem cobrir o encadeamento draft → fiscal.

**Impactos nos gates:**
- `getStoreReadiness` (F34): loja draft sem CNPJ → `missing: ["cadastro_fiscal", ...]` → `ready: false` — sem mudança na lógica, o dado ausente já gera a pendência
- Guard `/campanhas/nova` e `LegalClearanceGate` (F34): inalterados — loja draft sem fiscal/aceite não gera
- Crédito freemium: **não concedido** na criação draft (sem entitlement/grant na RPC); concedido apenas pelo fluxo com CNPJ (`create_store_with_cnpj`) ou `update-cnpj` posterior

### Estrutura de arquivos (ref.)
```
src/lib/store-onboarding/
  tabs.ts               ← OnboardingTab, TabState, TabBlockReason, TAB_ORDER, computeTabUnlock
  tab-state.ts          ← computeTabState (puro)
  draft-store.ts        ← DRAFT_TTL_MS, StoreDraft, draftKey/saveDraft/restoreDraft/clearDraft
  __tests__/            ← testes unitários
src/hooks/use-onboarding-tabs.ts
src/components/flow/store-tabs.tsx            ← container ARIA tabs + mobile compacto
src/components/flow/legal-acceptance-panel.tsx ← coluna lateral global (D3)
src/components/flow/store-identity-form.tsx    ← refatoração central
src/components/flow/store-page-client.tsx      ← parsing ?tab=, compat required=
src/components/flow/use-store-form.ts          ← autoSave(), saveDraft/restoreDraft
src/components/flow/use-drift-detection.ts     ← CONSUMIDO como está (D13) — fonte de detecção/ações de drift; NÃO modificar; interceptação orquestrada em use-onboarding-tabs/StoreIdentityForm
src/app/api/store/route.ts                     ← modo draft × verified
supabase/migrations/<timestamp>_f36_create_store_draft.sql ← RPC create_store_draft
```
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Onboarding por Abas — Core
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/design.md` — Full architecture decisions D1-D15 + estrutura de arquivos + riscos
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/proposal.md` — Why/What/Impact + capabilities novas/modificadas
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/tasks.md` — Complete task breakdown (6 grupos: backend, máquina de abas, auto-save/draft/drift, UI, redirects, testes)

### Specs
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-onboarding-tabs/spec.md` — tabs.ts, computeTabUnlock, StoreTabs ARIA, deep-link, back/forward, ?tab= + compat required=
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-onboarding-draft/spec.md` — draft-store.ts, TTL 24h, pagehide/visibilitychange, restauração/reconciliação, limpeza
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-onboarding-autosave/spec.md` — autoSave(), useOnboardingTabs, serialização de saves, drift preservado, computeTabState
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/legal-acceptance-panel/spec.md` — LegalAcceptancePanel, enum LegalAcceptanceState, bloqueio da aba Posicionamento
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-draft-creation/spec.md` — RPC create_store_draft, POST /api/store dois modos, gates preservados, draft → fiscal
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-identity-ui/spec.md` — store-identity-form refatorado, /loja painel 3 abas, redirects ?tab=, CNPJ opcional
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-readiness/spec.md` — delta F36 getStoreReadiness (draft = cadastro_fiscal pendente), prioridade fiscal → brand profile
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-ownership-api/spec.md` — delta F36 POST /api/store dois modos, scenarios 201/400/409/401

### Dependências de fases anteriores
- `.planning/phases/30-legal-foundation/30-CONTEXT.md` — F30 legalClearance, ContractAcceptanceModal, getAcceptanceStatus
- `.planning/phases/32-freemium-anti-abuso-cnpj/32-CONTEXT.md` — F32 create_store_with_cnpj, freemium entitlement/grant, update_store_cnpj
- `.planning/phases/33-verificacao-cnpj-freemium/33-CONTEXT.md` — F33 brand profiles, is_test_store, verification_status
- `.planning/phases/34-store-readiness/34-CONTEXT.md` — F34 check_store_readiness, getStoreReadiness, guarda dupla, ReadinessBanner
- `.planning/phases/35-changelog-novidades/35-CONTEXT.md` — F35 changelog (contexto da milestone)
</canonical_refs>

<specifics>
## Specific Ideas

- **Migration única:** `supabase/migrations/<timestamp>_f36_create_store_draft.sql` — CREATE OR REPLACE FUNCTION `create_store_draft(...)` (SECURITY DEFINER, service_role only, `SET search_path = ''`) seguindo o padrão de `20260727000001_freemium_anti_abuso_cnpj.sql`. `stores.cnpj_normalized` já é nullable — sem ALTER de coluna
- **Novo módulo `src/lib/store-onboarding/tabs.ts`:** `OnboardingTab = "dados" | "posicionamento" | "direcao-visual"`, `TAB_ORDER`, `OnboardingTabDef` (label desktop/mobile), `TabBlockReason`, `computeTabUnlock(tab, ctx)` puro
- **Novo módulo `src/lib/store-onboarding/tab-state.ts`:** `computeTabState(tab, ctx)` puro com prioridade `pending_generation > blocked > draft > ready > saved`
- **Novo módulo `src/lib/store-onboarding/draft-store.ts`:** `DRAFT_TTL_MS = 24h`, `StoreDraft { userId, storeId, fields, updatedAt }`, `draftKey/saveDraft/restoreDraft/clearDraft` + `__tests__/`
- **Novo hook `src/hooks/use-onboarding-tabs.ts`:** `activeTab`/`setActiveTab` (auto-save antes de navegar), `tabStates`, `saveStatus: "idle" | "saving" | "saved" | "error"`, `handleInternalNavigation`, `handlePageHide`/`handleVisibilityChange` (handlers públicos no retorno); `onDriftNavigate`/`onDriftLeave` como callbacks RECEBIDOS via `options` (36-04), serialização de saves (fila + ref/seq guard)
- **Novos componentes:** `src/components/flow/store-tabs.tsx` (ARIA tabs + variante mobile compacta), `src/components/flow/legal-acceptance-panel.tsx` (coluna lateral global)
- **Modificados:** `store-identity-form.tsx` (wizard 2 steps → painel 3 abas), `store-page-client.tsx` (parsing `?tab=` + compat `required=`), `use-store-form.ts` (`autoSave()`, `saveDraft/restoreDraft`), `readiness-banner.tsx` + `cnpj-update-banner.tsx` (links `?tab=`), `campanhas/nova/page.tsx` (redirect `?tab=` + `message=`), `cadastro/cnpj/page.tsx` + `cnpj-update-form.tsx` (redirect `?tab=dados&fiscal=pending`)
- **Preservado (D13 — NÃO modificar):** `use-drift-detection.ts` permanece fonte de detecção e ações de drift; a interceptação de saída de contexto (troca de aba, navegação interna, back/forward, saída) é orquestrada por `use-onboarding-tabs.ts` / `StoreIdentityForm`, que consomem o hook existente
- **API route:** `src/app/api/store/route.ts` — `cnpj` vira opcional; branch draft → `create_store_draft` (reuso das validações de name/segment/acceptedTerms + IP/UA), retorno 201 com `onboardingGranted: false`; branch verified → `create_store_with_cnpj` intacto
- **Regressões a cobrir:** F30/F32/F33/F34 (criação com CNPJ + crédito, readiness, guard de `/campanhas/nova`, banner do dashboard) + drift (bloqueadores) + testes de endpoint (draft, verified, 409, 400, 401)
- **Entrega verificável:** `npm run typecheck`, `npm run lint`, `npx vitest run` sem erros; validação manual mobile (pagehide/visibilitychange, rascunho restaurado, CTA "Continuar" fixo) e desktop (coluna sticky, back/forward)
</specifics>

<deferred>
## Deferred Ideas

- Stripe / Monetização Pública — deslocada para F37 (v1.7, pós-beta)
- Billing como aba própria — colapsado na aba Dados, opcional (como hoje)
- Persistência cross-device do rascunho — local com TTL cobre o mobile
- Multi-loja / seletor de loja no onboarding
- Redesign visual do onboarding além das abas (segue o design system atual)
- Onboarding adaptativo por plano (não há planos ainda)
- i18n (produto PT-BR)
- Limpeza automática de lojas draft órfãs (tratada futuramente)
- Restaurar a RPC antiga `create_store_with_legal_acceptance` — a F36 cria `create_store_draft` nova
- Remoção do compat `required=` legado — mantido apenas na F36 como transição (nota no código)
</deferred>

---

*Phase: 36-onboarding-navegacao-por-abas*
*Context gathered: 2026-08-01 via OpenSpec artifacts*
