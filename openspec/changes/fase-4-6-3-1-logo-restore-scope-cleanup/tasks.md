## 1. Novo Endpoint de Retry

- [ ] 1.1 Criar `src/app/api/store/[id]/logo/retry-brand-director/route.ts` com validação de estado `logo`, asset original ativo, e perfil failed
- [ ] 1.2 Implementar sequência compensável com fallback opcional: se fallback existe → marca outdated, insere novo synced, preserva brand_colors_chosen; se não existe → insere novo synced com brand_colors_chosen = [], sem compensação
- [ ] 1.3 Usar `buildStoreProfileInputSnapshot(store)` para o snapshot e o mesmo `storeData` do upload (incluindo `userPrimaryColor`, `userAccentColor`)

## 2. Frontend — Retry

- [ ] 2.1 Refatorar `handleRetryBrandDirector` em `store-identity-form.tsx` para chamar `POST /logo/retry-brand-director` sem body
- [ ] 2.2 Remover `failedLogoAssetId` do state do formulário

## 3. Remover Endpoints de Restore

- [ ] 3.1 Remover `src/app/api/store/[id]/logo/restore/route.ts`
- [ ] 3.2 Remover `src/app/api/store/[id]/logo/history/route.ts`
- [ ] 3.3 Remover `src/app/api/store/[id]/logo/versions/route.ts`

## 4. Remover Componente Morto

- [ ] 4.1 Remover `src/components/flow/logo-restore-modal.tsx`

## 5. Remover Types e State Mortos

- [ ] 5.1 Remover `LogoHistoryItem`, `LogoRestoreRequest`, `LogoRestoreResponse`, `DriftStatus` de `src/lib/brand-assets/types.ts`
- [ ] 5.2 Remover state `archivedCount`, `archivedCountLoading`, função `fetchArchivedCount`, e `useEffect` associado em `store-identity-form.tsx`

## 6. Remover handleGenerate

- [ ] 6.1 Remover função `handleGenerate` e dispatch `path.endsWith('/generate')` em `brand-profile/route.ts`

## 7. Testes Automatizados

- [ ] 7.1 Criar teste parametrizado: sucesso (com fallback + sem fallback) — fluxo completo, verifica novo synced e preservação de brand_colors_chosen
- [ ] 7.2 Criar teste parametrizado: falha do BrandDirector — verifica que nenhum profile foi alterado (fallback permanece synced, failed permanece failed, asset ativo)
- [ ] 7.3 Criar teste em tabela: validações inválidas (asset não ativo, estado não-logo, perfil não-failed) — cada caso retorna HTTP 400/409
- [ ] 7.4 Criar teste: falha de persistência com fallback — verifica restauração de outdated → synced

## 8. Specs e Build

- [ ] 8.1 Remover `openspec/specs/logo-restore/spec.md`
- [ ] 8.2 Atualizar `openspec/specs/logo-upload/spec.md`: remover `/logo/versions`, documentar retry
- [ ] 8.3 Atualizar `openspec/specs/store-identity-ui/spec.md`: remover modal, link, restore button, ajustar matriz de decisão
- [ ] 8.4 Atualizar `openspec/specs/store-identity-state/spec.md`: remover cenários de restore de logo
- [ ] 8.5 Atualizar `openspec/specs/identity-state-transitions/spec.md`: "future restore" → "fallback de direção visual"
- [ ] 8.6 Atualizar `openspec/specs/store-brand-profile/spec.md`: remover `/brand-profile/generate` postergado

## 9. Verificação

- [ ] 9.1 Rodar `rg` em `src/` e `openspec/specs/` para confirmar que não restam referências a `/logo/restore`, `/logo/history`, `/logo/versions`, `LogoRestoreRequest`, `LogoRestoreResponse`, `LogoHistoryItem`, `logo-restore-modal`, `LogoRestoreModal`
- [ ] 9.2 `npm run typecheck` passa sem erros
- [ ] 9.3 `npm run lint` passa sem erros
- [ ] 9.4 `npm test` passa (todos os testes, incluindo os novos)
- [ ] 9.5 `npm run build` passa
- [ ] 9.6 Teste manual: upload → BrandDirector falha → retry → análise bem-sucedida
- [ ] 9.7 Teste manual: upload → remover → sem opção de restaurar
- [ ] 9.8 Teste manual: upload → remover → re-upload → novo asset independente
