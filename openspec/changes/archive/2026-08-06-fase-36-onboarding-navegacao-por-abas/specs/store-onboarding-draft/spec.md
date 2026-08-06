## ADDED Requirements

### Requirement: Rascunho em localStorage com TTL escopado por usuário

O sistema SHALL prover `src/lib/store-onboarding/draft-store.ts` com o rascunho persistente do onboarding em `localStorage` (D5):

- `DRAFT_TTL_MS = 24 * 60 * 60 * 1000` (24h a partir da última edição)
- Interface `StoreDraft { userId: string; storeId: string | null; fields: Partial<StoreFormData>; updatedAt: number }`
- Funções puras/isoláveis:
  - `draftKey(userId, storeId): string` — `vendeo:store_draft:${userId}:new` quando `storeId` é null; `vendeo:store_draft:${userId}:${storeId}` quando existe
  - `saveDraft(draft: StoreDraft): void` — grava com `updatedAt = Date.now()`
  - `restoreDraft(userId, storeId): StoreDraft | null` — retorna o draft se dentro do TTL; se expirado, retorna `null` **e remove a chave**
  - `clearDraft(userId, storeId?): void` — remove a chave

A escolha por `localStorage` (e não `sessionStorage`) SHALL ser documentada no código: sobrevive a fechar aba e alternar app no mobile; `sessionStorage` só sobrevive a refresh na mesma aba.

#### Scenario: Chave antes do primeiro save usa sufixo new

- **WHEN** `draftKey("user-1", null)` é chamado
- **THEN** retorna `vendeo:store_draft:user-1:new`

#### Scenario: Chave após existir loja usa o storeId

- **WHEN** `draftKey("user-1", "store-42")` é chamado
- **THEN** retorna `vendeo:store_draft:user-1:store-42`

#### Scenario: Draft é salvo e restaurado dentro do TTL

- **WHEN** `saveDraft({ userId, storeId: null, fields: { name: "Loja X" }, updatedAt })` é chamado
- **AND** `restoreDraft(userId, null)` é chamado dentro de 24h
- **THEN** o draft é retornado com os campos salvos

#### Scenario: Draft expirado é ignorado e removido

- **WHEN** `restoreDraft(userId, null)` é chamado com `updatedAt` fora do TTL de 24h
- **THEN** retorna `null`
- **AND** a chave é removida do `localStorage`

#### Scenario: Draft entre usuários não cruza

- **WHEN** `saveDraft` grava para `user-1`
- **AND** `restoreDraft("user-2", null)` é chamado
- **THEN** retorna `null`

### Requirement: Escrita síncrona no abandono mobile (pagehide/visibilitychange)

O sistema SHALL, no abandono (reload, fechar aba, alternar app, browser descarregar a página), gravar o draft de forma **síncrona** no `localStorage` via `pagehide` e `visibilitychange` (D4/D5). A escrita síncrona SHALL ser a proteção principal — `beforeunload` é pouco confiável em mobile e o PATCH assíncrono no fechamento é best-effort (não prometido).

O hook `useOnboardingTabs` SHALL registrar handlers de `pagehide` e `visibilitychange` (quando `document.visibilityState === 'hidden'`) que:
1. Escrevem o draft corrente no `localStorage` (síncrono)
2. Se já existe `storeId`, disparam PATCH fire-and-forget (best-effort, sem bloquear)

#### Scenario: pagehide grava draft síncrono

- **WHEN** o evento `pagehide` dispara com rascunho ativo
- **THEN** o draft é gravado de forma síncrona no `localStorage`
- **AND** nenhuma operação assíncrona bloqueia a escrita

#### Scenario: visibilitychange para hidden grava draft

- **WHEN** o usuário alterna o app (mobile) e `visibilitychange` dispara com `document.visibilityState === 'hidden'`
- **THEN** o draft é gravado de forma síncrona no `localStorage`

#### Scenario: PATCH no unload é best-effort

- **WHEN** já existe `storeId` no abandono
- **THEN** um PATCH fire-and-forget é disparado
- **AND** a escrita síncrona do draft não depende do sucesso do PATCH

### Requirement: Restauração do draft ao abrir /loja

O sistema SHALL, ao montar o onboarding em `/loja`, restaurar o draft do `localStorage` se dentro do TTL (D5):

- Se não existe `storeId` salvo: restaura o draft da chave `:new`
- Se já existe `storeId`: restaura o draft da chave `:${storeId}` e reconcilia com o que o banco tem (dados do banco prevalecem para campos já persistidos; edições locais do draft preenchem o que falta)
- Após o primeiro save que cria a loja: o draft é **lido uma vez, escrito no form e a chave é limpa** (migração atômica — D5)

#### Scenario: Restaura draft :new em loja nova

- **WHEN** o usuário abre `/loja` sem loja criada
- **AND** existe um draft válido na chave `:new`
- **THEN** o formulário é pré-preenchido com os campos do draft

#### Scenario: Restaura draft e reconcilia com o banco

- **WHEN** o usuário abre `/loja` com `storeId` existente
- **AND** existe um draft válido na chave `:${storeId}`
- **THEN** o formulário é pré-preenchido com a reconciliação do draft e dos dados do banco

#### Scenario: Primeiro save migra e limpa o draft

- **WHEN** o primeiro save cria a loja
- **THEN** o draft é lido uma vez e escrito no formulário
- **AND** a chave de draft é removida do `localStorage`

### Requirement: Limpeza do draft no logout e após primeiro save

O sistema SHALL limpar a chave de draft no `localStorage`:
- **Após o primeiro save que cria a loja** (D4/D5) — a chave `:new` é removida
- **No logout** — a chave é removida (escopo de usuário; draft nunca cruza contas)

#### Scenario: Logout limpa a chave de draft

- **WHEN** o usuário faz logout
- **THEN** `clearDraft(userId)` remove a chave de draft do `localStorage`

#### Scenario: Primeiro save remove a chave :new

- **WHEN** o primeiro save cria a loja e gera `storeId`
- **THEN** a chave `vendeo:store_draft:${userId}:new` é removida
