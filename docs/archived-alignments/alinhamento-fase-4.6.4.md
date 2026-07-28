# Alinhamento Fase 4.6.4 — Visual Signature Lifecycle

## Nomenclatura das Fases 4.6

```
4.6  — Store Form Adjusts                    (fase mãe)
 ├── 4.6.1 — Text Only Coverage              (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection (concluída)
 ├── 4.6.3 — Logo State Lifecycle            (concluída)
 ├── 4.6.4 — Visual Signature fluxo          ← esta fase
 └── 4.6.x — Transições entre estados        (pendente)
```

Esta fase (4.6.4) trata do ciclo de vida completo da assinatura visual: geração, aprovação, rejeição com feedback, alteração, remoção, restore/reaplicação e detecção de drift.

> **Arquitetura de prompt fora de escopo:** A fase não discute 1 passo vs 2 passos nem muda o fluxo de geração. O prompt atual já retorna imagem + JSON mínimo de metadados (`content_used`) como contrato de suporte ao lifecycle. Nesta fase, o sistema apenas consome esse metadado para validar drift.

---

## Propósito

1. Implementar o lifecycle completo de `identity_state = 'visual_signature'` (gerar, aprovar, rejeitar, alterar, remover, restaurar)
2. Garantir integridade dos estados nas transições com `logo` e `text_only`
3. Implementar detecção de drift crítico para assinaturas visuais, diferenciando regeneração de realinhamento de identidade

---

## Descoberta: O Fluxo Real de Geração (Rastreio no Código)

```
ATTEMPT 1 (generate-without-logo/route.ts:153-167):
  StoreIdentityArtDirectorService.generate()
    → carrega store-identity-art-director.md (86 linhas, instrução de imagem + JSON metadata)
    → passa como customPrompt para AiImageGenerator.generate()

  AiImageGenerator.generate() (ai-image-generator.ts:171-193):
    → usa OpenAI Responses API com ferramenta de geração de imagem
    → response.output contém image_generation_call + message com JSON
    → Persistir JSON mínimo de metadados retornado em `metadata.artDirectorOutput`
       (content_used, visual_direction, palette)

  identity-art-director.ts:79-84:
    → artDirectorOutput atualmente HARCODED
    → Consumir JSON retornado pela IA e persistir em metadata.artDirectorOutput

ATTEMPT 2 (retry, generate-without-logo/route.ts:170-226):
  AiImageGenerator.generate() COM simplifiedPrompt=true
    → usa visual-signature-generator.md (prompt simplificado, sem JSON de retorno)
    → content_used assume valores conservadores (todos os campos disponíveis como usados)

PÓS-APROVAÇÃO (approve/route.ts:170-189):
  BrandProfilerWithoutLogoService.generate()
    → carrega store-brand-profiler.md
    → ENVIA para GPT-4.1 COM A IMAGEM (visão)
    → extrai cores, estilo, tom, personalidade
```

---

## Decisões

### Decisão: Contrato de Metadados da Assinatura

**Pré-condição já implementada:** O prompt `store-identity-art-director.md` foi ajustado para retornar um JSON com o campo `content_used`:

```json
{
  "visual_direction": "acolhedora, artesanal e infantil premium",
  "content_used": {
    "store_name": true,
    "city": false,
    "state": false,
    "slogan": true
  },
  "visual_elements": [...],
  "intended_palette": {...},
  "color_usage": {...}
}
```

**Tarefas da fase (consumo, não redesign de prompt):**

1. Extrair o JSON do `response.output.message` e armazenar em `signature.metadata.artDirectorOutput.content_used` (se ainda não persistido)
2. Usar `content_used` na validação de drift: se um campo mudou mas não foi usado na composição, não há necessidade de regenerar a assinatura — apenas realinhar o brand profile

Na segunda tentativa (retry com prompt simplificado), que não retorna JSON estruturado, o `content_used` é inferido por heurística conservadora: todo campo disponível no input é marcado como `true`.

### Decisão: Global Limit de 3 Gerações por Store

Já implementado via `COUNT` total de signatures na tabela `store_visual_signatures`, filtrando tipos gerados por IA (`ai_generated`, `automatic_generated`), independentemente de status (`draft`, `active`, `archived`).

