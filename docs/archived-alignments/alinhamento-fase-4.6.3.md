# Alinhamento Fase 4.6.3 — Logo State Lifecycle (Upload / Remove / Restore)

## Nomenclatura das Fases 4.6

```
4.6  — Store Form Adjusts                    (fase mãe)
 ├── 4.6.1 — Text Only Coverage              (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection (concluída)
 ├── 4.6.3 — Logo State Lifecycle            ← esta fase
 ├── 4.6.4 — Visual Signature fluxo          (pendente)
 └── 4.6.x — Transições entre estados        (pendente)
```

Esta fase (4.6.3) trata do ciclo de vida completo do estado com logotipo: upload (com input_snapshot e ordenação correta de outdated), remoção explícita (preservando proveniência no profile), e restauração de logos anteriores via histórico de assets archived com validação de drift.

---

## Propósito

1. Sincronizar `identity_state = 'logo'` e capturar `metadata.input_snapshot` no brand_profile
2. Persistir o brand_profile com direção visual inferida pelo BrandDirector
3. Permitir remoção explícita do logo mantendo a direção visual ativa e o vínculo de proveniência
4. Permitir restauração de logos anteriores lendo o histórico de assets archived, com validação de dados sensíveis
5. Implementar transição transacional do profile: BrandDirector executa antes de qualquer mutação; em caso de sucesso, marca outdated e insere novo synced dentro de uma transação atômica/compensável

---

## Decisões Arquiteturais

### Decisão: identity_state como campo canônico

```
identity_state  ───────────  FONTE DA VERDADE
     │
     │  'text_only'          → sem asset visual ativo
     │  'logo'               → logo ativo
     │  'visual_signature'   → assinatura visual aprovada
     │
logo_status  ────────────  DERIVADO (backward compat)
     │
     │  identity_state='text_only' + profile synced → 'explicit_none'
     │  identity_state='text_only' + sem profile    → null
     │  identity_state='logo'                        → 'uploaded'
     │  identity_state='visual_signature'            → 'generated'
```

**Regra de sincronização:** sempre que `identity_state` mudar, `logo_status` é atualizado no mesmo `UPDATE`:

```typescript
const IDENTITY_TO_LOGO_STATUS: Record<string, string | null> = {
  'text_only': 'explicit_none',
  'logo': 'uploaded',
  'visual_signature': 'generated',
};
```

`logo_status` mantido exclusivamente para backward compat. Código novo lê `identity_state`. Futuramente: remover `logo_status`.

### Decisão: active_logo_asset_id = proveniência, não status visual

O campo `store_brand_profiles.active_logo_asset_id` muda de semântica:

```
ANTES (implícito):
  active_logo_asset_id = "asset que está ativo agora"
  → null quando identity_state != 'logo'

DEPOIS (explícito):
  active_logo_asset_id = "asset ORIGINAL que gerou este profile"
  → NUNCA é nullado
  → O estado visual é decidido por:
     identity_state === 'logo' AND exists asset com status='active'
```

**Motivo:** se nullamos `active_logo_asset_id` ao remover, o profile perde o vínculo com o logo que o originou. O endpoint `/logo/history` precisa desse vínculo para retornar assets + profile associados (via FK direta, sem depender de `version`). Manter o FK íntegro é mais simples, mais robusto, e não exige migration.

**Como o sistema sabe se o logo está visualmente ativo:**
- `identity_state = 'logo'` + existe `store_brand_assets` com `status = 'active'` → logo ativo
- `identity_state = 'text_only'` → logo não ativo (independente do active_logo_asset_id)
- UI decide: se `identity_state !== 'logo'`, não mostra preview de logo

### Decisão: Remove — manter direção visual + preservar proveniência

Quando o lojista remove o logo explicitamente, o sistema:

1. **Arquiva os assets** (status='active' → 'archived')
2. **Preserva o profile synced** (não arquiva, não altera status)
3. **Preserva `active_logo_asset_id`** (o vínculo com o asset original permanece)
4. **Transiciona identity_state** ('logo' → 'text_only')

