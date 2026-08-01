## Context

O onboarding de loja do Vendeo é hoje um fluxo de **2 steps** (`StoreIdentityForm`): o Step 1 (dados da loja) precisa **salvar no banco** (POST `/api/store`) para gerar um `storeId` e só então o Step 2 (Direção Visual) é liberado. O `StorePageClient` mapeia `required=visual-direction` → `initialStep=2` (hack), a interceptação de drift (`use-drift-detection`) só dispara em `step === 2`, o aceite legal é um checkbox dentro do Step 1, e nada é persistido antes do primeiro `storeId` (sair da página perde tudo).

Três fatos de backend condicionam o design:

1. **`POST /api/store` exige CNPJ** (`src/app/api/store/route.ts:74-76`) — desde F32/F33, sem CNPJ retorna 400. A RPC usada é `create_store_with_cnpj`, que cria loja + aceites legais + tenta grant freemium (condicionado à decisão de elegibilidade). A RPC anterior sem CNPJ (`create_store_with_legal_acceptance`) foi **dropada** na F32 — não existe mais.
2. **`stores.cnpj_normalized` é nullable** (lojas legadas pré-F32 existem sem CNPJ) — criar uma loja draft sem CNPJ é viável no schema atual.
3. **`update_store_cnpj` RPC + `/api/store/update-cnpj`** já existem (F32/F33) para anexar/verificar CNPJ em loja existente — é o caminho natural para "loja draft → fiscal" quando o lojista informar o CNPJ depois.

**Dependências:** F30 (`legalClearance`, `ContractAcceptanceModal`, `getAcceptanceStatus`), F32/F33 (CNPJ obrigatório na geração/crédito, `is_test_store`, `update_store_cnpj`), F34 (`check_store_readiness` RPC, `getStoreReadiness`, `MissingItem`), F22 (touch targets ≥ 44px). Design system: `openspec/design-system/MASTER.md` + `pages/store-identity.md` (override).

## Goals / Non-Goals

**Goals:**
- `/loja` com 3 abas (Dados / Posicionamento / Direção Visual), navegação por `?tab=` no history (back/forward funcionam), desbloqueio progressivo com soft-block
- Três conceitos separados: avanço (abas) × qualidade da identidade (campos recomendados) × permissão de gerar (gates F34)
- Aceite legal como coluna lateral global (Pendente/Aceito/Reaceite necessário), responsivo, bloqueia Posicionamento quando pendente
- Auto-save confiável em troca de aba + navegação interna; abandono mobile protegido por `localStorage` TTL 24h via `pagehide`/`visibilitychange` (escrita síncrona); PATCH no `unload` best-effort
- Rascunho `localStorage` com TTL, chave `vendeo:store_draft:${userId}:new` → `:${storeId}`, limpo após 1º save e logout
- CNPJ não bloqueia navegação (pendência de readiness); bloqueia geração/crédito (inalterado)
- Regra mínima p/ Direção Visual: só tom de voz (loja nova)
- Estados por aba: Bloqueada / Rascunho / Salva / Pronta / Pendente para gerar + motivo no painel ativo
- Abas mobile compactas (Dados/Perfil/Visual), badge pequeno, botão "Continuar" sempre visível
- ARIA tabs completo (tablist/tab/tabpanel, roving tabindex, setas, aria-live)
- Redirects/banners migrados para `?tab=` (`/campanhas/nova`, `/cadastro/cnpj`, `ReadinessBanner`); `required=` legado compatível
- **Backend**: `POST /api/store` em dois modos — draft (sem CNPJ, `create_store_draft`) × verified/fiscal (com CNPJ, `create_store_with_cnpj`); loja draft não concede crédito nem libera geração
- 34+ testes (máquina de abas, tab-state, legal panel, auto-save/draft, URL/redirects, mobile, drift) + migração dos testes existentes

**Non-Goals:**
- Stripe / Monetização Pública — deslocada para F37 (v1.7)
- Billing como aba própria — colapsado na aba Dados, opcional (como hoje)
- Persistência cross-device do rascunho — local com TTL cobre o mobile
- Multi-loja / seletor de loja no onboarding
- Redesign visual do onboarding além das abas (segue o design system atual)
- Onboarding adaptativo por plano (não há planos ainda)
- i18n (produto PT-BR)
- Limpeza automática de lojas draft órfãs (tratada futuramente)
- Restaurar a RPC antiga `create_store_with_legal_acceptance` — a F36 cria `create_store_draft` nova

## Decisions

