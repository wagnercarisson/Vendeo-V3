# Alinhamento Fase 4.6.3.1 — Logo Restore Scope Cleanup

## Nomenclatura das Fases 4.6

```
4.6  — Store Form Adjusts                    (fase mãe)
 ├── 4.6.1 — Text Only Coverage              (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection
 │    └── 4.6.2.1 — Snapshot Fields Realignment  (concluída)
 ├── 4.6.3 — Logo State Lifecycle            (concluída)
 │    └── 4.6.3.1 — Logo Restore Scope Cleanup  ← esta micro-fase
 ├── 4.6.4 — Visual Signature fluxo          (concluída)
 ├── 4.6.5 — VS Color Drift & Profile Fix    (concluída)
 ├── 4.6.6 — Identity Transition             (pendente)
 └── 4.6.7 — Visual Signature Retry          (pendente)
```

---

## Propósito

Eliminar todo o código relacionado a **restore de logotipo** (endpoints, componente, types, state morto) que se tornou obsoleto após a decisão de simplificar o lifecycle: **excluir = irreversível**. Se o lojista quiser o mesmo logo de volta, precisa re-enviar o arquivo — nova análise, nova direção visual.

**O que NÃO é:**
- Remoção do Visual Signature restore (fica para fase futura)
- Remoção do bucket `store-logos` ou coluna `logo_url` (mantidos para evitar migration)
- Alteração no fluxo de upload, delete, ou BrandDirector
- Alteração nos rollbacks técnicos de compensação (ex: logo/route.ts linha 327)

---

## Inventário de Remoção

```
ARQUIVOS PARA DELETAR
═══════════════════════════════════════════════════

  src/app/api/store/[id]/logo/restore/route.ts      313 linhas
  src/app/api/store/[id]/logo/history/route.ts       92 linhas
  src/app/api/store/[id]/logo/versions/route.ts      31 linhas
  src/components/flow/logo-restore-modal.tsx         211 linhas
  openspec/specs/logo-restore/spec.md               240 linhas

PARA REMOVER DENTRO DE ARQUIVO MANTIDO
════════════════════════════════════════════════════

  brand-profile/route.ts: handleGenerate + rota POST /generate
    └── Função que duplica o novo retry com comportamento inferior:
        sem preservação de brand_colors_chosen,
        sem metadata.input_snapshot,
        brand_colors_chosen = logo_colors_detected (incorreto)
    └── O roteamento via path.endsWith('/generate') deve ser
        removido junto com a função
                                                     ─────────
                                                     887+ linhas

TYPES PARA REMOVER (src/lib/brand-assets/types.ts)
═══════════════════════════════════════════════════

  LogoHistoryItem        ─── só usado por history/route (vai ser deletado)
  LogoRestoreRequest     ─── só usado por restore/route (vai ser deletado)
  LogoRestoreResponse    ─── só usado por restore/route (vai ser deletado)

  ⚠️ DriftStatus (brand-assets/types.ts:157):
     Usado APENAS em LogoHistoryItem.drift_status.
     Como LogoHistoryItem será removido, DriftStatus também vai junto.
     NÃO confundir com DriftStatus em lib/drift.ts (DriftStatus = 'none'|'new'|'dismissed') — é OUTRA, não remover.

STATE MORTO NO FORMULÁRIO (src/components/flow/store-identity-form.tsx)
═══════════════════════════════════════════════════

  archivedCount (linha 92)          ─── setado, NUNCA lido
  archivedCountLoading (linha 93)   ─── setado, NUNCA lido
  fetchArchivedCount()              ─── chama GET /logo/history (deletado)

SPECS CANÔNICAS PARA ATUALIZAR
═══════════════════════════════════════════════════

  openspec/specs/logo-upload/spec.md
    └── linha 375: remover /logo/versions, documentar retry técnico

  openspec/specs/store-identity-ui/spec.md
    └── linha 1374: remover modal restore, histórico, link "Logotipos anteriores",
                     chamada de restore. Ajustar estado pós-remoção.

  openspec/specs/store-identity-state/spec.md
    └── linha 177: remover apenas cenários de restore de logo
                    (preservar restore de Visual Signature)

  openspec/specs/identity-state-transitions/spec.md
    └── linha 95: substituir "preservado para future restore"
                   por "preservado como fallback de direção visual"

  openspec/specs/store-brand-profile/spec.md
    └── linha 457: remover especificação postergada de
                    /brand-profile/generate — substituída pelo
                    retry específico de logo
```

