---
quick_id: 260806-fsl
type: fix
wave: 1
depends_on:
  - change: fase-36-onboarding-navegacao-por-abas
    provides: autoSave/useOnboardingTabs/readiness tab flow
  - change: fase-34-store-readiness
    provides: getStoreReadiness/check_store_readiness RPC
  - change: fase-32-freemium-anti-abuso-cnpj
    provides: update_store_cnpj RPC + /api/store/update-cnpj
files_modified:
  - src/components/flow/use-store-form.ts
  - src/components/flow/store-identity-form.tsx
  - openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-onboarding-autosave/spec.md
  - openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-identity-ui/spec.md
autonomous: true
---

# Fix: Persistir CNPJ/fiscal no autoSave antes de trocar aba / navegar / gerar campanha

## Objective

Loja que fez onboarding sem CNPJ e depois preenche CNPJ válido na aba Dados não vê o fiscal persistir ao trocar de aba, sair da tela ou tentar gerar campanha — só o save explícito ("Salvar e continuar") libera a geração. O `autoSave` exclui os campos fiscais do payload e TODOS os caminhos de navegação passam pelo `autoSave`.

**Purpose:** Persistir o cadastro fiscal (draft→fiscal) via `POST /api/store/update-cnpj` **antes** de qualquer navegação/troca de aba quando o CNPJ informado for válido, sem exigir o clique em "Salvar e continuar". CNPJ inválido/incompleto NÃO persiste como fiscal válido (readiness continua `cadastro_fiscal` pendente e o gate de campanha bloqueia).

**Output:**
- `autoSave` com ramo fiscal (update-cnpj) + retorno `fiscalPersisted`
- Readiness refetch no componente quando fiscal persiste via autoSave
- Banner "Fiscal pendente" chaveado por `readiness.missing` (não `initialStore` stale)
- Specs `store-onboarding-autosave` + `store-identity-ui` atualizadas
- Planning quick (PLAN + SUMMARY)

## Context

@.planning/STATE.md

### Causa raiz (cadeia confirmada)

1. `autoSave` exclui `cnpj/razaoSocial/nomeFantasia` do payload — `src/components/flow/use-store-form.ts:393-394`.
2. Toda saída de contexto usa o `autoSave`: troca de aba → `useOnboardingTabs.commitTabChange` (`src/hooks/use-onboarding-tabs.ts:232`) → `enqueueAutoSave(formData)`; link interno → `handleInternalNavigation` (`src/hooks/use-onboarding-tabs.ts:522`). O PATCH sai sem fiscal.
3. O PATCH `/api/store/[id]` tem guard de atomicidade CNPJ (`src/app/api/store/[id]/route.ts:156-173`): rejeita `razaoSocial/nomeFantasia` com 409 se a loja não tiver `cnpj_normalized` — o autoSave nem poderia incluí-los no PATCH.
4. Só `save()` (`use-store-form.ts:253-264`) roteia para `POST /api/store/update-cnpj` quando `!hasExistingCnpj && cnpj 14 dígitos` — por isso só "Salvar e continuar" resolve.
5. Gate de campanha server-side: `/app/(app)/campanhas/nova/page.tsx:20-28` → `getStoreReadiness` → RPC `check_store_readiness` (exige `cnpj_normalized`/`razao_social`/`nome_fantasia` não nulos + brand profile synced). Fiscal não persistido → `cadastro_fiscal` em `missing` → redirect `/loja?tab=dados&fiscal=pending`.
6. Readiness client-side (`store-identity-form.tsx:270-291`) só refaz fetch com `readinessRefreshKey`, incrementado apenas no save explícito.
7. Ordem já correta: `handleInternalNavigation` **aguarda** o autoSave resolver antes de `window.location.href` (`use-onboarding-tabs.ts:521-526`). Falta apenas o autoSave persistir o fiscal.

### Decisões aprovadas (usuário)

1. Falha do update-cnpj no autoSave → retornar `{ ok: false }`, exibir erro/estado "não salvo", não fingir sucesso fiscal. Onboarding pode continuar quando aplicável; campanha permanece bloqueada pelo readiness.
2. Loja que já tem CNPJ → incluir `razaoSocial/nomeFantasia` no PATCH (paridade com `save()`); NÃO chamar update-cnpj.
3. Banner fiscal → depender de `readiness.missing` com `cadastro_fiscal`, não de `initialStore` stale.