### D1 — Três abas desbloqueáveis em sequência

`DECIDIDO`

Três abas na rota `/loja`:

| Aba | Conteúdo | Desbloqueia quando (loja nova) |
|-----|----------|--------------------------------|
| **① Dados** | Nome, CNPJ/fiscal (BrasilAPI + manual), segmento, subsegmento, cidade/UF, billing colapsado. Aceite legal fica na coluna lateral (D3) | Aberta por padrão |
| **② Posicionamento** | Tom de voz, posicionamento, descrição curta, slogan (+ card informativo de campos recomendados) | Nome + segmento + **aceite legal aceito** E loja criada via auto-save (mínimo para criar a loja) |
| **③ Direção Visual** | Logo, assinatura visual, cores, preview (3 caminhos da F34) | **`storeId` existente + apenas tom de voz preenchido** (D9) |

Para loja existente, o desbloqueio é calculado dos dados salvos + edições locais (não puramente sequencial — loja com direção visual já nasce com a aba ③ aberta).

**Avanço (Dados → Posicionamento):** nome + segmento + aceite legal (com loja criada via auto-save). CNPJ **não** bloqueia. **Posicionamento → Direção Visual:** apenas tom de voz (exige `storeId` já existente — o tom de voz é persistido na loja).

Contrato: `computeTabUnlock(tab, ctx)` em `src/lib/store-onboarding/tabs.ts` retorna `{ unlocked, reason? }` — motivos `needs_legal_acceptance`, `needs_tone_of_voice`, `needs_store_created`, `fiscal_pending`.

### D2 — Três conceitos separados: avanço × qualidade × permissão de gerar

`DECIDIDO`

| Dimensão | Regra | Impacto | Onde aparece na UI |
|----------|-------|---------|--------------------|
| **Avanço** | Mínimo da aba anterior válido (D1) | Controla o que dá para **navegar** | Bloqueio das abas + motivo no painel |
| **Qualidade da identidade** | Campos recomendados, sem bloqueio (D9) | Melhora o resultado da arte | Card informativo "recomendado" |
| **Permissão de gerar** | Gates da F34 (readiness RPC + guarda dupla) | Controla se dá para **gerar campanha** | Estados `Pendente para gerar` + banners |

Princípio: *navegar no onboarding não deve exigir loja pronta; gerar campanha deve.*

### D3 — Aceite legal como coluna lateral global

`DECIDIDO`

O aceite sai da aba Dados e vira uma **coluna lateral global** na página `/loja` (condição do estado da loja, não campo do formulário). Componente novo `legal-acceptance-panel.tsx`:

- **Desktop:** coluna lateral **sticky dentro do conteúdo** (participa do grid, não sobrepõe)
- **Mobile:** bloco compacto no topo da aba ou antes do CTA — sem sticky persistente
- **Estados:** `Pendente` / `Aceito` / `Reaceite necessário` (enum único `LegalAcceptanceState`, derivado de `getAcceptanceStatus`/`legal-status` da F30 — `current` → `accepted`, `outdated` → `needs_reacceptance`, ausente → `pending`)
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
- Falha de save → estado "Não salvo" explícito (badge + toast). **PATCH** falha não bloqueia a navegação; **falha na criação da loja (POST)** impede o avanço Dados → Posicionamento (permanece na aba ①, próxima aba bloqueada com `needs_store_created` — fluxo D4)
- Com `storeId` → PATCH silencioso via `useStoreForm.save()` (mesmo endpoint da F19)
- **Antes do 1º `storeId` não se cria loja prematuramente** — o draft vai para o `localStorage` (D5)
- Direção Visual mantém botão Salvar explícito (aba que consome créditos/upload)

Fluxo do save ao sair da aba Dados (troca de aba): tem nome+segmento+aceite? → NÃO: mantém draft no localStorage, navega para aba (bloqueada). → SIM: `POST /api/store` (cria loja via modo draft — D15) → `storeId` → "Salva ✓", limpa draft, desbloqueia Posicionamento. Falha → "Não salvo" (badge + toast), permanece na aba ① com dados preservados.

### D5 — Rascunho persistente: `localStorage` com TTL escopado por usuário

`DECIDIDO`