Restore/reaplicação de assinatura existente não consome geração.
Realinhamento de identidade sem nova imagem não consome geração.
Somente nova imagem de assinatura visual consome geração.

Trocar entre versões aprovadas é ilimitado. Atingiu o limite? Bloqueado para futura implementação de créditos (monetização).

### Decisão: Drift crítico vs consumo de geração

Nem todo drift consome geração. A regra separa realinhamento de identidade (sem nova imagem) de regeneração de assinatura visual (nova imagem).

A decisão depende de:
- O campo alterado
- Se o campo foi efetivamente usado na assinatura (`content_used`)

> **Mapping:** `input_snapshot.name` é validado contra `content_used.store_name`. Por regra de produto, `name` é sempre crítico mesmo se o metadata vier ausente.

| Campo alterado | Se usado na assinatura | Consome geração? |
|---|---|---|
| `name` | Sempre usado | Sim |
| `segment` | Sempre crítico (direção visual) | Sim |
| `city` / `state` | `content_used.city === true` ou `content_used.state === true` | Sim, condicional |
| `city` / `state` | ambos false | Não |
| `slogan` | `content_used.slogan === true` | Sim, condicional |
| `slogan` | `content_used.slogan === false` | Não |
| `subsegment` | N/A (não compõe imagem) | Não |
| `tone_of_voice` | N/A (não compõe imagem) | Não |
| `positioning` | N/A (não compõe imagem) | Não |
| `short_description` | N/A (não compõe imagem) | Não |
| `brand_color` / `accent_color` | Ajuste livre de campanha/identidade | Não |

Para assinaturas existentes sem `content_used` (criadas antes desta feature): comportamento conservador — assume que todos os campos foram usados.

Quando a política de créditos existir, nova geração após o limite será liberada por crédito ou franquia de plano.

### Decisão: Assinatura ativa resolvida por status, não FK em stores

A assinatura ativa é determinada por `store_visual_signatures.status = 'active'`.

A tabela `store_visual_signatures` garante no máximo uma assinatura ativa por loja via índice único parcial:
```sql
CREATE UNIQUE INDEX ON public.store_visual_signatures (store_id) WHERE status = 'active';
```

Não há coluna `visual_signature_id` em `stores`. A store referencia a assinatura ativa apenas através do índice único parcial na tabela `store_visual_signatures`.

### Decisão: Remove não destrói

DELETE /visual-signature:
1. Arquiva signature ativa (status → 'archived')
2. Seta `identity_state = 'text_only'`
3. Seta `logo_status = 'explicit_none'`
4. Profiles são preservados para histórico/reuso, mas seu status deve ser reconciliado (`synced` vs `outdated`) conforme o novo `identity_state`
5. Preserva contador de tentativas (`visual_signature_attempts`)
6. **Não deleta** registros — apenas arquiva

### Decisão: Transições de estado devem reconciliar brand_profile ativo

A remoção de logo ou assinatura visual não deleta brand profiles, mas a ativação de um novo tipo de identidade deve garantir que apenas o brand profile compatível com o estado atual permaneça `synced`.

Regras:

- **Ao remover visual signature:**
  - Arquiva `store_visual_signatures.active`
  - Seta `identity_state = 'text_only'`
  - Manter o profile `without_logo` como `synced` é uma decisão **intencional** de fallback em text_only, não um erro de transição. A partir do momento em que o usuário aplica logo, esse `without_logo` deve virar `outdated`.

- **Ao aplicar/uploadar logo:**
  - Só permitido a partir de `text_only`. Se `identity_state = 'visual_signature'`, `POST /logo` recusa.
  - Marca profiles `without_logo`/`text_only` anteriores como `outdated`
  - Cria ou reativa profile `logo_analysis` como `synced`
  - Seta `identity_state = 'logo'`

- **Ao remover logo:**
  - Arquiva assets ativos
  - Seta `identity_state = 'text_only'`
  - Mantém o profile `logo_analysis` como `synced` como fallback em text_only; ele só vira `outdated` quando uma nova identidade/direção assumir (ex.: upload de novo logo, aprovação de VS).

- **Ao restaurar/aprovar visual signature:**
  - **Ordem obrigatória:** 1) marcar outros profiles `synced` da store como `outdated`; 2) reativar/criar o profile compatível como `synced`. Isso evita violação de unicidade (índice único `(store_id) WHERE status = 'synced'`) e vazamento de direção antiga.
  - Reusa/cria profile `without_logo` da assinatura como `synced`
  - Seta `identity_state = 'visual_signature'`