```
ANTES DO REMOVE:
  store_brand_assets → status='active'
  brand_profile → active_logo_asset_id=uuid, status='synced'
  stores → identity_state='logo'

APÓS REMOVE:
  store_brand_assets → status='archived'       ← muda
  brand_profile → active_logo_asset_id=uuid,   ← PRESERVADO
                  status='synced'               ← PRESERVADO
  stores → identity_state='text_only'           ← muda
           logo_status='explicit_none'          ← sync

  A direção visual (safe_color_tokens, visual_style, ...)
  permanece ativa no profile.
```

**Raciocínio:** o BrandDirector analisou logo + dados da loja para produzir a direção visual. Remover o logo não invalida a direção — ela continua apropriada. O `active_logo_asset_id` vira um registro histórico de qual asset gerou aquele profile.

### Decisão: Upload — transição transacional do profile

**Problema duplo no código atual.** O POST /logo comete dois erros:

1. Marca o profile anterior como `outdated` ANTES de executar o BrandDirector — se a análise falha, a loja fica sem profile synced
2. Marca outdated e insere novo synced em commands separados — o índice único `(store_id) WHERE status = 'synced'` impede inserir um segundo synced enquanto o anterior ainda está synced

**Algoritmo correto — transição transacional:**

```
1. Upload do arquivo (validação, storage, variantes)
2. Arquiva assets ativos → 'archived'
3. Captura input_snapshot
4. EXECUTA BRANDDIRECTOR (antes de qualquer mutação no profile)
   │
   ├── SUCESSO:
   │   Transação atômica (BEGIN/COMMIT):
   │    a. Marca profile anterior synced → 'outdated'
   │    b. Insere novo profile → 'synced'
   │   Se (b) falhar → ROLLBACK → profile anterior volta a synced ✓
   │
   └── FALHA:
       Sem mutação no profile anterior (permanece synced) ✓
       Insere novo profile → 'failed'
```

**Por que marca outdated ANTES de inserir:**
O índice único `(store_id) WHERE status = 'synced'` impede dois synced simultâneos. A ordem correta dentro da transação é: (a) marcar anterior outdated → (b) inserir novo synced. Como estão na mesma transação, se (b) falhar o rollback desfaz (a).

**Se a inserção do novo synced falhar por qualquer motivo** (violação de constraint, erro de rede, deadlock), o rollback garante que o profile anterior permanece synced. A loja nunca fica sem direção visual ativa.

Incluída nesta fase porque o lifecycle íntegro do profile é pré-requisito para remove/restore funcionarem.

### Decisão: previous_identity_snapshot NÃO será populado

O campo `stores.previous_identity_snapshot` (criado na migration 4.6.1, nunca populado) não será usado.

**Motivo:** é uma única coluna JSONB na stores — só cabe 1 entrada. Não suporta histórico multi-versão. O mecanismo correto para restore é o par `store_brand_assets` + `store_brand_profiles`, que suporta N versões, é a source of truth (sem duplicação), e não introduz stale data risk.

Campo morto, candidato a remoção futura.

### Decisão: Uma fase única

Upload, Remove e Restore compartilham o mesmo mecanismo central (`metadata.input_snapshot` + `active_logo_asset_id` + lifecycle de assets). Separar criaria riscos de implementação. Escopo bem contido (~8-10 tarefas).

---

## Fluxo de Upload (com input_snapshot + ordenação corrigida)

**O que muda no POST /api/store/[id]/logo:**

Hoje:
```
1. Upload do arquivo (validação, storage, variantes)
2. Arquiva assets ativos → 'archived'                     ← ok
3. Marca profile anterior → 'outdated'                    ← ERRADO: antes da análise
4. Cria brand_profile (synced ou failed)
5. Seta logo_status = 'uploaded'
6. NÃO seta identity_state
7. NÃO popula input_snapshot
```