- **Chave:** `vendeo:store_draft:${userId}:new` (antes do 1º save) / `vendeo:store_draft:${userId}:${storeId}` (depois)
- **TTL:** 24h a partir da última edição (`updatedAt`). Expirado → ignorado e removido no restore
- **Escrita:** a cada campo editado (debounce ~400ms) **e** síncrona em `pagehide`/`visibilitychange`
- **Limpeza:** após o 1º save que cria a loja (migração atômica: lê draft, escreve no form, limpa chave) e no logout
- **Restauração:** ao abrir `/loja`, restaura se dentro do TTL e reconcilia com o banco (se `storeId` já existe)
- `localStorage` (não `sessionStorage`): sobrevive a fechar aba e alternar app; TTL evita "draft velho ressuscitado"

`draft-store.ts` expõe `draftKey(userId, storeId)`, `saveDraft(draft)`, `restoreDraft(userId, storeId)`, `clearDraft(userId, storeId?)`.

### D6 — URL `?tab=` (substitui o hack `initialStep`)

`DECIDIDO`

```
/loja?tab=dados
/loja?tab=posicionamento
/loja?tab=direcao-visual
```

- `StorePageClient` lê `?tab=` via `useSearchParams` → `initialTab`. Aba ativa vive no history (back/forward funcionam)
- Deep-link em aba bloqueada → cai na aba com bloqueio + link "Voltar para X" (nunca tela em branco)
- `required=` legado continua aceito (compat F36), mapeando para a aba correspondente (`cadastro-fiscal` → dados, `visual-direction` → direcao-visual)

Mapeamento de redirects (D12): ver tabela na D12.

### D7 — Estados por aba (badges simplificados)

`DECIDIDO`

`computeTabState(tab, ctx)` em `src/lib/store-onboarding/tab-state.ts` — função pura testável:

| Estado | Badge |
|--------|-------|
| **Bloqueada** | `Bloqueada` |
| **Rascunho** | `Rascunho` |
| **Salva** | `Salva ✓` |
| **Pronta** | `✓ Pronta` |
| **Pendente para gerar** | `⚠ Pendente para gerar` |

Motivo específico no **painel ativo**, não no botão da aba (D10). Prioridade se dois estados aplicam: `Pendente para gerar` > `Bloqueada` > `Rascunho` > `Pronta` > `Salva`. A aba Direção Visual mantém o badge "Necessário" da F34 quando o brand profile não está syncado.

### D8 — CNPJ: não bloqueia onboarding; bloqueia geração/crédito

`DECIDIDO`

- No onboarding, CNPJ não bloqueia navegação. Aba Dados mostra "Fiscal pendente" quando CNPJ/razão/nome fantasia ausentes
- Avançar até a Direção Visual sem CNPJ é permitido
- Na **geração e na concessão de crédito**, CNPJ continua obrigatório (guard F34 + readiness RPC + F32/F33) — exceto `is_test_store`, que gera sem CNPJ apenas com crédito/entitlement de teste concedido por admin e **nunca recebe grant freemium automático sem CNPJ**
- BrasilAPI/CNPJá continuam preenchendo razão social e nome fantasia; se falharem, preenchimento manual permanece
- Ao tentar gerar sem fiscal, o banner aponta para `/loja?tab=dados&fiscal=pending`

### D9 — Regra mínima para a Direção Visual: só tom de voz

`DECIDIDO`

Para loja nova, a aba ③ desbloqueia com **`storeId` existente + apenas o tom de voz** preenchido na aba ② (o tom de voz é persistido na loja, então a aba só libera após a criação via auto-save). Posicionamento/descrição/slogan são opcionais e recomendados. Card informativo curto na aba ② ("Essas informações ajudam o Vendeo a criar artes com linguagem, estilo e argumentos mais próximos da sua loja."). Para loja existente com direção visual salva, a aba ③ nasce aberta.

### D10 — Abas no mobile: compactas, motivo fora do botão

`DECIDIDO`

- Tabs compactas horizontais: `Dados`, `Perfil`, `Visual` — **APENAS label responsivo**; o `id` da aba permanece `posicionamento`/`direcao-visual` (query param, testes, analytics)
- Badge pequeno por estado (ponto/ícone discreto no canto), não texto completo
- Motivo exibido no painel ativo, nunca dentro do botão da aba
- Botão inferior "Continuar" sempre visível (avança/retrocede) — área de toque confortável
- Touch targets ≥ 44px (F22)
- No desktop, labels completos (Dados / Posicionamento / Direção Visual)

### D11 — Acessibilidade (ARIA tabs)

`DECIDIDO`

`role="tablist"`/`role="tab"`/`role="tabpanel"` + `aria-selected`/`aria-controls`; roving tabindex (só o ativo tabulável; setas ←/→ e Home/End movem o foco); `aria-describedby` no tab bloqueado apontando para o motivo no painel; estados via `aria-label` (não só cor); `aria-live` na região da aba; aceite legal via `aria-label`/`aria-expanded`; touch targets ≥ 44px.