### Decisão: Approval seta identity_state

O endpoint `approve` atualmente NÃO seta `identity_state = 'visual_signature'` na store. Deve setar. Isso corrige a UI do Step 2 que não sabe que existe uma assinatura aprovada.

### Decisão: Não há upload direto de logo com visual signature ativa

Se `identity_state = 'visual_signature'`, o Step 2 não exibe drop zone nem ação de upload de logo (já implementado na UI).

Para aplicar um logo, o usuário deve primeiro remover a assinatura visual ativa:

1. `DELETE /visual-signature` — arquiva assinatura ativa, seta `identity_state = 'text_only'`
2. Mantém o brand profile `without_logo` como `synced` temporariamente como fallback em text_only
3. A partir de `text_only`, o usuário pode fazer upload de logo
4. `POST /logo` cria/ativa profile `logo_analysis` como `synced` e marca profiles incompatíveis anteriores como `outdated`
5. Seta `identity_state = 'logo'`

**Validação de backend:** `POST /logo` deve recusar upload quando `identity_state = 'visual_signature'`:

```json
{
  "error": "Remova a assinatura visual ativa antes de enviar um logotipo.",
  "requires_identity_removal": true,
  "current_identity_state": "visual_signature"
}
```

### Decisão: identity_state='visual_signature' → "Alterar" e "Remover"

Quando `identity_state = 'visual_signature'`, o Step 2 exibe:
- Preview da assinatura visual
- Botão "Alterar" (abre modal de alteração com nova geração)
- Botão "Remover" (arquiva assinatura, volta text_only)
- **Drop zone oculto** (não pode fazer upload enquanto assinatura ativa)
- **"Não tenho logo" oculto**
- **"Continuar sem logo" oculto**

### Decisão: Visual Signature ativa + cores

O usuário pode alterar cores mesmo com assinatura ativa. As cores não invalidam a assinatura (podem ser consideradas como contexto leve em campanhas, não na assinatura em si). O campo `brand_colors_chosen` continua editável.

### Decisão: Histórico evolui rota existente

Em vez de criar `GET /api/store/[id]/visual-signature/history`, evoluir a rota existente `GET /api/store/[id]/visual-signature` para servir como listagem/histórico de assinaturas visuais. A rota atual já lista signatures por store_id com suporte a filtros.

---

## Transições de Estado

```
                    ┌─────────────┐
                    │  text_only  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
           ┌──────┐  ┌──────────┐  ┌─────────┐
           │ logo │  │visual_sig│  │ text... │
           └──┬───┘  └───┬──────┘  └─────────┘
              │          │
              │          │
              └──────────┘
              Remove/Archive
                    │
                    ▼
              ┌─────────────┐
              │  text_only  │
              └─────────────┘
```

**Regras:**
- `text_only ↔ logo`: via upload/remove de logo
- `text_only ↔ visual_signature`: via gerar/arquivar assinatura
- `logo` → `text_only`: remove logo (assets archived, profile mantido para reuso mas status reconciliado)
- `visual_signature` → `text_only`: arquiva assinatura (profile mantido para reuso mas status reconciliado)
- `logo` ↔ `visual_signature`: **sempre via text_only** (não há transição direta entre identidades ativas)

---

## Nomenclatura de estado

Para evitar ambiguidade entre os diferentes significados de "ativo" no sistema:

| Termo | O que significa | Onde |
|-------|----------------|------|
| `identity_state = 'visual_signature'` | A loja está usando assinatura visual como identidade atual | `stores` |
| `store_visual_signatures.status = 'active'` | Existe um ativo de assinatura visual atualmente aplicado | `store_visual_signatures` |
| `store_brand_profiles.status = 'synced'` | Este brand profile governa a direção visual das campanhas | `store_brand_profiles` |
| `source = 'without_logo'` + `visual_signature_id` | Profile derivado de uma assinatura visual | `store_brand_profiles` |

**Implicação prática:** Uma assinatura visual pode estar `archived` enquanto seu profile derivado continua `synced` como fallback em `text_only`. Esses dois estados são independentes e essa separação é intencional.