---

## Novo Endpoint — POST /api/store/[id]/logo/retry-brand-director

### Contrato

```
POST /api/store/[id]/logo/retry-brand-director
Body: (vazio — servidor resolve o asset original ativo)
Response 200: { profile: BrandProfileRecord, success: true }
Response 200: { success: false, error: string, retry: true }  (BrandDirector falhou)
Response 400: { error: string }                      (validação)
Response 409: { error: string }                      (estado inválido)
```

### O que o endpoint NÃO faz

| Operação | Motivo |
|----------|--------|
| ❌ Receber `asset_id` | Servidor resolve o único original ativo. Elimina input manipulável e impede retry em logo arquivado |
| ❌ Alterar `store_brand_assets.status` | Asset já está active — retry não mexe em assets |
| ❌ Alterar `identity_state` ou `logo_status` | Loja já está em logo — retry só reexecuta análise |
| ❌ Executar drift detection | Retry faz análise NOVA com dados atuais da loja — drift não se aplica |
| ❌ Reativar variantes | Variantes continuam active |
| ❌ Criar novo profile `failed` a cada tentativa | O failed original permanece como registro da primeira tentativa |
| ❌ Rejeitar loja em `identity_state = 'logo'` | (como o restore atual faz na linha 79 — bug que o retry atual sofre) |

### Fluxo

```
FRONTEND (handleRetryBrandDirector):
─────────────────────────────────────
  setBrandDirectorRetrying(true)
  → POST /logo/retry-brand-director  (sem body)
  ├── 200 { profile, success: true }
  │     → limpa brandDirectorWarning
  │     → carrega profile atualizado (cores, estilo)
  └── 200 { success: false, error, retry: true }
        → mantém brandDirectorWarning com erro
  ┌── erro de rede
        → brandDirectorWarning = "Erro de conexão"


SERVIDOR:
─────────────────────────────────────
  1. Valida store.identity_state === 'logo'
     └── 409 se não estiver em logo

  2. Busca asset original ativo da loja:
     store_brand_assets
       .eq('store_id', storeId)
       .eq('variant_type', 'original')
       .eq('status', 'active')
       .single()
     └── 400 se não encontrar (sem logo ativo)

  3. Busca o perfil mais recente da loja e valida que é failed:
     store_brand_profiles
       .eq('store_id', storeId)
       .order('created_at', { ascending: false })
       .limit(1)
       .maybeSingle()
     └── 400 se não encontrar perfil algum
     └── Valida: status === 'failed'
                  AND source === 'logo_analysis'
                  AND active_logo_asset_id === asset.id
     └── 400 se não passar na validação — evita retry após sucesso
         ou retry em perfil que não pertence a este asset

  4. Busca perfil synced atual (fallback de direção):
     store_brand_profiles
       .eq('store_id', storeId)
       .eq('status', 'synced')
       .maybeSingle()
     └── Extrai brand_colors_chosen para preservar

  5. Download do buffer do storage:
     supabase.storage.from('store-brand-assets').download(asset.storage_path)

  6. Executa BrandDirector.analyze() com storeData usando o mesmo
     mapeamento do upload (logo/route.ts linhas 252-266):
       storeName, segment, subsegment, city, state,
       tone_of_voice, positioning, short_description, slogan,
       userPrimaryColor: store.brand_color,
       userAccentColor: resolvido do synced fallback
         (brand_colors_chosen[1] → safe_color_tokens.accent
          → inferred_accent_color → null)

    ├── SUCESSO:
    │   ┌─────────────────────────────────────────────────────┐
    │   │  Sequência compensável:                             │
    │   │                                                     │
    │   │  a. brand_colors_chosen = fallbackSynced             │
    │   │     .brand_colors_chosen (preservado)                │
    │   │                                                     │
    │   │  b. Marca fallback synced → 'outdated'              │
    │   │     (libera o índice único para novo synced)        │
    │   │                                                     │
    │   │  c. Insere novo profile synced com TODOS os         │
    │   │     campos retornados pelo BrandDirector:           │
    │   │       source: 'logo_analysis'                       │
    │   │       active_logo_asset_id: asset.id                │
    │   │       logo_colors_detected                          │
    │   │       brand_colors_chosen: [passo a]               │
    │   │       safe_color_tokens                             │
    │   │       visual_style, visual_tone                     │
    │   │       typography_direction                          │
    │   │       brand_personality                             │
    │   │       campaign_guidelines, campaign_brief           │
    │   │       confidence_score                              │
    │   │       inferred_primary_color, inferred_accent_color │
    │   │       status: 'synced'                              │
    │   │       metadata.input_snapshot: store atual          │
    │   │         (7 campos via buildStoreProfileInputSnapshot)│
    │   │                                                     │
    │   │  d. Se inserção falhar → COMPENSAÇÃO:               │
    │   │     restaura fallback para 'synced'                 │
    │   │     retorna erro                                    │
    │   │                                                     │
    │   │  e. Retorna profile criado para UI                  │
    │   └─────────────────────────────────────────────────────┘
    │
    └── FALHA (BrandDirectorAnalysisError ou outro erro):
        └── Tudo permanece como está:
            ├── fallback synced continua synced
            ├── profile failed original permanece failed
            ├── asset continua active
            └── Retorna { success: false, error, retry: true }
```

