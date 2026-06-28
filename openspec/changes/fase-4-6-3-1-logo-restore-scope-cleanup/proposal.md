## Why

O fluxo de restore de logotipo (histórico, modal, reativação de assets arquivados) foi concebido quando o lifecycle de logo ainda permitia restaurar versões anteriores. Decidiu-se simplificar: **excluir = irreversível**. Se o lojista quiser o mesmo logo, re-envia o arquivo — nova análise, nova direção visual. O código de restore se tornou obsoleto, e parte dele (o endpoint de restore) está quebrado — rejeita o estado `logo` que a loja assume após um upload com falha de análise. Esta fase remove todo o código morto de restore e substitui o retry do BrandDirector por um endpoint dedicado.

## What Changes

- **BREAKING**: Remove `POST /api/store/[id]/logo/restore` (313 linhas) — endpoint de restore de logo
- **BREAKING**: Remove `GET /api/store/[id]/logo/history` (92 linhas) — histórico de logos arquivados
- **BREAKING**: Remove `GET /api/store/[id]/logo/versions` (31 linhas) — sem caller, dead code
- **BREAKING**: Remove `LogoRestoreModal` component (211 linhas) — já inalcançável na UI
- **BREAKING**: Remove `openspec/specs/logo-restore/spec.md` — spec canônica do comportamento removido
- **BREAKING**: Remove `handleGenerate` + rota `POST /generate` em `brand-profile/route.ts` — duplicava o retry com comportamento inferior
- Remove types `LogoHistoryItem`, `LogoRestoreRequest`, `LogoRestoreResponse`, `DriftStatus` (brand-assets types)
- Remove state morto `archivedCount`, `archivedCountLoading`, `fetchArchivedCount` no formulário
- **NEW**: Cria `POST /api/store/[id]/logo/retry-brand-director` — endpoint dedicado para re-executar BrandDirector no asset ativo quando a análise inicial falha
- Remove `failedLogoAssetId` do state do formulário (não mais necessário — servidor resolve o asset sozinho)

## Capabilities

### New Capabilities

- `logo-retry`: Endpoint técnico que re-executa a análise do BrandDirector no logo ativo quando a análise inicial falha. Substitui o uso indevido do endpoint de restore como retry.

### Modified Capabilities

- `logo-upload`: Remover `/logo/versions` do contrato. Documentar o endpoint de retry técnico como parte do lifecycle de logo.
- `store-identity-ui`: Remover modal de restore, link "Logotipos anteriores", chamada de restore no frontend. Ajustar estado pós-remoção (sem indicação de logos arquivados).
- `store-identity-state`: Remover cenários de restore de logo. Preservar restore de Visual Signature.
- `identity-state-transitions`: Substituir "preservado para future restore" por "preservado como fallback de direção visual".
- `store-brand-profile`: Remover especificação postergada de `/brand-profile/generate` — substituída pelo retry específico de logo.

## Impact

- **Código removido**: ~650 linhas de código morto (endpoints, componente, types) + 240 linhas de spec canônica
- **Código novo**: ~100 linhas para o endpoint de retry
- **Endpoints removidos**: 3 (restore, history, versions)
- **Endpoints criados**: 1 (retry-brand-director)
- **Componentes removidos**: 1 (LogoRestoreModal)
- **Specs removidas**: 1 (logo-restore)
- **Specs modificadas**: 5 (logo-upload, store-identity-ui, store-identity-state, identity-state-transitions, store-brand-profile)
- **Nenhuma migration** necessária
- **Nenhuma alteração** em storage, prompts de IA, ou fluxo de upload/delete