**Regra de validação para `POST /logo`:** A decisão de permitir ou recusar upload é baseada em `stores.identity_state`, não no status do profile:
- Se `identity_state = 'visual_signature'` → recusar upload
- Se `identity_state = 'text_only'` → permitir upload
- Antes de ativar `logo_analysis` como `synced`, marcar profiles incompatíveis atualmente `synced` como `outdated`

---

## Modelo de Dados

### stores

| Campo | Tipo | Uso nesta fase |
|-------|------|----------------|
| `identity_state` | `text` | 'visual_signature' setado no approve |
| `visual_signature_attempts` | `int` | Contador (já existe) |
| `logo_status` | `text` | 'generated' setado no approve |

Nenhuma migration nova. A assinatura ativa é resolvida por `store_visual_signatures.status = 'active'`.

### store_visual_signatures

| Campo | Status | Uso |
|-------|--------|-----|
| `status` | `active`, `archived`, `draft` | Lifecycle |
| `store_id` | FK | Dono |
| `asset_url` | text | URL da imagem gerada |
| `type` | text | `ai_generated`, `automatic_generated`, `fallback_typographic` |
| `generation_mode` | text | `user_choice`, `automatic`, `fallback` |
| `metadata` | jsonb | Metadados: artDirectorOutput, input_snapshot, content_used |
| `prompt` | text | Prompt usado na geração |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Data de atualização |

Schema existente. Nenhuma migration nova. O campo `metadata` já existe e é usado para armazenar `artDirectorOutput`, `generation_tier`, etc.

**Estrutura do metadata enriquecido:**
```json
{
  "generation_tier": "image_direct",
  "input_snapshot": {
    "name": "string",
    "segment": "string",
    "subsegment": "string | null",
    "tone_of_voice": "string | null",
    "positioning": "string | null",
    "short_description": "string | null",
    "slogan": "string | null",
    "city": "string | null",
    "state": "string | null",
    "brand_color": "string | null"
  },
  "artDirectorOutput": {
    "visual_direction": "string",
    "content_used": {
      "store_name": "boolean",
      "city": "boolean",
      "state": "boolean",
      "slogan": "boolean"
    },
    "visual_elements": ["string"],
    "intended_palette": { ... },
    "color_usage": { ... }
  }
}
```

### store_brand_profiles

| Campo | Status | Uso |
|-------|--------|-----|
| `visual_signature_id` | uuid (FK) | FK para store_visual_signatures (já existe na tabela) |
| `active_logo_asset_id` | uuid (FK) | Proveniência — NUNCA nullado após setado |

---

## Fluxo de Geração (generate-without-logo)

```
POST /api/store/[id]/visual-signature/generate-without-logo

1. Verifica limite: COUNT total de signatures por store_id, filtrando
   type IN ('ai_generated', 'automatic_generated'), independente de status
   Se >= 3 → bloqueado
2. Se já existe signature draft pendente para a store:
   → marca como 'archived' (arquivar draft anterior não consome quota adicional; a nova imagem gerada consome quota normalmente)
3. Captura rejection_feedback se houver (opcional)
4. Executa StoreIdentityArtDirectorService.generate():
   → identity-art-director.md (86 linhas) → modelo de imagem
   → Extrai JSON do response.output.message:
     { content_used, visual_direction, intended_palette, ... }
   → content_used alimenta metadata.artDirectorOutput
   → Snapshot dos dados da store salvo em metadata.input_snapshot
5. Se attempt 1 falhar:
   → retry com visual-signature-generator.md (prompt simplificado)
   → content_used inferido por heurística conservadora (tudo true)
6. Cria store_visual_signatures com status='draft'
7. Incrementa visual_signature_attempts
   (Nota: geração bem-sucedida já consome quota, mesmo que o usuário feche sem aprovar. O limite conta drafts, actives e archiveds — a imagem foi gerada, o custo ocorreu.)
8. Retorna { signature, preview_url, art_direction }
```

---

## Fluxo de Aprovação (approve)

```
POST /api/store/[id]/visual-signature/approve

1. Carrega signature pertencente à store
2. Arquiva assinatura active anterior, se houver
3. Seta assinatura escolhida como 'active'
4. Atualiza stores:
   ├── identity_state = 'visual_signature'
   ├── logo_status = 'generated'
   └── visual_signature_attempts = 0 (reset opcional)
5. Reusa brand profile existente para a assinatura, se houver
   (já implementado: busca por visual_signature_id em store_brand_profiles)
6. Se não houver profile, executa BrandProfilerWithoutLogoService
```

