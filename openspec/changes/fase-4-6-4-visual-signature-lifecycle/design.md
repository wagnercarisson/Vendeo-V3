## Context

O lifecycle da assinatura visual tem lacunas estruturais identificadas no rastreio de código:

- **approve/route.ts** não seta `identity_state` na store — seta apenas `logo_status = 'generated'`. Uma loja com VS aprovada permanece com `identity_state = 'text_only'` ou `'logo'`.
- **generate-without-logo/route.ts** não persiste `content_used` nem `input_snapshot` no metadata da signature. O `input_data_hash` atual é uma string simples `"${store.name}-${store.segment}-${attemptNumber}"` — insuficiente para drift validation.
- **DELETE /visual-signature** não existe — não há como arquivar/remover uma assinatura visual ativa.
- **POST /logo** não valida `identity_state` — sobrescreve para `'logo'` independente do estado anterior. Upload é permitido mesmo com VS ativa.
- **GET /visual-signature** retorna lista simples sem `approved_at`, `art_direction` ou metadados de histórico.
- **Rejeição com feedback:** o `rejectionContext` coletado na fase `feedback` do modal não é garantido na fase `review` ao gerar nova versão.
- **VisualSignatureMetadata** type não inclui `content_used` nem `input_snapshot`.
- **Brand profile reconciliation** não é padronizada — cada transição (approve, restore, logo upload) implementa a lógica de outdated/synced separadamente.

---

## Goals / Non-Goals

**Goals:**

- `POST /approve` seta `identity_state = 'visual_signature'` e `logo_status = 'generated'` na store
- Geração persiste `content_used` (do retorno JSON da IA) + `input_snapshot` (snapshot dos dados da store) no `metadata` da signature
- `DELETE /visual-signature` (novo): arquiva signature ativa, transiciona para `text_only`, mantém `without_logo` como `synced` fallback
- `GET /visual-signature` evoluído para servir como histórico com `approved_at`, `art_direction`, `content_used`
- `POST /visual-signature/restore` (novo): restaura signature archived como active com validação de drift via `input_snapshot` + `content_used`
- `POST /logo` recusa upload quando `identity_state = 'visual_signature'` com erro estruturado
- Profile reconciliation padronizada: ao ativar nova identidade, marca incompatíveis como `outdated`; ao remover para `text_only`, preserva profile anterior como `synced` fallback
- Propagação de `rejectionContext` da fase `feedback` para `generate()` na fase `review`
- UI Step 2 reflete `identity_state` como fonte primária com preview VS, Alterar/Remover, histórico e restore

**Non-Goals:**

- Arquitetura de prompt 1-passo vs 2-passos — ortogonal ao lifecycle (microfase futura)
- Consumo de cores/visual_elements na geração de campanha — fase futura
- Refinamento do prompt `store-identity-art-director.md` — microfase separada
- Créditos para gerações extras (limite 3) — monetização
- Correção de `brand_colors_chosen` populado com `logo_colors_detected` — 4.6.1 postergada
- Preview refresh pós-aprovação sem reload — UX separada

---

## Decisions

### D1: Content_used + input_snapshot no metadata da geração

**Problema:** O generate handler não persiste quais campos foram usados na composição da imagem nem o estado da store no momento da geração. Sem esses dados, drift validation no restore é impossível.

**Decisão:** No handler `generate-without-logo/route.ts`, após `AiImageGenerator.generate()` bem-sucedido:

1. Extrair JSON do `response.output.message`. O prompt `store-identity-art-director.md` já foi ajustado para retornar:
   ```json
   {
     "visual_direction": "...",
     "content_used": {
       "store_name": true,
       "city": false,
       "state": false,
       "slogan": true
     },
     "visual_elements": ["..."],
     "intended_palette": {...},
     "color_usage": {...}
   }
   ```
2. Persistir em `metadata.artDirectorOutput` no `store_visual_signatures` row.
3. Capturar `input_snapshot` dos dados atuais da store (10 campos: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state, brand_color) e persistir em `metadata.input_snapshot`.
4. Em retry com prompt simplificado (`visual-signature-generator.md`, que não retorna JSON): `content_used` inferido por heurística conservadora — todos os campos disponíveis como `true`.