A partir de 4.6.3:
```
1. Upload do arquivo (validação, storage, variantes)       ← inalterado
2. Arquiva assets ativos → 'archived'                      ← inalterado
3. Captura input_snapshot dos 6 campos sensíveis da store  ← NOVO
4. EXECUTA BRANDDIRECTOR                                    ← MOVADO: ANTES de outdated
   │
   ├── SUCESSO:
   │   Transação atômica:
   │   5a. Marca profile anterior synced → 'outdated'      ← DENTRO da transação
   │   5b. Cria novo profile synced com:                   ← DENTRO da transação
   │       ├─ source='logo_analysis'
   │       ├─ active_logo_asset_id = originalAsset.id
   │       ├─ metadata.input_snapshot = {6 campos}
   │       └─ brand_colors_chosen NÃO recebe logo_colors_detected
   │          (correção postergada da 4.6.1)
   │   5c. Seta identity_state = 'logo'
   │   5d. Seta logo_status = 'uploaded' (sync identity→logo)
   │   Se qualquer passo falhar → ROLLBACK → anterior volta a synced ✓
   │
    └── FALHA:
        ├── Seta identity_state = 'logo'                     ← CONSISTENTE: upload OK
        ├── Seta logo_status = 'uploaded' (sync)             ← sync
        ├── Profile anterior PERMANECE synced                ← fallback de direção
        ├── Cria profile 'failed' com:                       ← fora da transação
        │   ├─ active_logo_asset_id = originalAsset.id
        │   ├─ metadata.error = detalhes da falha
        │   └─ metadata.attempt_snapshot = {6 campos}        ← snapshot da loja p/ auditoria
        │      (input_snapshot não é populado: reservado para baseline de drift em profiles synced)
        └── UI: logo + aviso "Análise de direção falhou, usando direção anterior"
```

**Estado explícito para análise falha com upload bem-sucedido:**
- Assets: `active` (upload do arquivo + variantes funcionou)
- `identity_state`: `'logo'` — há um logo, mesmo sem direção nova
- `logo_status`: `'uploaded'` (sync)
- Profile anterior: `synced` — direção visual preservada como fallback
- Profile novo: `failed` com `active_logo_asset_id` apontando para o asset original
- `metadata.attempt_snapshot`: populado com os 6 campos da loja no momento da tentativa (auditoria)
- `metadata.input_snapshot`: NÃO populado em profiles failed — reservado exclusivamente para baseline de drift em profiles synced
- UI: preview do logo + aviso "A análise de direção visual falhou. A direção anterior está sendo usada."
- O lojista pode tentar novamente (reupload) ou clicar "Analisar novamente" (regeneração futura)
- A contradição (text_only → logo com asset ativo) é evitada porque identity_state sempre reflete a existência do asset

**input_snapshot:**
```json
{
  "segment": "moda-vestuario",
  "subsegment": "moda-feminina",
  "tone_of_voice": "elegante",
  "name": "Maria Boutique",
  "brand_color": "#C41E3A",
  "accent_color": "#2D2D2D"
}
```

**Resolução de `accent_color`:** `brand_colors_chosen[1]` → `safe_color_tokens.accent` → `inferred_accent_color` → `null`

---

## Fluxo de Remove (explicitamente)

### Premissa

Apenas remoção explícita (abordagem 2). Quando `identity_state = 'logo'`:
- **Botão "Remover logotipo"** visível no Step 2, dentro da área de preview
- Drop zone, "Enviar logotipo", "Criar assinatura visual", "Continuar sem logo", "Logotipos anteriores" → todos ocultos

### Comportamento

