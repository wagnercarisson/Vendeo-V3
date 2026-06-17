## Context

O código atual do lifecycle de logo tem três problemas estruturais:

**POST /api/store/[id]/logo** (`src/app/api/store/[id]/logo/route.ts`):
1. Marca o profile anterior como `outdated` (linha ~165) **antes** de executar o BrandDirector — se a análise falha, a loja fica sem direção visual
2. Não seta `identity_state` — o campo existe mas nunca é populado no upload
3. Popula `brand_colors_chosen` com `logo_colors_detected` (linha ~288) — o campo deveria ser exclusivo para cores escolhidas pelo usuário
4. Não captura `input_snapshot` — o baseline de drift fica vazio

**DELETE /api/store/[id]/logo** (mesmo arquivo, a partir da linha ~338):
1. Arquiva o brand profile (`status: 'archived'`) — destrói a direção visual
2. Seta `logo_status: null` — deveria ser `'explicit_none'` com `identity_state: 'text_only'`
3. Não preserva `active_logo_asset_id` — a proveniência é perdida

**Ausências**:
- Não há endpoint `/logo/history` para listar versões archived com profiles associados
- Não há endpoint `/logo/restore` para recuperar versões anteriores
- A UI do Step 2 não contempla os estados de logo ativo com análise failed nem o modal de restore

O BrandDirectorService (`src/lib/brand-assets/brand-director.ts`) está intacto — executa análise, retorna `BrandDirectorResult`. O problema não está na análise, mas na ordenação e atomicidade das mutações pós-análise. O índice único parcial `(store_id) WHERE status = 'synced'` em `store_brand_profiles` já protege contra duplicatas — a fase usa esse índice como safety net em vez de criar transações SQL.

---

## Goals / Non-Goals

**Goals:**
- Upload de logo com atomicidade: BrandDirector executa antes de qualquer mutação no profile; se falha, profile anterior permanece synced e identity_state='logo'
- Remove de logo preserva direção visual: profile synced, active_logo_asset_id intacto, identity_state='text_only'
- History endpoint que retorna pares asset+profile via FK active_logo_asset_id
- Restore com validação de drift: sem drift → reativa assets; com drift → BrandDirector + novo profile
- UI com 4 cenários no Step 2: logo ativo OK, logo ativo failed, pós-remove, modal de restore
- brand_colors_chosen isolado de logo_colors_detected (upload não popula o campo)
- Nenhuma migration nova no banco
- Zero breaking changes nos contratos públicos de API existentes

**Non-Goals:**
- Corrigir `brand_colors_chosen` populado com `logo_colors_detected` em fluxos existentes (outdated profiles mantêm dados históricos)
- Remover `previous_identity_snapshot` da tabela stores
- Fluxo visual_signature (approve/reject/remove) — fase 4.6.4
- Transições sem logo entre text_only e visual_signature — fase 4.6.x
- Confirmação extra no "Remover logotipo" — decisão postergada para implementação
- Cache ou debounce no modal de restore

---

## Decisions

### D1: active_logo_asset_id como proveniência (nunca nullado)

`active_logo_asset_id` muda de semântica: de "asset ativo agora" para "asset original que gerou este profile".

| Cenário | Antes | Depois |
|---------|-------|--------|
| Upload OK | asset.id | asset.id |
| Remove | nullado | **preservado** |
| Restore sem drift | N/A | asset.id do escolhido |
| Restore com drift | N/A | asset.id do escolhido (reativado) |

**Quem decide o estado visual:** `identity_state` + existência de asset `active`. Se `identity_state = 'text_only'`, o logo não está ativo visualmente independente do valor de `active_logo_asset_id`.

**Impacto no history:** O FK direto permite join sem depender de `version`. O GET /logo/history busca assets archived com `variant_type='original'` e para cada um encontra o profile via `active_logo_asset_id`.

### D2: Compensação controlada (não RPC, não BEGIN/COMMIT)

O Supabase client (`supabaseAdmin = createClient(url, key)`) não expõe BEGIN/COMMIT. O padrão existente na base é: (1) marca outdated, (2) insere novo, (3) confia no índice único. A fase adiciona o passo de **compensação**:

```
1. Salva ID do profile synced atual (se existir)
2. Marca synced → outdated
3. Insere novo profile → synced
4. SE INSERT FALHAR (qualquer erro):
   ├── Se havia profile anterior → restaura para synced (compensação)
   └── Se não havia → apenas loga o erro (primeiro profile)
   5. Estado final deste caso (recuperação):
      ├── Assets NOVOS permanecem active (upload já foi bem-sucedido)
      ├── Assets ANTERIORES permanecem archived
      ├── Profile anterior → restaurado para synced (compensação)
      ├── identity_state → 'logo' (upload OK, assets ativos existem)
      └── logo_status → 'uploaded' (sync com identity_state)
```

**Justificativa do estado final:** o upload do arquivo e a geração de variantes ocorreram antes da compensação. Assets novos ativos + identity_state='logo' é o estado correto: há um logo visível, mesmo sem direção visual nova. É semanticamente equivalente ao fluxo de BrandDirector com análise falha (upload OK, direção anterior como fallback).

**Proteção extra:** O índice único parcial `(store_id) WHERE status = 'synced'` impede dois synced simultâneos mesmo em condição de corrida. Se a compensação falhar por conflito com outro synced inserido por requisição concorrente, o store nunca fica sem synced (o outro request já criou um válido).

**Risco aceito:** Janela de corrida de ~100ms entre outdated e insert. Consequência: um dos dois uploads perde o sync do profile, mas identity_state='logo' fica consistente, e o usuário pode reupload.

### D3: identity_state como canônico, logo_status como derivado

```typescript
const IDENTITY_TO_LOGO_STATUS: Record<string, string | null> = {
  'text_only': 'explicit_none',
  'logo': 'uploaded',
  'visual_signature': 'generated',
};
```

Sempre que `identity_state` mudar, `logo_status` é atualizado no mesmo `UPDATE` (dual-population). Código novo lê exclusivamente `identity_state`. O mapping centraliza a derivação.

### D4: input_snapshot vs attempt_snapshot

Dois campos de metadata com semânticas diferentes:

| Campo | Onde | Quando | Propósito |
|-------|------|--------|-----------|
| `input_snapshot` | Profiles `synced` | Upload OK | Baseline de drift — comparar com store atual |
| `attempt_snapshot` | Profiles `failed` | Upload com análise falha | Auditoria — registro do estado da loja na tentativa |

**input_snapshot** (6 campos): segment, subsegment, tone_of_voice, name, brand_color (resolvida), accent_color (resolvida).

**attempt_snapshot** (mesmos 6 campos): capturados no momento da tentativa. Só existe em profiles failed. Não confundir com input_snapshot — não serve como baseline de drift.

### D5: Upload flow — antes vs depois

```
ANTES (código atual):
  1. Upload do arquivo
  2. Arquiva assets ativos → archived
  3. Marca profile synced → outdated              ← ERRADO: antes da análise
  4. Cria variantes
  5. Executa BrandDirector                         ← TARDE: profile já outdated
  6. Cria profile (synced ou failed)
  7. Seta logo_status = 'uploaded'
  8. NÃO seta identity_state

DEPOIS (4.6.3):
  FASE 1 — Pré-análise (inalterado):
    1. Upload do arquivo (validação, storage)
    2. Arquiva assets ativos → archived
    3. Gera variantes técnicas
    4. Captura input_snapshot da store              ← NOVO

  FASE 2 — BrandDirector (MOVADO para antes da mutação):
    5. Executa BrandDirector

  FASE 3 — Pós-análise (substituído):
    SUCESSO:
      6. Compensação controlada:
         a. Marca profile synced → outdated
         b. Insere novo profile synced com:
            ├─ active_logo_asset_id = originalAsset.id
            ├─ metadata.input_snapshot = {6 campos}
            └─ brand_colors_chosen NÃO recebe logo_colors_detected
      7. Seta identity_state = 'logo' + logo_status sync
    
    FALHA:
      6. Profile anterior PERMANECE synced        ← NOVO: fallback preservado
      7. Insere profile failed com:
         ├─ active_logo_asset_id = originalAsset.id
         ├─ metadata.attempt_snapshot = {6 campos}
         └─ metadata.error = detalhes da falha
      8. Seta identity_state = 'logo' + logo_status sync
         (upload OK mesmo sem análise)
```

### D6: Remove flow

```
ANTES:
  DELETE /api/store/[id]/logo
    1. Assets → archived
    2. Profile → archived                         ← ERRADO: perde direção
    3. logo_status → null                         ← ERRADO: deveria explicit_none

DEPOIS:
  DELETE /api/store/[id]/logo
    1. Assets → archived                          ← inalterado
    2. Profile PERMANECE synced                   ← NOVO: direção preservada
    3. active_logo_asset_id PRESERVADO            ← NOVO: proveniência
    4. identity_state → 'text_only'
    5. logo_status → 'explicit_none' (sync)
```