**Alternativa considerada:** Salvar `content_used` em coluna própria na tabela. Rejeitada porque `metadata` já é jsonb e suporta query por operadores JSON. Coluna extra adicionaria complexidade de migration sem ganho.

**Efeito no tipo `VisualSignatureMetadata`:**
```typescript
interface VisualSignatureMetadata {
  generation_tier: GenerationTier;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  fallbackReason?: string;
  previousAttempts?: CascadeAttempt[];
  totalElapsedMs?: number;
  generationParams?: Record<string, unknown>;
  input_snapshot?: {
    name: string;
    segment: string;
    subsegment: string | null;
    tone_of_voice: string | null;
    positioning: string | null;
    short_description: string | null;
    slogan: string | null;
    city: string | null;
    state: string | null;
    brand_color: string | null;
  };
  artDirectorOutput?: {
    visual_direction: string;
    content_used: {
      store_name: boolean;
      city: boolean;
      state: boolean;
      slogan: boolean;
    };
    visual_elements?: string[];
    intended_palette?: Record<string, unknown>;
    color_usage?: Record<string, unknown>;
  };
}
```

---

### D2: Approve seta identity_state

**Problema:** `approve/route.ts` não seta `identity_state`, deixando a UI inconsistente (Step 2 não sabe que existe VS aprovada).

**Decisão:** No handler `approve/route.ts`, antes de retornar sucesso, adicionar:
```typescript
await supabaseAdmin
  .from('stores')
  .update({ identity_state: 'visual_signature', logo_status: 'generated' })
  .eq('id', storeId);
```

Isso corrige a UI do Step 2 e alinha o estado da store com a identidade visual ativa.

**Ordem de operações no approve (atualizada):**
1. Carrega signature pertencente à store
2. Arquiva signature active anterior (status → 'archived')
3. Seta signature escolhida como 'active'
4. **NOVO:** Atualiza stores: `identity_state = 'visual_signature'`, `logo_status = 'generated'`
5. Reusa brand profile existente ou executa BrandProfilerWithoutLogoService
6. Ao reativar profile, marca outros synced da mesma store como `outdated` **antes** de ativar o target (previne violação do índice único parcial)

---

### D3: DELETE /visual-signature — arquivamento com fallback

**Problema:** Não há endpoint para remover/arquivar uma assinatura visual ativa. O usuário não consegue voltar a `text_only` para fazer upload de logo.

**Decisão:** Novo handler DELETE em `visual-signature/route.ts`:

```
DELETE /api/store/[id]/visual-signature

1. Valida que store existe
2. Carrega signature ativa (status = 'active')
3. Seta status = 'archived'
4. Atualiza stores:
   ├── identity_state = 'text_only'
   ├── logo_status = 'explicit_none' (via IDENTITY_TO_LOGO_STATUS)
   └── visual_signature_attempts PRESERVADO (não reseta)
5. Brand profile `without_logo` permanece `synced` (fallback intencional de direção visual)
6. Retorna { success: true, previous_identity_state: 'visual_signature' }
```

**Resposta de erro (se não houver signature ativa):**
```json
{ "error": "Nenhuma assinatura visual ativa para remover." }
```

**Nomenclatura de estado:** A validação `POST /logo` usa `stores.identity_state`, não `store_visual_signatures.status`. Uma signature `archived` não impede upload — o que impede é `identity_state = 'visual_signature'`. Após DELETE, `identity_state = 'text_only'` libera upload.

---

### D4: GET /visual-signature evoluído como histórico

**Problema:** A rota GET atual retorna lista simples sem metadados de histórico. Idealmente serve como listagem única em vez de criar `/history` separada.

**Decisão:** Evoluir o response do GET existente para incluir:
```json
{
  "signatures": [
    {
      "id": "uuid",
      "status": "archived" | "active",
      "assetUrl": "...",
      "type": "ai_generated" | "automatic_generated",
      "attempt": 1,
      "created_at": "...",
      "approved_at": "...",
      "art_direction": {
        "visual_direction": "...",
        "content_used": { "store_name": true, "city": false, "slogan": true },
        "intended_palette": { ... }
      },
      "restore_eligibility": {
        "can_restore": true | false,
        "drift_fields": [],
        "requires_regeneration": true | false,
        "reason": "ok" | "critical_drift" | "missing_metadata"
      }
    }
  ]
}
```