```
User clica "Remover logotipo"
       │
       ▼
  1. Arquiva assets ativos → 'archived'
  2. Profile permanece 'synced' (direção visual mantida)
  3. active_logo_asset_id permanece (proveniência preservada)
  4. Seta identity_state = 'text_only'
  5. Seta logo_status = 'explicit_none' (sync)

  UI reflete:
  ├─ Preview do logo removido                         ← identity_state !== 'logo'
  ├─ Drop zone reaparece
  ├─ Botões "Enviar logotipo" / "Criar assinatura" reaparecem
  ├─ Link "Logotipos anteriores" aparece (se houver archived)
  ├─ Link "Continuar sem logo" NÃO reaparece
  └─ Cores, estilo, tom permanecem (direção mantida)
```

---

## Fluxo de Restore

### Fonte única: GET /api/store/[id]/logo/history

```
GET /api/store/[id]/logo/history

Response:
{
  "logos": [
    {
      "version": 2,
      "asset": { /* BrandAssetRecord */ },
      "profile": { /* BrandProfileRecord */ },
      "created_at": "2026-06-12T...",
      "visual_style": "moderno e clean",
      "safe_color_tokens": { ... }
    },
    { "version": 1, ... }
  ]
}
```

**Como o history monta asset + profile:**
- Lista todas as versões de `store_brand_assets` com `status='archived'` e `variant_type='original'`
- Para cada asset, busca o `store_brand_profiles` cujo `active_logo_asset_id` aponta para aquele asset
- Retorna o par {asset, profile} para cada versão

Isso só funciona porque **não nullamos mais o `active_logo_asset_id`** no remove.

### Fluxo de restore

```
User abre modal → GET /logo/history → lista versões archived
       │
       ▼
  User seleciona uma versão
       │
       ▼
  POST /api/store/[id]/logo/restore
  Body: { brand_profile_id: "uuid", version: 2 }
       │
       ▼
   1. Carrega profile da versão (synced, archived ou outdated) — após remove o profile preservado continua synced
  2. Carrega assets da versão (archived)
  3. Extrai metadata.input_snapshot do profile
  4. Compara input_snapshot vs store atual (6 campos)
       │
       ├── IGUAIS (sem drift):
       │   ├── Marca profile ativo → 'outdated'
       │   ├── Reativa profile escolhido → 'synced'
       │   ├── Reativa assets escolhidos → 'active'
       │   ├── identity_state = 'logo'
       │   └── logo_status = 'uploaded' (sync)
       │
       └── DIFERENTES (drift):
           ├── Realinhamento OBRIGATÓRIO
           ├── Executa BrandDirector (logo escolhido + store ATUAL)
           ├── Cria NOVO profile synced
            ├── Profile anterior ativo → 'outdated'
            ├── Profile histórico escolhido não é reativado; permanece com seu status atual ou é marcado como 'outdated' se coincidir com o profile ativo anterior
           ├── Reativa assets escolhidos → 'active'
           ├── identity_state = 'logo'
           └── logo_status = 'uploaded' (sync)
```

**Não há "Restaurar mesmo assim"** quando há drift.

---

## Modelo de Dados

### stores

| Campo | Tipo | Uso nesta fase |
|-------|------|----------------|
| `identity_state` | `text` | Canônico — 'text_only', 'logo', 'visual_signature' |
| `logo_status` | `text` | Derivado — sync via mapping |
| `text_only_origin` | `text` | Mantido |
| `manual_color_override` | `boolean` | Mantido |
| `previous_identity_snapshot` | `jsonb` | **Não populado** — candidato a remoção futura |
| `brand_color` | `text` | Mantido |

Nenhuma migration nova.

### store_brand_profiles

| Campo | Tipo | Uso nesta fase |
|-------|------|----------------|
| `active_logo_asset_id` | `uuid` | **Proveniência** — NUNCA nullado. Aponta para o asset original que gerou este profile |
| `metadata.input_snapshot` | `jsonb` | Populado no upload de logo (antes só no text_only) |
| `status` | `text` | 'outdated' → só quando novo profile synced é criado; nunca 'archived' por remove |

**Regra de status:** profile NUNCA é arquivado por remoção. O único caminho para 'archived' é via delete físico de logo (que não existe nesta fase). O profile permanece 'synced' mesmo após remove.