### Regras de disparo do POST update-cnpj

- `storeId` existente
- Loja ainda sem CNPJ (`!hasExistingCnpj`)
- CNPJ normalizado com 14 dígitos E `validateCnpj` passa
- Razão social mínima válida (`trim().length >= 2`)

## Tasks

### Task 1: autoSave fiscal (use-store-form.ts) + readiness/banner (store-identity-form.tsx)

<task type="auto">
  <name>Ramo fiscal no autoSave + refetch readiness + banner por readiness</name>
  <files>
    - Edit: src/components/flow/use-store-form.ts
    - Edit: src/components/flow/store-identity-form.tsx
  </files>
  <action>
    **use-store-form.ts**
    - Atualizar o tipo de retorno de `autoSave` (interface `UseStoreFormReturn` e a assinatura): adicionar `fiscalPersisted?: boolean`.
    - No corpo do `autoSave` (após montar o `body` não-fiscal):
      - Quando `currentStoreId` existe E `!hasExistingCnpj` E `cnpjDigits = merged.cnpj.replace(/\D/g, "")` tem `length === 14` E `!(validateCnpj(cnpjDigits) instanceof Error)` E `merged.razaoSocial.trim().length >= 2`:
        - Disparar `POST /api/store/update-cnpj` com `{ storeId, cnpjNormalized: cnpjDigits, razaoSocial: merged.razaoSocial, nomeFantasia: merged.nomeFantasia || merged.razaoSocial }`.
        - Sucesso (`res.ok`) → `setHasExistingCnpj(true)`, `setSaveStatus("saved")`, retornar `{ ok: true, fiscalPersisted: true, storeId }`.
        - Falha → `setError(msg)` (ler `{ error }` do corpo; fallback genérico), `setSaveStatus("error")`, retornar `{ ok: false }` (não fingir sucesso fiscal; navegação prossegue pois storeId existe — semântica igual à falha de PATCH).
      - Quando `currentStoreId` existe E `hasExistingCnpj` → incluir no `body` do PATCH `razaoSocial` (se `merged.razaoSocial`) e `nomeFantasia` (`merged.nomeFantasia || merged.razaoSocial`, se presente) — paridade com `save()` (`use-store-form.ts:267-269`). O guard 409 do PATCH só dispara para loja SEM CNPJ.
      - CNPJ inválido/incompleto ou sem razão social → NÃO chamar update-cnpj (fica draft; readiness bloqueia campanha).
    - Ordem: o PATCH não-fiscal e o update-cnpj podem rodar no mesmo `autoSave`. Manter a serialização da fila do hook intacta (não muda contrato do useOnboardingTabs).
    - Atualizar o comentário de `autoSave` (L393-394) para refletir o ramo fiscal.

    **store-identity-form.tsx**
    - Criar `const autoSaveWithFiscalReadiness = useCallback(async (fields) => { const r = await autoSave(fields); if (r.fiscalPersisted) setReadinessRefreshKey(k => k + 1); return r; }, [autoSave])` e passar ESTE para `useOnboardingTabs` (substituir `autoSave` em `deps` L381).
    - Banner "Fiscal pendente" (L1404): trocar `{fiscalPending && !initialStore?.cnpj_normalized && (` por condição baseada em readiness: `{readiness.missing.some((m) => m.item === "cadastro_fiscal") && (`.
  </action>
  <verify>
    <automated>cd C:\Projetos\Vendeo V3 && npx tsc -p tsconfig.typecheck.json --noEmit 2>&1</automated>
  </verify>
  <done>
    autoSave persiste fiscal via update-cnpj com todas as regras de disparo; retorna fiscalPersisted; PATCH inclui razao/nome quando loja tem CNPJ; componente refaz readiness quando fiscalPersisted; banner usa readiness.missing.
  </done>
</task>

### Task 2: Testes