`approved_at` é confiável apenas para a signature **atualmente ativa** (seu `updated_at` reflete o momento da aprovação). Para signatures archived que já foram active, `updated_at` foi sobrescrito pelo arquivamento — `approved_at` retorna `null`. Signatures que nunca foram aprovadas (`draft`/`archived` sem terem sido active) também retornam `null`. Um campo `approved_at` na tabela pode ser adicionado em fase futura se houver necessidade de rastreio histórico.

Para signatures sem `artDirectorOutput` (pré-feature), `art_direction` é `null`.

---

### D5: POST /visual-signature/restore com drift validation

**Problema:** Não há como reaplicar uma assinatura visual archived sem passar pelo fluxo de geração completo.

**Decisão:** Novo handler em `visual-signature/restore/route.ts`:

```
POST /api/store/[id]/visual-signature/restore
Body: { signature_id: "uuid" }

1. Valida que signature pertence à store (pode estar `archived` ou `active`)
2. Se já estiver `active`, no-op (return success)
3. Valida `identity_state` da store:
   ├── `text_only` → permitido
   ├── `visual_signature` → permitido (troca/reaplicação entre assinaturas)
    └── `logo` → REJEITADO: usuário deve remover o logo antes de restaurar VS
        { error: "Remova o logotipo ativo antes de restaurar uma assinatura visual.",
          requires_logo_removal: true, current_identity_state: 'logo' }
4. Valida drift:
    ├── input_snapshot = signature.metadata.input_snapshot
    ├── content_used = signature.metadata.artDirectorOutput.content_used
    ├── current = dados atuais da store (SELECT)
    │
    ├── Se input_snapshot.name != current.name:
    │     → Drift crítico (nome sempre usado)
    ├── Se input_snapshot.segment != current.segment:
    │     → Drift crítico (segmento sempre crítico)
    ├── Se input_snapshot.city != current.city && content_used.city === true:
    │     → Drift condicional
    ├── Se input_snapshot.state != current.state && content_used.state === true:
    │     → Drift condicional
    ├── Se input_snapshot.slogan != current.slogan && content_used.slogan === true:
    │     → Drift condicional
    │
    ├── Se houver drift → retorna { success: false, drift: { critical: true, fields: [...], requires_regeneration: true } }
    └── Se não houver drift → prossegue

5. Arquiva signature active atual (se houver)
6. Seta signature escolhida como 'active'
7. Atualiza stores:
   ├── identity_state = 'visual_signature'
   └── logo_status = 'generated'
8. Reusa brand profile existente da assinatura:
   ├── Se profile existe (signature aprovada anteriormente):
   │     Marca outros profiles synced da store como 'outdated'
   │     Ativa profile da signature como 'synced'
   └── Se NÃO existe profile (draft nunca aprovada):
         Executa BrandProfilerWithoutLogoService.generate()
         Cria novo profile without_logo vinculado ao visual_signature_id
         Ativa como 'synced'
9. Retorna { success: true, signature: { id, assetUrl, ... } }
```

**Comportamento conservador para signatures sem `content_used` ou `input_snapshot` (pré-feature):** Assume drift em todos os campos — restore bloqueado para signatures antigas. UI exibe alerta orientando nova geração.

**Não consome geração** — restore de signature existente não conta para o limite de 3.

---

### D6: POST /logo recusa baseado em identity_state

**Problema:** Upload de logo é permitido mesmo com VS ativa, o que corrompe o estado de identidade.

**Decisão:** No início do handler POST em `logo/route.ts`, adicionar validação:

```typescript
const { identity_state } = await getStoreField(storeId, 'identity_state');
if (identity_state === 'visual_signature') {
  return NextResponse.json({
    error: "Remova a assinatura visual ativa antes de enviar um logotipo.",
    requires_identity_removal: true,
    current_identity_state: 'visual_signature'
  }, { status: 409 });
}
```

