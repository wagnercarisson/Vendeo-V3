## Why

O onboarding de loja do Vendeo é um wizard linear de **2 steps** (`StoreIdentityForm`): o Step 1 (dados da loja) precisa **salvar no banco** (POST `/api/store`) para gerar um `storeId` e só então o Step 2 (Direção Visual) é liberado. Isso cria atrito real: o lojista não consegue "espiar" o que vem depois sem preencher o mínimo (nome + segmento + aceite legal), sair no meio do Step 1 **perde o que foi digitado** (não há rascunho antes do primeiro `storeId`), não há navegação livre (wizard linear), a camada de readiness (F34) é ignorada no fluxo, o aceite legal é "mais um checkbox perdido" e **beta testers usam celular** — abandono real (fechar aba, alternar app, browser descarregar a página) é comum e o rascunho precisa sobreviver a isso.

## What Changes

- **3 abas no lugar de 2 steps** — Dados / Posicionamento / Direção Visual na rota `/loja`, com navegação por abas na URL (`?tab=dados|posicionamento|direcao-visual`), deep-link e back/forward funcionando (substitui o hack `initialStep` legado)
- **Três conceitos separados** — **avanço** (o que destrava a próxima aba), **qualidade da identidade** (campos recomendados que melhoram o resultado, sem bloquear) e **permissão de gerar** (gates da F34 que autorizam gerar campanha)
- **Desbloqueio progressivo (hard-block, D16)** — abas nascem bloqueadas e liberam quando a anterior tiver o mínimo válido; a aba bloqueada **não é ativável** (clique, teclado, "Continuar", deep-link, back/forward) e seu conteúdo funcional **nunca renderiza**; o motivo fica acessível no próprio botão (tooltip/`aria-label`) e o usuário nunca vê tela em branco — deep-link/back-forward em aba bloqueada redirecionam para a **primeira aba anterior válida** com aviso "Complete esta etapa para liberar {aba}"
- **Aceite legal como coluna lateral global** — fora da aba Dados, com estados `Pendente / Aceito / Reaceite necessário` (derivados do `legalClearance` da F30), responsivo; sem aceite, a aba Posicionamento fica bloqueada com motivo claro
- **Auto-save confiável** — troca de aba e navegação interna salvam antes de navegar; abandono mobile (fechar aba/reload/background) protegido por **`localStorage` com TTL 24h** escrito de forma síncrona via `pagehide`/`visibilitychange`; PATCH no `unload` é best-effort (não prometido)
- **Rascunho pré-storeId** — `localStorage` com TTL 24h, chave `vendeo:store_draft:${userId}:new` antes do 1º save e `vendeo:store_draft:${userId}:${storeId}` após existir loja; limpo após o 1º save que cria a loja e no logout
- **CNPJ não bloqueia onboarding** — vira pendência de readiness ("Fiscal pendente"); bloqueia **geração/crédito** (regras F32/F33/F34 intactas, exceto `is_test_store`)
- **Regra mínima para a Direção Visual: só tom de voz** (loja nova) — posicionamento/descrição/slogan opcionais com card informativo curto
- **Estados por aba simplificados** — `Bloqueada / Rascunho / Salva / Pronta / Pendente para gerar` via `computeTabState` puro; motivo específico **acessível no botão da aba** (tooltip/`aria-label`/`aria-describedby`), nunca no painel — a aba bloqueada não fica ativa nem renderiza conteúdo funcional (D16)
- **Abas mobile compactas** — labels `Dados / Perfil / Visual` (apenas label responsivo; o `id` permanece `posicionamento`/`direcao-visual`), badge pequeno, botão inferior "Continuar" sempre visível e **desabilitado quando a próxima aba está bloqueada** (microcopy do que falta)
- **ARIA tabs** — padrão WAI-ARIA `tablist`/`tab`/`tabpanel`, roving tabindex, setas ←/→ e Home/End, `aria-live`, estados via `aria-label`
- **Redirects e banners migrados** — `/campanhas/nova`, `/cadastro/cnpj` e `ReadinessBanner` passam a emitir `?tab=` + mensagem contextual (`fiscal=pending`, `message=needs-visual-direction`); `required=` legado continua aceito como compat (F36)
- **Drift intercepta troca de aba + navegação interna** com rascunho ativo (além do `step === 2` atual)

**Decisão de escopo (re-alinhamento pós-revisão):** a F36 inclui mudança **backend** para permitir a criação da loja **sem CNPJ** (loja draft em estado fiscal pendente), viabilizando D1/D4/D8. `POST /api/store` passa a suportar **dois modos de criação**:
- **Draft (sem CNPJ):** cria a loja com `name` + `segment` + campos opcionais válidos + aceite legal, via nova RPC `create_store_draft`. **NÃO concede crédito freemium**, deixa a readiness fiscal pendente e preserva os gates de geração
- **Verified/Fiscal (com CNPJ):** mantém o caminho atual `create_store_with_cnpj` com validação e avaliação freemium da F32/F33
- Quando o CNPJ for informado depois, usa o fluxo existente `/api/store/update-cnpj` (`update_store_cnpj` RPC) para anexar/verificar CNPJ na loja existente

**Regra do OpenSpec (loja draft):** *Loja draft não é loja pronta. Ela existe para permitir onboarding, posicionamento e direção visual. Ela não libera campanha nem freemium até cadastro fiscal válido, exceto `is_test_store`.*