### D12 — Migração dos redirects/banners existentes

`DECIDIDO`

| Ponto | Arquivo | Mudança |
|-------|---------|---------|
| Guard `/campanhas/nova` | `src/app/(app)/campanhas/nova/page.tsx` | `required=cadastro-fiscal` → `?tab=dados&fiscal=pending`; `required=visual-direction` → `?tab=direcao-visual&message=needs-visual-direction` |
| Redirect `/cadastro/cnpj` | `src/app/(app)/cadastro/cnpj/page.tsx` | → `/loja?tab=dados&fiscal=pending` (mantendo `returnTo`) |
| `ReadinessBanner` | `src/components/readiness/readiness-banner.tsx` | `cadastro_fiscal` → `?tab=dados&fiscal=pending`; `brand_profile` → `?tab=direcao-visual&message=needs-visual-direction` |
| Query param legado | `store-page-client.tsx` | continua aceitando `required=` (compat) mapeando para a aba correspondente |

Nenhuma mensagem contextual é perdida: `fiscal=pending`, `message=needs-visual-direction` são lidos pelo `/loja` e exibidos como banner informativo na aba alvo.

### D13 — Drift detection integrada à navegação por abas

`DECIDIDO`

- Dispara na **troca de aba** com alterações não salvas (rascunho ativo) — pergunta "Salvar alterações?"
- Dispara na **navegação interna de saída** com rascunho ativo — auto-save (D4) roda primeiro; se falhar, "sair mesmo assim" (perde) ou "voltar"
- **Abandono (reload/fechar/background):** escrita síncrona do draft (D4/D5) cobre; sem modal
- Modal de drift existente é reutilizado, ampliado para "troca de aba"

**O drift pertence aos campos que alimentam a direção visual, não à aba.** A lógica de detecção não muda (snapshot, `computeDriftStatus`, `getDriftPolicy`, `evaluateCriticalDrift`/`evaluateSensitiveDrift`); o que muda com as abas é só o **momento de interceptação**. Se a loja já tem brand profile/assinatura visual e o usuário altera um campo que compõe o snapshot visual, qualquer tentativa de **sair do contexto atual** respeita drift: trocar de aba, clicar em dashboard, clicar em gerar campanha, back/forward, sair da página. A distinção de categorias segue o código atual (`getDriftPolicy`):

- **Sensível** → campos de `SNAPSHOT_FIELDS` aplicáveis ao `identityState` (ex.: `text_only`: `name`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`)
- **Crítico (assinatura visual)** → `name`/`segment` sempre; mais `slogan`/`city`/`state` **apenas quando** `contentUsed.{slogan,city,state}` — esses três campos **não** estão em `SNAPSHOT_FIELDS`; entram pela lógica crítica da assinatura visual (`evaluateCriticalDrift`)

**Ordem preservada (bloqueador, não regressível):** o fluxo atual em `store-identity-form.tsx` é mantido — com drift **sensível ou crítico novo**, o modal abre **antes de persistir** campos do snapshot. Bifurcação e endpoints exatos (iguais ao código atual):

1. `driftCategory === 'critical'` (com `criticalDrift.status === 'new'`) → **`DriftCriticalModal`**; `dismissCriticalDrift()` → **POST** `/api/store/${store.id}/visual-signature/dismiss-critical-drift`
2. senão `driftCategory === 'sensitive'` → **`DriftDecisionModal`**; `realinhar()` → **POST** `/api/store/${store.id}/brand-profile/realign`; `ignorar()` → **PATCH** `/api/store/${store.id}/brand-profile/metadata` com `{ drift_dismissed_snapshot: currentSnapshot }`
3. só após a decisão (realinhar/ignorar/dismissCriticalDrift) o PATCH dos campos do snapshot e a navegação prosseguem

**Auto-save seletivo:** na troca de aba/navegação interna, se as edições locais tocam campos do snapshot e há drift novo, o PATCH desses campos fica **adiado** até a decisão. Campos que **não** entram no snapshot (ex.: fiscal/billing, visuais não relacionados) podem auto-save normalmente. Cancelar o modal mantém o usuário no contexto atual, sem persistir campos do snapshot. A capacidade de múltiplas assinaturas visuais (`totalGeneratedSignatures`) e o gatilho de limite permanecem inalterados.

### D14 — Renumeração F36/F37

`DECIDIDO`

| Antes | Depois |
|-------|--------|
| F36 = Stripe / Monetização Pública (v1.5) | **F36 = Onboarding — Navegação por Abas** (v1.5) |
| — | **F37 = Stripe / Monetização Pública** (v1.7, pós-beta) |

Já aplicado no artefato; atualizar trackings (`ROADMAP.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) após aprovação.

