## Context

A fase 4.6.3 (Logo State Lifecycle) implementou upload, remoção e restore de logotipo. Posteriormente, decidiu-se simplificar o lifecycle: **excluir = irreversível**. O restore de logo — endpoints, componente, types, spec canônica — tornou-se obsoleto.

O código de restore nunca foi removido, e o endpoint de restore contém um bug que o torna inoperante como retry: rejeita requisições quando `identity_state === 'logo'` (linha 79 do restore route), que é exatamente o estado da loja após um upload com falha de análise do BrandDirector.

O `handleGenerate` em `brand-profile/route.ts` duplica parcialmente o comportamento de retry, mas com qualidade inferior — não preserva `brand_colors_chosen` nem popula `metadata.input_snapshot`.

## Goals / Non-Goals

**Goals:**
- Remover todo o código de restore de logo (endpoints, componente, types, spec)
- Substituir o retry do BrandDirector por endpoint dedicado, sem os efeitos colaterais do restore
- Remover `handleGenerate` + rota `/generate` em `brand-profile/route.ts`
- Remover state morto no formulário (`archivedCount`, `failedLogoAssetId`)
- Atualizar 5 specs canônicas para refletir a nova realidade

**Non-Goals:**
- Remover Visual Signature restore (permanece para fase futura)
- Remover bucket `store-logos` ou coluna `logo_url` (evitar migration)
- Alterar fluxo de upload, delete, ou BrandDirector
- Alterar rollbacks técnicos de compensação (ex: logo/route.ts:327)

## Decisions

### Decisão: Endpoint de retry sem `asset_id` no body

O servidor resolve o único asset original ativo (`variant_type = 'original'`, `status = 'active'`) da loja. Isso:
- Elimina input manipulável pelo cliente
- Impede retry em logo arquivado
- Reduz validações e estado no frontend
- Torna explícito que retry nunca restaura assets

### Decisão: Pré-condição de perfil `failed`

O endpoint busca o perfil mais recente da loja (sem filtrar status) e valida:
- `status === 'failed'`
- `source === 'logo_analysis'`
- `active_logo_asset_id === asset.id`

Isso impede retry após sucesso (perfil synced não passaria) e garante que o retry só ocorre quando há falha prévia documentada.

### Decisão: Sequência compensável (não transação atômica)

Supabase não oferece transações entre chamadas independentes. A sequência depende da existência de fallback:

**Com fallback (segundo+ upload):**
1. Marca fallback synced → `outdated`
2. Insere novo profile `synced`
3. Se inserção falhar → restaura fallback para `synced`

**Sem fallback (primeiro upload):**
1. Insere novo profile `synced` diretamente (sem marcação prévia)
2. Se inserção falhar → retorna erro (nada a restaurar)

Em ambos os casos, sem `reconcileProfiles` — após marcar o único fallback como outdated e inserir o novo synced, a reconciliação já está completa.

### Decisão: Profile `failed` permanece `failed`

O profile `failed` original não vira `outdated`. Permanece como registro de auditoria da tentativa. Só o fallback `synced` vira `outdated` quando substituído.

### Decisão: `handleGenerate` removido

O `handleGenerate` em `brand-profile/route.ts` duplica o retry com comportamento inferior — sem preservação de `brand_colors_chosen`, sem `metadata.input_snapshot`, e com `brand_colors_chosen = logo_colors_detected` (incorreto). A função é roteada por dispatch interno (`path.endsWith('/generate')`) sem rota Next.js correspondente — é código morto. Remove-se a função e o dispatch.

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| Cliente chama retry sem necessidade (asset sem failed profile) | Erro 400 controlado | Validação de failed profile no servidor |
| Rollback do DELETE /logo confundido com restore | Falsa impressão de que restore ainda existe | Documentado explicitamente como compensação técnica, não restore |
| `handleArchive` em `brand-profile/route.ts` continua existindo | Fora de escopo, não conflita | Mantido — operação independente |
| Specs canônicas desatualizadas se delta não for archiveado | Divergência entre mudança e spec principal | Deltas capturam exatamente o que muda; archive sincroniza no fechamento |