### Por que `failed` permanece `failed`

O profile `failed` gerado no upload (logo/route.ts linhas 388-407) é o **registro da tentativa original**. Transformá-lo em `outdated` misturaria dois significados de estado:

| Status | Significado |
|--------|-------------|
| `synced` | Perfil ativo sendo usado como direção visual |
| `outdated` | Perfil que foi substituído por um novo synced |
| `failed` | Tentativa de análise que não produziu direção válida |

O retry bem-sucedido cria um NOVO perfil `synced`. O `failed` original permanece como auditoria. O antigo `synced` (fallback) vira `outdated` porque foi substituído.

### Restore endpoint vs retry endpoint

| Característica | `/logo/restore` (vai ser deletado) | `/logo/retry-brand-director` (novo) |
|---|---|---|
| Aceita `asset_id` | ✅ Sim | ❌ Não — resolve do active |
| Drift detection | ✅ Sim | ❌ Não |
| Reativa assets archived | ✅ Sim | ❌ Não |
| Arquiva assets ativos | ✅ Sim | ❌ Não |
| Transiciona identity_state | ✅ Sim | ❌ Não |
| Rejeita loja em `logo` | ✅ Sim (bug) | ❌ Não — valida que está em `logo` |
| Re-executa BrandDirector | ✅ Sim | ✅ Sim |
| Preserva `brand_colors_chosen` | ❌ Não | ✅ Sim |
| Cria novo profile failed no erro | ❌ Sim | ❌ Não |

---

## Diagrama de Dependências

```
ANTES DA LIMPEZA:
═════════════════

  store-identity-form.tsx
    ├── handleRemoveLogo
    │     └── DELETE /logo                         ← VIVO (mantido)
    ├── handleRetryBrandDirector
    │     └── POST /logo/restore     ╔══ ALVOS ══╗
    ├── fetchArchivedCount           ║            ║
    │     └── GET /logo/history      ║            ║
    └── [state] archivedCount        ║            ║
                                     ║            ║
  logo-restore-modal.tsx (dead)      ║            ║
    ├── GET /logo/history  ──────────╜            ║
    └── POST /logo/restore ───────────────────────╜
                                                  ║
  POST /logo/restore/route.ts ────────────────────╝
  GET  /logo/history/route.ts ────────────────────╝
  GET  /logo/versions/route.ts ─── (dead, sem caller)

  Types:
    LogoHistoryItem    ─── history/route
    LogoRestoreRequest ─── restore/route
    LogoRestoreResponse── restore/route
    DriftStatus (brand-assets/types.ts) ─── LogoHistoryItem


DEPOIS DA LIMPEZA:
══════════════════

  store-identity-form.tsx
    ├── handleRemoveLogo
    │     └── DELETE /logo                         ← inalterado
    └── handleRetryBrandDirector
          └── POST /logo/retry-brand-director      ← NOVO (sem body)

  POST /logo/retry-brand-director/route.ts         ← NOVO

  [Removidos]: restore, history, versions, modal,
               types mortos, state morto
```

---

## Irreversibilidade

**Definição:** "não restaurável pela aplicação/API". Após remover o logo:

- Nenhum endpoint existente ou novo reativa um logo arquivado
  (exceção: rollback técnico do DELETE /logo, que reativa assets
  quando a transição de estado falha — é compensação, não restore)