### D15 — Backend: `POST /api/store` em dois modos (draft × verified/fiscal)

`DECIDIDO` (re-alinhamento desta revisão)

**Problema:** o artefato D1/D4/D8 exige criar a loja no auto-save **sem CNPJ**, mas o `POST /api/store` atual (F32/F33) exige CNPJ e a RPC `create_store_with_legal_acceptance` (sem CNPJ) foi removida.

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
src/components/flow/use-drift-detection.ts     ← intercepta troca de aba + navegação interna
src/app/api/store/route.ts                     ← modo draft × verified
supabase/migrations/<timestamp>_f36_create_store_draft.sql ← RPC create_store_draft
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Auto-save cria lojas sem CNPJ ("draft stores")** | Aceitável e intencional (D8/D15). Readiness RPC trata como pendente; banner aponta para `?tab=dados&fiscal=pending`. Lojas órfãs sem ação por longo período podem ser tratadas futuramente (limpeza) |
| **Criação draft pode conflitar com o grant freemium posterior** | `create_store_draft` nunca concede crédito; o grant só ocorre via `create_store_with_cnpj` ou `update-cnpj`. Entitlement-first (INSERT ON CONFLICT) da F32 garante idempotência |
| **BrasilAPI indisponível → CNPJ fica pendente** | Não bloqueia navegação (D8); preenchimento manual permanece; readiness continua reportando pendência |
| **PATCH no `unload` pode ser abortado pelo browser (mobile)** | Não prometido (D4): escrita síncrona do draft via `pagehide`/`visibilitychange` é a proteção garantida |
| **Draft `localStorage` expira (TTL 24h) e usuário volta depois** | Aceitável: onboarding reiniciável e curto; TTL evita "draft velho"; janela de 1 dia cobre abandono mobile típico |
| **Draft `localStorage` entre contas/lojas** | Chave escopada por usuário + loja; limpa no logout — nunca cruza |
| **Auto-save × drift race (saves concorrentes)** | `useOnboardingTabs` serializa saves (fila simples) e ignora respostas defasadas (ref/seq guard) |
| **Draft diverge do banco após 1º save** | Migração explícita e atômica ao criar loja; reconciliação ao reabrir |
| **Aceite legal ocupar a tela no mobile** | Bloco compacto no topo da aba ou antes do CTA, sem sticky persistente (D3/D10) |
| **`?tab=` deep-link para aba bloqueada** | Nunca tela em branco: aba solicitada aparece com bloqueio + link "Voltar" (D6) |
| **Compat `required=` legado vira código morto** | Mantido apenas na F36 como transição; removido numa fase futura (nota no código) |
| **Regressão em testes que dependem de step 1/2 e do POST com CNPJ obrigatório** | Refatoração com testes migrados juntos (mesmo PR); mocks de `POST /api/store` atualizados para o modo draft; suíte completa roda antes do merge |
| **`create_store_draft` duplicar lógica de inserção de loja** | Caminho curto e explícito; semelhante à RPC removida da F30; as validações de nome/segmento/subsegmento permanecem na rota (reuso das funções atuais) |

## Migration Plan

- **Migration SQL única**: `supabase/migrations/<timestamp>_f36_create_store_draft.sql` com `CREATE OR REPLACE FUNCTION public.create_store_draft(...)` (SECURITY DEFINER, service_role only) + revoke/grants. `stores.cnpj_normalized` já é nullable — sem ALTER de coluna
- **Deploy**: normal na Vercel (migração + código no mesmo PR). Rollback: reverter o commit; a RPC draft fica órfã mas inofensiva (nenhum dado persistente é afetado)
- **Pós-aprovação**: atualizar trackings com a renumeração F36/F37 (D14) e o escopo de "loja draft"
- **Sem mudança de API pública de leitura**; `localStorage` é idiossincrático e reconciliado naturalmente

## Open Questions

Nenhuma. Todas as decisões (D1-D14 do alinhamento + D15 desta revisão) estão documentadas. A divergência de CNPJ foi resolvida com o re-alinhamento: `POST /api/store` em dois modos (draft × verified/fiscal), com a regra "loja draft não é loja pronta".