A validação usa `stores.identity_state`, não o status de `store_visual_signatures` ou `store_brand_profiles`. Isso é consistente com a regra "sempre via text_only" para transições entre identidades.

**DELETE /logo:** Validar que o comportamento implementado na fase 4.6.3 está correto — assets arquivados, `logo_analysis` mantido como `synced` fallback em `text_only`, `active_logo_asset_id` preservado. Ajustar apenas se o comportamento atual divergir do especificado.

**POST /logo/restore (logo-restore):** Validar que `identity_state = 'text_only'` antes de permitir restore. Se `identity_state = 'visual_signature'`, recusar com erro `requires_identity_removal: true`. Se `identity_state = 'logo'`, recusar com `requires_logo_removal: true` — o logo ativo deve ser removido primeiro. A mesma função de validação de `identity_state` usada no upload (D6) pode ser reutilizada — a regra é idêntica: toda transição passa por `text_only`.

---

### D7: Profile reconciliation padronizada

**Problema:** Cada transição implementa a lógica de outdated/synced separadamente, com risco de inconsistência.

**Decisão:** Extrair lógica de reconciliação para função compartilhada em `src/lib/brand-assets/profile-reconciliation.ts`:

```typescript
async function reconcileProfiles(
  storeId: string,
  options: {
    /** IDs de profiles que devem se tornar synced (máx 1) */
    activateProfileIds?: string[];
    /** Sources de profiles que devem se tornar outdated */
    outdatedSources?: BrandProfileSource[];
    /** Se true, marca profiles incompatíveis como outdated antes de ativar */
    markIncompatibleAsOutdated?: boolean;
    /** Se true, após marcar outdated preserva o profile anterior como synced (fallback text_only) */
    preserveCurrentAsFallback?: boolean;
  }
): Promise<ReconciliationResult>
```

**Compatibilidade de source por transição:**

| Transição | Target synced | Profiles marcados como outdated | Profiles preservados |
|-----------|---------------|--------------------------------|---------------------|
| Approve VS | `without_logo` vinculado à `visual_signature_id` alvo | **Qualquer outro synced** — inclusive `without_logo` de outro `visual_signature_id`, `logo_analysis`, `text_only` | — |
| Restore VS | `without_logo` vinculado à `visual_signature_id` restaurada | **Qualquer outro synced** — inclusive `without_logo` de outro `visual_signature_id`, `logo_analysis`, `text_only` | — |
| Upload logo | `logo_analysis` | `without_logo`, `text_only` | — |
| Remove VS | — (fallback) | — | Profile atual permanece `synced` |
| Remove logo | — (fallback) | — | Profile atual permanece `synced` |

**Regras de reconciliação:**
1. Ao ativar nova identidade (aprovar VS, upload de logo, restore): marcar profiles `synced` com `source` incompatível (conforme tabela acima) como `outdated`, depois ativar target como `synced`
2. Ao remover para `text_only` (DELETE /visual-signature, DELETE /logo): **não** marcar profile anterior como `outdated` — permanece `synced` como fallback
3. Se não houver profile target (ex: text_only sem inferência), apenas preservar o atual

**Implementação nas transições:**
| Transição | markIncompatibleAsOutdated | preserveCurrentAsFallback | activateProfileIds |
|-----------|---------------------------|--------------------------|--------------------|
| Approve VS | true | false | ID do profile `without_logo` da signature |
| Restore VS | true | false | ID do profile da signature restaurada |
| Upload logo | true | false | ID do novo profile `logo_analysis` |
| Remove VS | false | true | — |
| Remove logo | false | true | — |

---

### D8: Rejection feedback propagation

**Problema:** Na fase "review" do modal de aprovação (que lista signatures existentes), o `generate()` é chamado **sem** o `rejectionContext` coletado na fase "feedback". O feedback não é propagado.

**Decisão:** No `VisualSignatureApprovalModal`, garantir que `rejectionContext` seja armazenado no estado do modal e passado como parâmetro para `generate-without-logo` quando o usuário optar por gerar nova versão na fase "review".