<task type="auto">
  <name>Testes do ramo fiscal do autoSave + readiness/banner</name>
  <files>
    - Create: src/components/flow/__tests__/use-store-form.autosave-fiscal.test.ts
    - Edit: src/components/flow/__tests__/use-onboarding-tabs.autosave-fiscal-order.test.ts (ou adicionar cenários ao use-onboarding-tabs.test.ts)
  </files>
  <action>
    Testar `useStoreForm.autoSave` via `renderHook` + `vi.stubGlobal("fetch", ...)` (padrão `use-onboarding-tabs.test.ts:250`):
    - CNPJ válido + storeId + loja sem CNPJ → `POST /api/store/update-cnpj` chamado com payload correto; retorno `{ ok: true, fiscalPersisted: true }`.
    - CNPJ inválido (check digits errados) → update-cnpj NÃO chamado; PATCH só.
    - CNPJ sem razão social → update-cnpj NÃO chamado.
    - 409/400/503 no update-cnpj → retorna `{ ok: false }`, `error` setado, `fiscalPersisted` ausente, readiness continua fiscal pendente (não marca sucesso).
    - Loja com CNPJ (`initialStore.cnpj_normalized` setado) → PATCH inclui `razaoSocial/nomeFantasia`; update-cnpj NÃO chamado.
    - Ordem: troca de aba / navegação interna chamam autoSave e o update-cnpj resolve ANTES da mudança de aba / redirect (cenário no nível do useOnboardingTabs com autoSave real ou spy que registra ordem).
  </action>
  <verify>
    <automated>cd C:\Projetos\Vendeo V3 && npx vitest run src/components/flow/__tests__/use-store-form.autosave-fiscal.test.ts src/hooks/__tests__/use-onboarding-tabs.test.ts 2>&1</automated>
  </verify>
  <done>
    Testes cobrem todos os cenários do checklist do usuário + regressões drift sensível/crítico verdes.
  </done>
</task>

### Task 3: Specs + planning

<task type="auto">
  <name>Atualizar specs F36 (store-onboarding-autosave + store-identity-ui) e planning quick</name>
  <files>
    - Edit: openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-onboarding-autosave/spec.md
    - Edit: openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-identity-ui/spec.md
  </files>
  <action>
    - `store-onboarding-autosave/spec.md`: ADICIONAR requirement "autoSave persiste cadastro fiscal (draft→fiscal) antes de navegação" com: regras de disparo (storeId + loja sem CNPJ + CNPJ válido 14 dígitos + razão social mínima), rota `POST /api/store/update-cnpj`, semântica de falha (ok:false, não finge sucesso, readiness continua pendente, campanha bloqueada), PATCH com razao/nome quando loja já tem CNPJ, e cenários correspondentes. Corrigir/expandir o cenário "Campos fora do snapshot" (L230-234) para refletir o ramo fiscal real. Nota de drift pré-existente: spec L5 dizia "reutilizando o save() existente" — implementação tem lógica própria (autoSave não reusa save()).
    - `store-identity-ui/spec.md`: se existir conteúdo de readiness/banner, ADICIONAR cenário de refetch de readiness quando fiscal persiste via autoSave e banner "Fiscal pendente" chaveado por readiness.missing (não initialStore).
  </action>
  <verify>
    <automated>Manual: conferir que os cenários adicionados citam as regras de disparo e a semântica de falha.</automated>
  </verify>
  <done>
    Specs refletem o ramo fiscal do autoSave, refetch de readiness e banner por readiness.
  </done>
</task>

## Verification

```bash
cd C:\Projetos\Vendeo V3
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run src/components/flow/__tests__/use-store-form.autosave-fiscal.test.ts src/hooks/__tests__/use-onboarding-tabs.test.ts
npm run lint
```

## Success Criteria

- CNPJ válido persiste ANTES de trocar de aba / navegar / gerar campanha (sem "Salvar e continuar")
- CNPJ inválido/incompleto não vira fiscal válido (readiness `cadastro_fiscal` pendente; campanha bloqueada)
- Falha do update-cnpj → `{ ok: false }` + erro visível; navegação prossegue quando storeId existe
- Loja com CNPJ usa PATCH para razao/nome fantasia (sem update-cnpj)
- Banner fiscal reflete readiness, não initialStore stale
- Readiness refetched quando fiscal persiste via autoSave
- Suíte completa verde + lint + typecheck