**UI reflete:**
- Preview do logo removido (`identity_state !== 'logo'`)
- Drop zone reaparece
- Botões "Enviar logotipo" / "Criar assinatura visual" reaparecem
- Link "Logotipos anteriores" aparece (se houver archived)
- Link "Continuar sem logo" NÃO reaparece
- Cores, estilo, tom permanecem (direção mantida)

### D7: History — GET /api/store/[id]/logo/history

```
Query:
  SELECT a.*, p.*
  FROM store_brand_assets a
  LEFT JOIN store_brand_profiles p ON p.active_logo_asset_id = a.id
  WHERE a.store_id = :storeId
    AND a.variant_type = 'original'
    AND a.status = 'archived'
  ORDER BY a.version DESC

Drift status computation (server-side, por item):
  Se profile existir:
    ├── profile.metadata.input_snapshot existir:
    │     comparar 6 campos sensíveis (segment, subsegment, tone_of_voice,
    │     name, brand_color, accent_color) contra store atual
    │     → 'none' se todos iguais, 'drift' se qualquer diferença
    └── profile.metadata.input_snapshot NÃO existir:
          → 'drift' (conservativo: sem baseline, assume desalinhado)
  Se profile não existir (asset órfão):
    → null

Response:
  {
    "logos": [
      {
        "version": 2,
        "asset": BrandAssetRecord,
        "profile": BrandProfileRecord | null,
        "drift_status": "none" | "drift" | null,
        "input_snapshot": Record | null,
        "created_at": ISO datetime,
        "visual_style": string | null,
        "safe_color_tokens": Record | null
      },
      ...
    ]
  }
```

O LEFT JOIN cobre o caso de borda onde um asset archived não tem profile associado (impossível com o novo lifecycle, mas seguro).

### D8: Restore — POST /api/store/[id]/logo/restore

```
Body: { asset_id: string }  ← asset_id do original archived, identifica asset + profile via FK

1. Valida que asset_id pertence ao store_id da requisição e está archived
2. Arquiva assets atualmente ativos (previne violação do índice único antes de reativar)
3. Carrega o profile associado via active_logo_asset_id = asset_id (pode ser null se não houver)
4. Se profile existir, extrai metadata.input_snapshot para validação de drift
5. Compara input_snapshot vs store ATUAL (6 campos)

   ├── IGUAIS (sem drift):
   │   ├── Se profile alvo já é o synced ativo → NÃO marcar outdated (edge case pós-remove)
   │   ├── Caso contrário → marca profile ativo atual como outdated
   │   ├── Reativa profile alvo → synced
   │   ├── Reativa assets alvo → active
   │   ├── identity_state = 'logo'
   │   └── logo_status = 'uploaded' (sync)
   │
   └── DIFERENTES (drift):
       ├── Executa BrandDirector (logo escolhido + store ATUAL)
       ├── Se houver profile ativo synced → marca como outdated
       ├── Cria NOVO profile synced (reativa assets do logo escolhido)
       ├── Profile histórico escolhido NÃO é reativado
       │   (permanece com status atual, exceto se coincidir com o profile ativo anterior
       │   que acabou de ser marcado outdated — nesse caso já está outdated)
       ├── Reativa assets escolhidos → active
       ├── identity_state = 'logo'
       └── logo_status = 'uploaded' (sync)
```

**Edge case importante:** Se o profile escolhido no restore já é o profile synced ativo (caso pós-remove onde o profile permaneceu synced), não marcá-lo como outdated. Apenas reativar os assets. Caso contrário, o restore criaria um ciclo: marcar synced→outdated, depois reativar o mesmo→synced.

**Não há "Restaurar mesmo assim"** com drift. O realinhamento é obrigatório.

### D9: brand_colors_chosen isolation

O código atual em `POST /logo` faz:
```typescript
brand_colors_chosen: analysis.logo_colors_detected,  // ERRADO: linha ~288
```

Na fase 4.6.3, `brand_colors_chosen` não é populado no upload de logo:
```typescript
// NOVO: brand_colors_chosen não recebe logo_colors_detected
// brand_colors_chosen permanece reservado para cores escolhidas manualmente
```

