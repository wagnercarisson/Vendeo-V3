# Summary: Persistir CNPJ/fiscal no autoSave antes de trocar aba / navegar / gerar campanha

- **Quick:** 260806-fsl
- **Type:** fix
- **Branch:** `feature/fase-36-onboarding-navegacao-por-abas` (push é responsabilidade do usuário)
- **Status:** Implementado + testes focados verdes + specs/planning atualizados. Verificação completa (typecheck pós-testes, suíte completa, lint) em andamento.

## Causa raiz

O `autoSave` excluía os campos fiscais (`cnpj/razaoSocial/nomeFantasia`) do payload, e TODOS os caminhos de saída do contexto (troca de aba, link interno, gerar campanha) passam pelo `autoSave`. Só o `save()` explícito roteava para `POST /api/store/update-cnpj`. Consequência: loja draft que preenche CNPJ válido na aba Dados não via o fiscal persistir até clicar em "Salvar e continuar"; o readiness (`check_store_readiness`) continuava `cadastro_fiscal` pendente e o gate de `/campanhas/nova` bloqueava.

## O que foi feito

### Task 1 — autoSave fiscal + readiness/banner (implementado)

**`src/components/flow/use-store-form.ts`**
- Tipo de retorno do `autoSave` estendido com `fiscalPersisted?: boolean`.
- Ramo fiscal no corpo do `autoSave`:
  - Dispara `POST /api/store/update-cnpj` somente quando: `storeId` existe, `!hasExistingCnpj`, CNPJ normalizado com 14 dígitos, `validateCnpj` não retorna `Error`, razão social `trim().length >= 2`.
  - Payload: `{ storeId, cnpjNormalized, razaoSocial, nomeFantasia: nomeFantasia || razaoSocial }`.
  - Sucesso → `setHasExistingCnpj(true)`, `setSaveStatus("saved")`, retorna `{ ok: true, fiscalPersisted: true, storeId }`.
  - Falha (400/409/503) → `setError(msg)`, `setSaveStatus("error")`, retorna `{ ok: false }` (não finge sucesso fiscal; navegação prossegue pois storeId existe).
  - Loja com CNPJ (`hasExistingCnpj`) → PATCH inclui `razaoSocial`/`nomeFantasia` (paridade com `save()`); update-cnpj NÃO é chamado.
  - CNPJ inválido/incompleto ou sem razão social → update-cnpj NÃO é chamado.
- Deps do `useCallback` atualizadas (`[formData, acceptedTerms, updateStoreId, hasExistingCnpj]`).

**`src/components/flow/store-identity-form.tsx`**
- Novo `autoSaveWithFiscalReadiness`: chama `autoSave`, e se `fiscalPersisted` incrementa `readinessRefreshKey` (refetch do readiness).
- Passado ao `useOnboardingTabs` no lugar do `autoSave`.
- Banner "Fiscal pendente": condição trocada de `fiscalPending && !initialStore?.cnpj_normalized` para `readiness.missing.some(m => m.item === "cadastro_fiscal")`; prop `fiscalPending` removida da assinatura.

**`src/components/flow/store-page-client.tsx`**
- Parsing do `fiscal` searchParam e repasse de `fiscalPending` removidos (banner agora derivado do readiness vivo).

### Task 2 — Testes (implementados e verdes)

- **Novo** `src/components/flow/__tests__/use-store-form.autosave-fiscal.test.ts` (11 cenários):
  - CNPJ válido + loja sem CNPJ → update-cnpj com payload correto + `fiscalPersisted: true`.
  - `nomeFantasia` vazio → fallback para `razaoSocial` no payload.
  - CNPJ inválido (check digits) → update-cnpj NÃO chamado.
  - CNPJ incompleto (< 14 dígitos) → update-cnpj NÃO chamado.
  - CNPJ válido sem razão social → update-cnpj NÃO chamado.
  - 409/400/503 → `{ ok: false }` + `setError` + `saveStatus: "error"`, sem `fiscalPersisted`.
  - Loja com CNPJ → PATCH inclui `razaoSocial`/`nomeFantasia`; update-cnpj NÃO chamado.
  - Após `fiscalPersisted`, navegação seguinte usa PATCH (não repete update-cnpj).
  - Sem `storeId` + mínimo válido → POST `/api/store` draft sem CNPJ.
- **`src/hooks/__tests__/use-onboarding-tabs.test.ts`** — novo describe "persistência fiscal ANTES da navegação": troca de aba aguarda autoSave resolver; navegação interna só troca `window.location.href` após autoSave resolver (mock de `location` por objeto).
- **`src/components/flow/__tests__/store-page-client.test.tsx`** — `fiscalPending` agora undefined (param removido).

### Task 3 — Specs + planning (concluído)

- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-onboarding-autosave/spec.md`:
  - Requirement novo: **"autoSave persiste cadastro fiscal (draft → fiscal) antes de navegação"** com regras de disparo, semântica de falha (ok:false / não finge sucesso / readiness permanece pendente) e 7 cenários (troca de aba, navegação interna/gerar campanha, inválido, sem razão social, falha do update-cnpj, loja com CNPJ, segunda chamada não repete).
  - Requirement `autoSave`: retorno estendido com `fiscalPersisted` + nota de drift (implementação tem lógica própria; não reutiliza literalmente `save()`).
  - Cenário "Campos fora do snapshot": expandido para refletir o ramo fiscal real.
- `openspec/changes/fase-36-onboarding-navegacao-por-abas/specs/store-identity-ui/spec.md`:
  - Cenários novos: "Banner 'Fiscal pendente' é derivado do readiness vivo" e "Readiness refeito quando o autoSave persiste o fiscal".

## Verificação

```bash
cd C:\Projetos\Vendeo V3
npx tsc -p tsconfig.typecheck.json --noEmit          # limpo (pré-testes)
npx vitest run src/components/flow/__tests__/use-store-form.autosave-fiscal.test.ts src/hooks/__tests__/use-onboarding-tabs.test.ts src/components/flow/__tests__/store-page-client.test.tsx  # verde
```

Pendente (próximo passo):
- Re-rodar `npx tsc -p tsconfig.typecheck.json --noEmit` (os arquivos de teste foram criados depois da última rodada).
- Suíte completa `npx vitest run` (drift-tabs, store-creation-matrix e demais).
- `npm run lint`.

## Success Criteria (status)

- [x] CNPJ válido persiste ANTES de trocar de aba / navegar / gerar campanha (sem "Salvar e continuar")
- [x] CNPJ inválido/incompleto não vira fiscal válido (readiness `cadastro_fiscal` pendente; campanha bloqueada)
- [x] Falha do update-cnpj → `{ ok: false }` + erro visível; navegação prossegue quando storeId existe
- [x] Loja com CNPJ usa PATCH para razao/nome fantasia (sem update-cnpj)
- [x] Banner fiscal reflete readiness, não initialStore stale
- [x] Readiness refetched quando fiscal persiste via autoSave
- [ ] Suíte completa verde + lint + typecheck (em andamento)