**FIX:** identity_state NÃO está sendo setado no approve atualmente.

---

## Fluxo de Rejeição (com feedback)

O feedback já é coletado no modal de aprovação (fase "feedback"). O `rejectionContext` é passado para `generate-without-logo`. Mas:

- Na fase "review" do modal (que lista signatures existentes), o `generate()` é chamado **sem rejection context** — o feedback da fase anterior não é propagado
- **Ação:** garantir que o feedback da fase "feedback" seja passado para o `generate()` na fase "review"

---

## Fluxo de Remoção

```
DELETE /api/store/[id]/visual-signature

1. Carrega assinatura ativa
2. Seta status = 'archived'
3. Atualiza stores:
   ├── identity_state = 'text_only'
   ├── logo_status = 'explicit_none'
   └── visual_signature_attempts PRESERVADO (não reseta)
4. store_brand_profiles PRESERVADO para reuso, mas status reconciliado conforme novo identity_state
```

---

## Fluxo de Histórico

A rota existente `GET /api/store/[id]/visual-signature` é evoluída para servir como listagem/histórico:

```
GET /api/store/[id]/visual-signature

Response:
{
  "signatures": [
    {
      "id": "uuid",
      "status": "archived" | "active",
      "assetUrl": "...",
      "type": "ai_generated" | "automatic_generated",
      "attempt": 1,
      "created_at": "...",
      "approved_at": "...", // opcional, derivado de updated_at quando status virou active (não há coluna explícita)
      "art_direction": {
        "visual_direction": "moderno e clean",
        "content_used": {
          "store_name": true,
          "city": false,
          "slogan": true
        },
        "intended_palette": { ... }
      }
    }
  ]
}
```

A evolução adiciona: `approved_at`, `art_direction` (com `content_used`), e metadados de geração.

---

## Fluxo de Restore/Reaplicação

```
POST /api/store/[id]/visual-signature/restore
Body: { signature_id: "uuid" }

1. Valida que a assinatura pertence à store
2. Se já estiver active, no-op
3. Arquiva assinatura active atual, se houver
4. Seta assinatura escolhida como active
5. Atualiza stores:
   ├── identity_state = 'visual_signature'
   └── logo_status = 'generated'
6. Reusa brand profile existente da assinatura, se houver
7. Não consome geração
```

**Drift validation no restore:**

Antes de restaurar, verificar se os dados críticos da loja mudaram desde a geração:

```
input_snapshot = signature.metadata.input_snapshot
current = dados atuais da store
content_used = signature.metadata.artDirectorOutput.content_used

Se input_snapshot.name != current.name:
  → Drift crítico (nome sempre usado) → alerta, restore bloqueado
Se input_snapshot.segment != current.segment:
  → Drift crítico (segmento sempre crítico) → alerta, restore bloqueado
Se input_snapshot.city != current.city && content_used.city === true:
  → Drift condicional → alerta, restore bloqueado
Se input_snapshot.slogan != current.slogan && content_used.slogan === true:
  → Drift condicional → alerta, restore bloqueado
```

**Regra:** Se houver drift crítico, o restore não deve ser aplicado silenciosamente. O sistema exibe alerta informando que os dados da loja mudaram desde a geração e orienta o usuário a gerar uma nova assinatura. Somente se o usuário confirmar a nova geração, um crédito/geração é consumido.

**Resposta esperada do endpoint em caso de drift:**

```json
{
  "success": false,
  "drift": {
    "critical": true,
    "fields": ["name", "segment"],
    "requires_regeneration": true
  }
}
```

Isso permite que a UI saiba se deve mostrar alerta, bloquear restore ou abrir fluxo de nova geração.

Para signatures sem `content_used` ou `input_snapshot` (pré-feature): comportamento conservador — assume drift em todos os campos.

---

## Fluxo de "Alterar" (abrir modal com draft novo)