**Entrega verificável:** `/loja` com 3 abas ARIA, coluna lateral de aceite legal, draft `localStorage` TTL 24h, auto-save confiável, URL `?tab=` com deep-link, redirects migrados, gates de geração inalterados (regressão F32/F33/F34), e `npm run typecheck`, `npm run lint`, `npx vitest run` sem erros.

## Capabilities

### New Capabilities

- `store-onboarding-tabs`: Máquina de abas do onboarding — `tabs.ts` (definição das 3 abas + `computeTabUnlock` retornando `{ unlocked, reason }`), `tab-state.ts` (`computeTabState` puro) e componente `store-tabs.tsx` (container ARIA tabs + variante mobile compacta). Cobre desbloqueio progressivo com **hard-block (D1/D2/D16)**, URL `?tab=` (D6), estados por aba (D7), regra do tom de voz (D9), mobile compacto (D10) e ARIA (D11)
- `store-onboarding-draft`: Rascunho persistente em `localStorage` com TTL 24h escopado por usuário — `draft-store.ts` com `draftKey/saveDraft/restoreDraft/clearDraft`, chaves `:new`/`:${storeId}`, escrita síncrona em `pagehide`/`visibilitychange`, limpeza após 1º save e logout, restauração com reconciliação (D5)
- `store-onboarding-autosave`: Orquestração de auto-save e saída — hook `useOnboardingTabs` (troca de aba com auto-save antes de navegar, navegação interna interceptada, `saveStatus`, serialização de saves) + `autoSave()` em `use-store-form` (salva apenas campos válidos) + integração de drift (troca de aba + navegação interna, D4/D13)
- `legal-acceptance-panel`: Coluna lateral global de aceite legal em `/loja` — `legal-acceptance-panel.tsx` com estados `pending/accepted/needs_reacceptance` (enum único do fluxo), variantes `desktop-sticky-column`/`mobile-compact`, CTA reutilizando `ContractAcceptanceModal` da F30 e bloqueio de avanço da aba Posicionamento (D3)
- `store-draft-creation`: Criação da loja em modo draft sem CNPJ — nova RPC `create_store_draft` (loja + aceites legais em transação, sem grant freemium, readiness fiscal pendente) e branch explícito no `POST /api/store` (draft sem CNPJ × verified/fiscal com CNPJ via `create_store_with_cnpj`); anexo/verificação posterior de CNPJ via fluxo `update-cnpj` existente. Preserva gates de geração e crédito (F32/F33/F34)

### Modified Capabilities

- `store-identity-ui`: `StoreIdentityForm` refatorado de wizard 2 steps para painel de 3 abas — `useState<1 | 2>` → estado de abas, `initialStep` → `initialTab` (parsing `?tab=`), aceite legal removido do formulário (vira coluna lateral D3), `redirectMessage` continua lendo `message=`, `required=` legado mapeado para a aba correspondente (compat D6/D12)
- `store-readiness`: `ReadinessBanner` e links de readiness migrados de `?required=` para `?tab=` da pendência (`?tab=dados&fiscal=pending` para fiscal, `?tab=direcao-visual&message=needs-visual-direction` para brand profile), mantendo a mensagem contextual; guard de `/campanhas/nova` e redirect `/cadastro/cnpj` atualizados (D12). Critérios/prioridade de readiness da F34 permanecem inalterados
- `store-ownership-api`: `POST /api/store` passa a aceitar a criação em **dois modos** — sem CNPJ (draft, via `create_store_draft`, sem crédito) e com CNPJ (verified/fiscal, via `create_store_with_cnpj`, com validação F32/F33); CNPJ deixa de ser obrigatório na criação (vira opcional), mas os gates de geração e a concessão de crédito continuam exigindo fiscal válido

## Impact

- **Novos arquivos**: `src/lib/store-onboarding/` (`tabs.ts`, `tab-state.ts`, `draft-store.ts`, `__tests__/`), `src/hooks/use-onboarding-tabs.ts`, `src/components/flow/legal-acceptance-panel.tsx`, `src/components/flow/store-tabs.tsx`
- **Arquivos modificados**: `src/components/flow/store-identity-form.tsx` (refatoração central), `src/components/flow/store-page-client.tsx` (parsing `?tab=`, compat `required=`), `src/components/flow/use-store-form.ts` (`autoSave()`, `saveDraft/restoreDraft`), `src/components/flow/use-drift-detection.ts` (intercepta troca de aba + navegação interna), `src/components/readiness/readiness-banner.tsx` (links `?tab=`), `src/app/(app)/campanhas/nova/page.tsx` (redirect `?tab=` + `message=`), `src/app/(app)/cadastro/cnpj/page.tsx` (redirect `?tab=dados&fiscal=pending`)
- **Backend (novo escopo)**: `src/app/api/store/route.ts` (modo draft sem CNPJ), migration SQL com RPC `create_store_draft` (nova; a antiga `create_store_with_legal_acceptance` foi removida na F32 — não é restaurada), testes de endpoint (criação sem CNPJ, crédito não concedido sem fiscal, geração bloqueada sem fiscal)
- **Dependências de fases anteriores**: F30 (`legalClearance`, `ContractAcceptanceModal`), F32/F33 (CNPJ obrigatório na geração/crédito, `is_test_store`), F34 (readiness RPC `check_store_readiness`, `getStoreReadiness`), F22 (touch targets ≥ 44px)
- **Sem novas dependências** de runtime; `localStorage` para draft; zero mudança de API pública de leitura
- **Migração SQL**: nova (RPC `create_store_draft`) — com `stores.cnpj_normalized` já nullable, lojas draft são viáveis no schema atual