### store_brand_assets

| Status | Uso |
|--------|-----|
| `active` | Logo atualmente visível nas campanhas |
| `archived` | Versões anteriores disponíveis para restore |

Assets ativos são arquivados no remove. Reativados no restore.

---

## UI — Step 2

### Estado: logo ativo (`identity_state = 'logo'`)

```
┌──────────────────────────────────────────────────┐
│  Logo e Cores                                    │
│                                                  │
│  Logotipo da Loja (opcional)                     │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │         [preview do logo]            │        │
│  │                                      │        │
│  │         [Remover logotipo]           │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  Cor Principal                                   │
│  [■]  [#C41E3A]                                 │
│                                                  │
│  Cor de Destaque (opcional)                      │
│  [■]  [#000000]                                  │
│                                                  │
│  Cores extraídas do logotipo:                    │
│  ● #C41E3A  [P] [S]                             │
│  ● #2D2D2D  [P] [S]                             │
│                                                  │
│  [Salvar]                                        │
└──────────────────────────────────────────────────┘
```

**OCULTOS:** drop zone, upload, assinatura, continuar sem logo, logotipos anteriores.

### Estado: após remover (`identity_state = 'text_only'`)

```
┌──────────────────────────────────────────────────┐
│  Logo e Cores                                    │
│                                                  │
│  Logotipo da Loja (opcional)                     │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │          [upload icon]               │        │
│  │  Arraste o logotipo ou clique para   │        │
│  │  selecionar                          │        │
│  │  Formatos aceitos: PNG, JPG ou WEBP  │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  [Enviar logotipo]  [Criar assinatura visual]    │
│                                                  │
│  Logotipos anteriores (2)                        │
│                                                  │
│  ✓ Direção visual definida pelo Vendeo           │
│  (a partir do logotipo anterior)                 │
│                                                  │
│  Cor Principal                                   │
│  [■]  [#C41E3A]                    ← mantida    │
│                                                  │
│  Cor de Destaque (opcional)                      │
│  [■]  [#2D2D2D]                    ← mantida    │
│                                                  │
│  Paleta: ● primary ● secondary                   │
│          ● accent  ● background                  │
│                                                  │
│  [Salvar]                                        │
└──────────────────────────────────────────────────┘
```

### Modal de restore

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

## Endpoints

| Método | Rota | Estado | Mudanças |
|--------|------|--------|----------|
| `POST` | `/api/store/[id]/logo` | **Alterado** | +input_snapshot, +identity_state sync, outdated só pós-análise |
| `DELETE` | `/api/store/[id]/logo` | **Alterado** | Assets→archived, profile synced preservado, active_logo_asset_id preservado, identity_state sync |
| `GET` | `/api/store/[id]/logo/history` | **NOVO** | Assets archived + profiles associados (via active_logo_asset_id FK) |
| `POST` | `/api/store/[id]/logo/restore` | **NOVO** | Restaura versão com validação de drift |
| `GET` | `/api/store/[id]/logo/versions` | Existente | Mantido para backward compat |

---

## Matriz de Decisão de UX

| Estado | Drop zone / Preview | Botões visíveis | "Continuar sem logo" | "Logotipos anteriores" |
|--------|-------------------|----------------|---------------------|----------------------|
| Novo (sem store) | Upload vazio | Upload + Assinatura | ✅ | ❌ |
| `text_only` sem profile | Upload vazio | Upload + Assinatura | ❌ | ❌ |
| `text_only` com profile | Upload vazio | Upload + Assinatura | ❌ | ✅ Se houver archived |
| **`logo`** | **Preview ativo** | **Remover (único)** | **❌** | **❌** |
| `visual_signature` | (futuro) | (futuro) | ❌ | ❌ |

---

## Campos Sensíveis para Validação

Mesmo conjunto do drift detection (4.6.2): segment, subsegment, tone_of_voice, name, brand_color, accent_color.