```
User clica "Alterar" no Step 2 (identity_state='visual_signature')

1. Cria nova signature com status='draft'
   (nova geração independente)
2. Abre modal de aprovação (reutilizar visual-signature-approval-modal.tsx)
3. Fluxo normal: display → feedback → review → approve

Se usuário fecha sem aprovar:
  → draft é preservado (ou limpo em background)
  → signature active original permanece ativa

Se usuário aprova:
  → signature active original → 'archived'
  → nova signature → 'active'
```

---

## UI — Step 2

### Estado: visual_signature ativo

```
┌──────────────────────────────────────────────────┐
│  Identidade Visual                               │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │         [preview da assinatura]      │        │
│  │                                      │        │
│  │    [Alterar]  [Remover]              │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  ✓ Assinatura visual ativa                       │
│                                                  │
│  Cor Principal                                   │
│  [■]  [#C41E3A]                                 │
│                                                  │
│  Cor de Destaque (opcional)                      │
│  [■]  [#000000]                                  │
│                                                  │
│  [Salvar]                                        │
└──────────────────────────────────────────────────┘
```

**OCULTOS:** drop zone, upload, "Não tenho logo", "Continuar sem logo".

### Estado: após arquivar (volta text_only)

```
┌──────────────────────────────────────────────────┐
│  Identidade Visual                               │
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
│  ✓ Direção visual definida pelo Vendeo           │
│                                                  │
│  Assinaturas anteriores (1)                      │
│                                                  │
│  [Salvar]                                        │
└──────────────────────────────────────────────────┘
```

**"Assinaturas anteriores"** link exibe modal de histórico/restore de assinaturas visuais.

> **Importante:** O modal de restore de logo (`logo-restore-modal.tsx`) não deve ser reaproveitado sem adaptação. Restore de logo e restore de assinatura têm efeitos diferentes: logo mexe com `store_brand_assets` e roda `BrandDirectorService`; assinatura visual mexe com `store_visual_signatures` e reaproveita brand profile existente.

---

## Endpoints

| Método | Rota | Estado | Mudanças |
|--------|------|--------|----------|
| `POST` | `/api/store/[id]/visual-signature/generate-without-logo` | **Ajustado** | Extrair JSON do response.output (content_used); salvar input_snapshot |
| `POST` | `/api/store/[id]/visual-signature/approve` | **Corrigir** | +identity_state='visual_signature', +logo_status='generated' |
| `DELETE` | `/api/store/[id]/visual-signature` | **NOVO** | Arquiva signature, volta text_only |
| `GET` | `/api/store/[id]/visual-signature` | **Evoluído** | Serve como listagem/histórico (em vez de criar /history) |
| `POST` | `/api/store/[id]/visual-signature/restore` | **NOVO** | Restaura signature archived como active |
| `POST` | `/api/store/[id]/logo` | **Alterado** | Recusar se identity_state='visual_signature'. Usuário deve remover VS antes. |

---

## Fora de Escopo (microfase futura)

| Item | Motivo |
|------|--------|
| Decisão 1-passo vs 2-passos de prompt | Ortogonal ao lifecycle. Microfase após consolidar lifecycle. |
| Consumo das cores/visual_elements na geração de campanha | Fase futura de refinamento de campanha |
| Refinamento do prompt `store-identity-art-director.md` | Microfase separada de otimização de prompt |
| Créditos para gerações extras (limite 3) | Monetização, produção |
| Correção de `brand_colors_chosen` populado com `logo_colors_detected` | 4.6.1 postergada |
| Divergência de cor (store-preview vs color picker) | Pós-aprovação, bug separado |
| Preview refresh pós-aprovação sem reload | UX, separado do lifecycle |
| Otimização semântica do input_snapshot vs content_used | Pode ser refinado conforme uso real |

---

## Pendências Técnicas (conhecidas)

1. **approve não seta identity_state='visual_signature'** — `approve/route.ts` não atualiza `identity_state` na store. UI não reflete estado correto.
2. **DELETE /visual-signature não existe** — rota de arquivamento precisa ser criada.
3. **restore/reaplicação de visual signature não existe** — rota de restore precisa ser criada.
4. **POST /logo deve recusar upload quando `identity_state = 'visual_signature'`** — atualmente não valida e pode corromper o estado.
5. **Step 2 ainda depende demais de logo_status** — precisa usar `identity_state` como fonte primária de estado visual.
6. **Histórico de assinatura visual ainda não está separado do histórico de logo** — atualmente o modal de histórico só trata `store_brand_assets` (logos).
7. **Feedback/rejeição precisa preservar contexto quando gerar nova versão** — `rejectionContext` não é propagado na fase "review" do modal.
8. **Drift crítico deve diferenciar realinhamento vs regeneração** — implementar tabela de decisão com `content_used`.
9. **Transições para nova identidade precisam marcar brand profiles incompatíveis como `outdated`** — remover logo/VS pode manter o profile anterior como `synced` fallback em `text_only`, mas ele não pode permanecer `synced` quando outro estado assumir (ex.: upload de novo logo ou aprovação de VS).