`brand_colors_chosen` é populado **apenas** pelo picker manual do usuário (PATCH brand-profile com colors). Fluxos inferidos (logo_analysis, text_only, without_logo) devem usar `safe_color_tokens` + `inferred_primary_color` / `inferred_accent_color`. O comportamento legado de `without_logo` gravar cor inferida em `brand_colors_chosen` não será perpetuado — esta fase não modifica esse fluxo, mas também não o valida como referência.

**Justificativa:** `logo_colors_detected` são as cores cruas extraídas da imagem. `brand_colors_chosen` deve refletir escolha ativa do lojista. A paleta final consumida pelas campanhas está em `safe_color_tokens`, que o BrandDirector já popula corretamente.

### D10: UI — matriz de decisão no Step 2

| Estado | Drop zone / Preview | Botões | "Continuar sem logo" | "Logotipos anteriores" |
|--------|-------------------|--------|---------------------|----------------------|
| Novo (sem store) | Upload vazio | Upload + Assinatura | ✅ | ❌ |
| `text_only` sem profile | Upload vazio | Upload + Assinatura | ❌ | ❌ |
| `text_only` com profile | Upload vazio | Upload + Assinatura | ❌ | ✅ Se houver archived |
| **`logo` com análise OK** | **Preview ativo** | **Remover (único)** | **❌** | **❌** |
| **`logo` com análise failed** | **Preview + aviso** | **Remover (único)** | **❌** | **❌** |
| `visual_signature` | (futuro) | (futuro) | ❌ | ❌ |

**Componentes envolvidos:**
- `store-identity-form.tsx` — condicionais no bloco de logo (linhas ~957-1270)
- Novo componente `logo-restore-modal.tsx` — modal de listagem e restore
- Novo componente `logo-history-item.tsx` — cada entrada na lista com badge de drift

**Modal de restore:**
```
┌───────────────────────────────────────────────────────┐
│  Logotipos anteriores                          [X]    │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  ┌──────────┐  12 jun 2026 · v2                │ │
│  │  │  logo    │  Estilo: Moderno e clean          │ │
│  │  └──────────┘  Paleta: #C41E3A, #2D2D2D        │ │
│  │  ✓ Dados inalterados  [Restaurar]               │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  ┌──────────┐  10 jun 2026 · v1                │ │
│  │  │  logo    │  Estilo: Rústico e acolhedor      │ │
│  │  └──────────┘  Paleta: #8B4513, #D2691E        │ │
│  │  ⚠ Requer realinhamento  [Restaurar c/ realinh] │ │
│  └─────────────────────────────────────────────────┘ │
│  [Cancelar]                                            │
└───────────────────────────────────────────────────────┘
```

---

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Corrida na compensação:** duas requisições concorrentes podem marcar o mesmo profile como outdated, e uma delas falhar ao inserir. A compensação restaura o profile, mas a outra request já pode ter inserido um novo synced, fazendo a compensação falhar por unique index. | O store nunca fica sem synced (a outra request já criou um válido). identity_state='logo' fica consistente. O usuário percebe no máximo um refresh para ver o logo mais recente. |
| **brand_colors_chosen vazio no pós-upload:** com a remoção de `brand_colors_chosen: analysis.logo_colors_detected`, perfis criados por upload de logo terão `brand_colors_chosen = []`. Código legado que lê `brand_colors_chosen[0]` em vez de `safe_color_tokens.primary` pode quebrar. | Mapear todos os consumidores de `brand_colors_chosen` e garantir que usam `safe_color_tokens.primary` como fallback. Adicionar verificação em code review. |
| **History endpoint sem profile:** se um asset archived não tiver profile associado (`active_logo_asset_id` null ou apontando para asset deletado), o LEFT JOIN retorna profile null. | UI trata profile null como "disponível apenas o logo" sem dados de direção. |
| **BrandDirector timeout:** análise pode exceder 30s (timeout configurado em `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`). | O timeout já existe e gera `BrandDirectorAnalysisError`. O fluxo de falha (profile failed, identity_state='logo') lida corretamente com isso sem deixar estado inconsistente. |
| **Drift falso positivo no restore:** input_snapshot pode diferir da store por campos que não afetam direção (ex: nome com capitalização diferente). | A comparação é case-sensitive e exata. Se houver ruído, o realinhamento é conservador (roda BrandDirector de novo), o que é aceitável. Melhoria futura: diff semântico. |