---

## Specs — Status

As specs OpenSpec já foram atualizadas e refletem os contratos deste alinhamento:

### logo-upload/spec.md — ✅ Alinhada

**Seção "Logo removal — soft delete":** Profile permanece `synced` na remoção. Assets são arquivados, `active_logo_asset_id` preservado, `identity_state` sincronizado.

### store-brand-profile/spec.md — ✅ Alinhada

**Item 4 do lifecycle:** Profile NÃO é arquivado na remoção de logo. Permanece `synced`. `active_logo_asset_id` documentado como campo de proveniência (nunca nullado após ser definido).

**Validação na proposal:** Confirmar que não há outros contratos divergentes no restante das specs.

---

## Estratégia de Migração

Sincronização identity_state + logo_status sob demanda (sem backfill). Código novo sempre sincroniza ambos no mesmo UPDATE.

---

## Fora de Escopo

| Item | Motivo |
|------|--------|
| `brand_colors_chosen` populado com `logo_colors_detected` | Correção postergada da 4.6.1 |
| Fluxo `visual_signature` (approve/reject/remove) | 4.6.4 |
| Transições sem logo entre text_only e visual_signature | 4.6.x |
| Confirmação extra no "Remover logotipo" | Decidir na implementação |
| `POST /api/store/[id]/brand-profile/generate` | Postergado |
| `previous_identity_snapshot` | Não populado. Remover se sem uso futuro |

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-06-14 | `active_logo_asset_id` muda de semântica: vira campo de **proveniência** (nunca nullado). Estado visual decidido por `identity_state` + asset status |
| 2026-06-14 | **Falha de análise no upload**: identity_state sobe para `'logo'` mesmo com análise falha — o upload do arquivo foi bem-sucedido. Profile anterior preservado como fallback de direção visual. UI mostra aviso |
| 2026-06-14 | **Remove**: assets→archived, profile synced preservado, active_logo_asset_id preservado, identity_state→text_only |
| 2026-06-14 | **Upload**: transição transacional — BrandDirector executa primeiro; sucesso → outdated+insert atômico; falha → preserva anterior. Ordem outdated→insert exigida pelo índice único `(store_id) WHERE status = 'synced'` |
| 2026-06-14 | **attempt_snapshot vs input_snapshot**: em profiles failed, popula `metadata.attempt_snapshot` (auditoria). `input_snapshot` reservado exclusivamente para baseline de drift em profiles synced. Distinção evita poluir semântica de drift |
| 2026-06-14 | **Restore com drift**: Profile histórico escolhido não é reativado; permanece com seu status atual (synced após remove, ou outdated). Remove promessa falsa de "permanece archived" |
| 2026-06-14 | `/logo/history` usa `active_logo_asset_id` como FK para juntar asset + profile |
| 2026-06-14 | `previous_identity_snapshot` não populado. Campo único na stores não suporta histórico multi-versão |
| 2026-06-14 | Specs `logo-upload` e `store-brand-profile` atualizadas para refletir novo lifecycle (profile synced, active_logo_asset_id como proveniência) |

---

## Checklist de Revisão

- [ ] `active_logo_asset_id` não é mais nullado — preserva proveniência
- [ ] Remove: assets→archived, profile synced, active_logo_asset_id mantido
- [ ] Upload: outdated só após criação de novo profile synced
- [ ] History endpoint usa FK `active_logo_asset_id` para join
- [x] Specs `logo-upload` e `store-brand-profile` atualizadas — contratos alinhados
- [ ] Upload: transição transacional (BrandDirector primeiro, outdated+insert em transação)
- [x] Upload c/ análise falha: identity_state='logo', profile anterior synced como fallback, aviso na UI
- [ ] Wireframes consistentes: logo ativo só "Remover"; após remover "Logotipos anteriores" abaixo dos botões
- [ ] Cores extraídas abaixo dos pickers (estado logo ativo)