---

## Matriz de Decisão de UX (Step 2)

| identity_state | Preview | Ação principal | Drop zone | Não tenho logo | Continuar sem logo | Histórico |
|---|---|---|---|---|---|---|
| `text_only` | Direção visual | Enviar logo / Criar assinatura | Sim | Sim / Criar assinatura | Não, se direção já existe | Assinaturas anteriores, se houver |
| `logo` | Logo ativo | Remover logo | Não | Não | Não | Logos anteriores, se houver |
| `visual_signature` | Assinatura ativa | Alterar / Remover | Não | Não | Não | Assinaturas anteriores, se houver |

---

## Estratégia de Implementação

**Ordem sugerida (dados primeiro, dependências respeitadas):**

1. Corrigir approve: setar `identity_state = 'visual_signature'` e `logo_status = 'generated'`
2. Persistir `content_used` + `input_snapshot` no metadata da geração (dados necessários para drift)
3. Criar `DELETE /visual-signature` — arquivar signature, voltar text_only, reconciliar brand_profiles
4. Evoluir `GET /visual-signature` como histórico/listagem
5. Criar `POST /visual-signature/restore` com validação de drift e reconciliação de brand_profiles
6. Alterar `POST /logo` — recusar upload quando `identity_state = 'visual_signature'`, reconciliar brand_profiles incompatíveis
7. Ajustar `DELETE /logo` para manter `logo_analysis` como `synced` fallback em text_only; ele só vira `outdated` quando uma nova identidade assumir
8. Ajustar Step 2 para usar `identity_state` como fonte primária
9. Implementar UI de assinatura ativa: preview, Alterar, Remover
10. Implementar histórico/reaplicação de assinaturas (modal separado de logo)
11. Garantir feedback em nova geração pós-rejeição
12. Documentar drift crítico e consumo de geração

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-06-16 | Arquitetura de prompt (1 vs 2 passos) é ORTOGONAL ao lifecycle. Deferida para microfase separada. |
| 2026-06-16 | Remove não destrói: signature → archived, identity_state → text_only, profile preservado, attempts preservado. |
| 2026-06-16 | Não há upload direto de logo com VS ativa. Toda transição entre identidades passa por text_only. POST /logo recusa se identity_state='visual_signature'. |
| 2026-06-16 | identity_state='visual_signature' no Step 2: "Alterar" e "Remover" visíveis. Drop zone, upload, "Não tenho logo" ocultos. |
| 2026-06-16 | Global limit de 3 gerações por store (COUNT total, filtra tipo IA). Trocar entre aprovadas é ilimitado. |
| 2026-06-16 | Feedback da fase "feedback" do modal não é propagado para o generate() na fase "review". Precisa ser consertado. |
| 2026-06-16 | POST /logo deve recusar quando identity_state='visual_signature'; usuário deve remover VS antes do upload. |
| 2026-06-16 | approve/route.ts não seta identity_state='visual_signature' — precisa ser corrigido. |
| 2026-06-16 | Assinatura ativa resolvida por store_visual_signatures.status='active' + unique index, NÃO por FK em stores. |
| 2026-06-17 | content_used do diretor de identidade alimenta metadata e validação de drift. Campo adicionado ao JSON de retorno. |
| 2026-06-17 | Drift crítico vs realinhamento: tabela de decisão usando content_used do Contrato de Metadados da Assinatura. |
| 2026-06-17 | Histórico evolui rota GET existente em vez de criar /history. |
| 2026-06-17 | input_snapshot armazenado no metadata da signature no momento da geração para comparação futura. |
| 2026-06-17 | Transições de estado devem reconciliar brand_profile ativo: apenas o profile compatível com o identity_state atual permanece synced. |