**Fluxo corrigido:**
1. Usuário rejeita na fase "display" → modal vai para "feedback" com `rejectionContext` capturado
2. Usuário confirma feedback → `handleConfirmReject` chama `generate()` com `rejectionContext`
3. **NOVO:** Se na fase "review" o usuário escolher "Gerar nova versão" (attempts < 3), o `rejectionContext` do estado do modal **deve** ser passado para `generate()`

Isso garante que o contexto de rejeição não seja perdido quando o usuário passa pela tela de revisão antes de gerar uma nova versão.

---

### D9: Step 2 UI com identity_state como fonte primária

**Problema:** Step 2 mistura `logo_status` e `identity_state` como fonte de estado. Quando `identity_state = 'visual_signature'`, UI não reflete.

**Decisão:** Refatorar `store-identity-form.tsx` (bloco de identidade visual) para usar `identity_state` como fonte primária.

**Matriz de decisão UX (Step 2):**

| identity_state | Preview | Ação principal | Drop zone | "Não tenho logo" | "Continuar sem logo" | Histórico |
|---|---|---|---|---|---|---|
| `text_only` | Direção visual | Enviar logo / Criar assinatura | Sim | Sim / Criar assinatura | Não, se direção já existe | "Assinaturas anteriores", se houver |
| `logo` | Logo ativo | Remover logo | Não | Não | Não | Logos anteriores |
| `visual_signature` | **Assinatura ativa** | **Alterar / Remover** | **Não** | **Não** | **Não** | **Assinaturas anteriores** |

**Componentes envolvidos:**
- `store-identity-form.tsx` — condicional principal por `identity_state`
- `store-visual-signature-section.tsx` — já exporta `StoreVisualSignatureSection`, renderiza preview de VS + "Alterar". Adicionar botão "Remover"
- Novo componente `visual-signature-history-modal.tsx` — modal de restore (separado de `logo-restore-modal.tsx`, que lida com brand_assets, não visual_signatures)
- `VisualSignatureApprovalModal` — reutilizado no fluxo "Alterar" (abre modal com nova geração)

**Detalhes do fluxo "Alterar":**
1. Usuário clica "Alterar" no Step 2
2. Chama `generate-without-logo` para criar nova signature `draft`
3. Abre `VisualSignatureApprovalModal` com a nova draft
4. Se aprova: signature active anterior → `archived`, nova signature → `active`
5. Se fecha sem aprovar: draft preservada, signature active original permanece

---

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Signatures sem metadata (pré-feature):** Assinaturas visuais existentes não têm `input_snapshot` nem `content_used`. Restore e drift validation não funcionam. | Comportamento conservador: restore bloqueado para signatures antigas. UI exibe alerta orientando nova geração. |
| **Corrida no approve + restore concorrente:** Duas requisições podem tentar ativar signatures diferentes simultaneamente. | Índice único parcial `(store_id) WHERE status = 'active'` em `store_visual_signatures` previne duplicatas. Segunda req falha com erro de unique constraint. |
| **Profile reconciliation complexa:** Lógica de outdated/synced espalhada em 4 pontos diferentes (approve, restore vs, upload logo, remove vs). | Função `reconcileProfiles` centralizada com parâmetros explícitos. Cada transição chama a mesma função com opções diferentes. |
| **UI modal de restore replica lógica do logo restore:** `visual-signature-history-modal.tsx` pode duplicar layout e lógica de `logo-restore-modal.tsx`. | Aceito: restore de logo e restore de VS têm efeitos diferentes (logo mexe com brand_assets + BrandDirector; VS mexe com visual_signatures + brand profile existente). Reuso causaria mais acoplamento que duplicação. |
| **Drift falso positivo:** `input_snapshot` pode diferir da store por campos que não afetam a direção visual (ex: capitalização do nome). | Comparação case-sensitive e exata. Se houver ruído, restore é bloqueado e usuário é orientado a gerar nova assinatura. Melhoria futura: diff semântico. |
| **DELETE vs POST /logo race:** Usuário remove VS e imediatamente faz upload de logo em requisições concorrentes. | `identity_state` é lido no início do POST /logo. Se a remoção ainda não tiver persistido, POST recusa. Retry do lado do cliente resolve. |