- Os arquivos e registros `archived` continuam no storage e no banco (sem migration)
- Rollbacks técnicos de compensação (ex: logo/route.ts:327, que restaura perfil anterior durante erro de transação) **não** são afetados — são mecanismos de consistência, não de restore de logo
- Se o lojista quiser o mesmo logo de volta: re-upload → novo asset, nova versão, nova análise independente

---

## Fora de Escopo

| Item | Motivo |
|------|--------|
| Visual Signature restore (`POST /visual-signature/restore`) | Sistema separado, escopo futuro |
| Bucket `store-logos` (migration `20260601000004`) | Evitar migration. Pode ser limpo futuramente |
| Coluna `logo_url` na tabela `stores` | Evitar migration. Pode ser removida futuramente |
| Ajustes no BrandDirector ou no prompt de IA | Sem relação com restore |
| Backfill de dados existentes | Remove-se código, não dados |
| Rollbacks técnicos de compensação | Mecanismos de consistência, não de restore |

---

## Critérios de Aceite

### Comportamentais

- [ ] Retry aceita somente o logo original atualmente ativo (rejeita se não houver asset original active)
- [ ] Retry rejeita loja que não esteja em `identity_state = 'logo'`
- [ ] Retry não modifica `store_brand_assets.status` de nenhum registro
- [ ] Retry não altera `identity_state` nem `logo_status` na tabela `stores`
- [ ] Retry falho mantém o perfil fallback `synced` intacto
- [ ] Retry bem-sucedido preserva `brand_colors_chosen` do perfil fallback
- [ ] Falha de persistência (ex: insert do novo synced) restaura o fallback para `synced`
- [ ] Profile `failed` original permanece `failed` (não vira outdated)
- [ ] Nenhum endpoint restante reativa logo arquivado (exceção: rollback técnico do DELETE /logo, que é compensação, não restore)
- [ ] Após remoção, re-envio cria novo asset, nova versão e nova análise independente

### Cobertura de código morto

- [ ] `rg` em `src/` e `openspec/specs/` não encontra `/logo/restore`, `/logo/history`, `/logo/versions` (excluir docs/ e .planning/)
- [ ] `rg` em `src/` e `openspec/specs/` não encontra `LogoRestoreRequest`, `LogoRestoreResponse`, `LogoHistoryItem`
- [ ] `handleGenerate` removido de `brand-profile/route.ts` — função e roteamento `/generate`
- [ ] `LogoRestoreModal` não é importado em lugar nenhum
- [ ] `archivedCount` e `archivedCountLoading` não aparecem no bundle

### Build e testes

- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run lint` passa sem erros
- [ ] `npm test` passa (testes existentes não quebram)
- [ ] `npm run build` passa
- [ ] Testes focados cobrem: retry bem-sucedido, retry falho, rejeição de asset não ativo, rejeição de estado não-logo

### Especificações

- [ ] `openspec/specs/logo-upload/spec.md`: /logo/versions removido, retry técnico documentado
- [ ] `openspec/specs/store-identity-ui/spec.md`: modal, histórico e link removidos
- [ ] `openspec/specs/store-identity-state/spec.md`: cenários de restore de logo removidos
- [ ] `openspec/specs/identity-state-transitions/spec.md`: "preservado para future restore" → "fallback de direção visual"
- [ ] `openspec/specs/store-brand-profile/spec.md`: /brand-profile/generate removido (substituído pelo retry específico de logo)

---

## Checklist de Implementação

- [ ] Criar `src/app/api/store/[id]/logo/retry-brand-director/route.ts` conforme fluxo descrito
- [ ] Refatorar `handleRetryBrandDirector` em `store-identity-form.tsx` — remover body, chamar `/logo/retry-brand-director`
- [ ] Remover `failedLogoAssetId` do state do formulário (não é mais necessário)
- [ ] Remover `src/components/flow/logo-restore-modal.tsx`
- [ ] Remover `src/app/api/store/[id]/logo/restore/route.ts`
- [ ] Remover `src/app/api/store/[id]/logo/history/route.ts`
- [ ] Remover `src/app/api/store/[id]/logo/versions/route.ts`
- [ ] Remover types `LogoHistoryItem`, `LogoRestoreRequest`, `LogoRestoreResponse`, `DriftStatus` de `src/lib/brand-assets/types.ts`
- [ ] Remover state `archivedCount`, `archivedCountLoading`, função `fetchArchivedCount`, e `useEffect` associado em `store-identity-form.tsx`
- [ ] Remover `openspec/specs/logo-restore/spec.md`
- [ ] Remover `handleGenerate` + rota `POST /generate` em `brand-profile/route.ts`
- [ ] Verificar que nenhum import quebrou (`rg` em `src/` e `openspec/specs/` por referências aos tipos/endpoints removidos)
- [ ] Atualizar 5 specs canônicas restantes (logo-upload, store-identity-ui, store-identity-state, identity-state-transitions, store-brand-profile)
- [ ] Escrever testes focados do novo endpoint
- [ ] Build TypeScript passa sem erros

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-06-27 | Remover todo o código de restore de logo. Excluir = irreversível. Re-upload gera nova análise. |
| 2026-06-27 | Retry do BrandDirector não deve usar restore. Criar endpoint dedicado sem `asset_id` — servidor resolve o original ativo. |
| 2026-06-27 | `retry-brand-director` não recebe `asset_id` (elimina input manipulável, impede retry em logo arquivado). |
| 2026-06-27 | Retry não altera assets, identity_state, logo_status, nem executa drift. Só reexecuta BrandDirector e troca o profile. |
| 2026-06-27 | Profile `failed` original permanece `failed` (registro de tentativa). Só o fallback `synced` vira `outdated`. |
| 2026-06-27 | `brand_colors_chosen` do perfil fallback é preservado no novo profile synced. |
| 2026-06-27 | Inserção do novo synced segue padrão do upload: marca fallback outdated → insere novo → se falhar, restaura fallback. |
| 2026-06-27 | Rollbacks técnicos de compensação (ex: logo/route.ts:327) não são afetados — são mecanismos de consistência, não de restore. |
| 2026-06-27 | Irreversibilidade definida como "não restaurável pela aplicação/API". Arquivos archived continuam armazenados. |
| 2026-06-27 | Visual Signature restore fica fora de escopo. Mantido para fase futura. |
| 2026-06-27 | Bucket `store-logos` e coluna `logo_url` mantidos para evitar migration. Limpeza futura. |
| 2026-06-27 | `DriftStatus` em `brand-assets/types.ts` removido junto com `LogoHistoryItem`. Distinto de `DriftStatus` em `lib/drift.ts` (mantido). |
| 2026-06-27 | `archivedCount` e `archivedCountLoading` removidos — state escrito mas nunca lido. |
| 2026-06-27 | `openspec/specs/logo-restore/spec.md` entra na lista de exclusão — spec canônica do comportamento removido. |
| 2026-06-27 | Contrato de falha do retry inclui `success: false` explícito. |
| 2026-06-27 | Existência de perfil `failed` (source='logo_analysis', status='failed', vinculado ao asset) é pré-condição do retry — não é opcional. |
| 2026-06-27 | "Transação atômica" substituído por "sequência compensável" — Supabase não tem transação real entre chamadas. |
| 2026-06-27 | `reconcileProfiles` removido do retry — redundante após marcar fallback outdated e inserir novo synced. |
| 2026-06-27 | Novo profile recebe todos os campos do BrandDirector + `metadata.input_snapshot` com dados atuais. |
| 2026-06-27 | Drift não se aplica ao retry porque é análise nova com dados atuais, não restauração de snapshot antigo. |
| 2026-06-27 | Busca de código morto restrita a `src/` e `openspec/specs/` — docs/ e .planning/ têm referências históricas. |
| 2026-06-27 | Critério "nenhum endpoint reativa logo arquivado" excetua rollback técnico do DELETE /logo (compensação, não restore). |
| 2026-06-27 | `store-brand-profile/spec.md`: decisão firme de remover `/brand-profile/generate` (postergado), substituído pelo retry específico. |
| 2026-06-27 | Busca do perfil failed corrigida: busca o perfil mais recente da loja (sem filtrar status) e valida failed + source + asset_id. Impede retry após sucesso. |
| 2026-06-27 | storeData do retry documentado com userPrimaryColor e userAccentColor — mesmo mapeamento do upload. |
| 2026-06-27 | Irreversibilidade: "nenhum endpoint reativa logo" passa a excetuar rollback técnico do DELETE /logo, consistente com os critérios de aceite. |
| 2026-06-27 | `handleGenerate` + rota `/generate` em `brand-profile/route.ts` incluídos na limpeza — duplicam o retry com comportamento inferior. |
