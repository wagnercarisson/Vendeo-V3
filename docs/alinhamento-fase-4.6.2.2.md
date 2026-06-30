# Alinhamento Fase 4.6.2.2 — State-Specific Drift Policy

## Nomenclatura das Fases 4.6

```
4.6  — Store Form Adjusts                         (fase mãe)
 ├── 4.6.1 — Text Only Coverage                   (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection     (concluída)
 │    ├── 4.6.2.1 — Snapshot Fields Realignment   (concluída)
 │    └── 4.6.2.2 — State-Specific Drift Policy   ← esta fase
 ├── 4.6.3 — Logo State Lifecycle                 (concluída)
 ├── 4.6.4 — Visual Signature Lifecycle           (concluída)
 ├── 4.6.5 — VS Color Drift & Brand Profile       (concluída)
 ├── 4.6.6 — Identity Transition                  (concluída)
 └── 4.6.7 — User Color Preferences               (concluída)
```

---

## Propósito

A fase 4.6.2 implementou detecção de drift com política única de 4 campos (`segment`, `subsegment`, `tone_of_voice`, `name`), válida para todos os estados de identidade. A fase 4.6.2.1 expandiu o snapshot para 7 campos e preparou o terreno deixando `positioning`, `short_description` e `slogan` capturados mas inertes.

Esta fase (4.6.2.2) define **políticas de drift diferentes por estado de identidade**, introduzindo a distinção entre campos críticos (exigem nova assinatura visual) e campos sensíveis (exigem re-inferência do brand profile apenas).

---

## Modelo Conceitual — Três Categorias

```
SNAPSHOT_FIELDS (7)         DRIFT_FIELDS (por estado)         CRITICAL_FIELDS (VS)
┌──────────────────┐        ┌─────────────────────────┐       ┌─────────────────────┐
│ segment          │        │ Varia conforme estado    │       │ Só para VS:         │
│ subsegment       │        │                         │       │ name + segment      │
│ tone_of_voice    │───►    │ text_only:  7 campos   │       │ (sempre)            │
│ name             │        │ logo:       6 campos   │       │ slogan (se usado)   │
│ positioning      │        │ VS:         4 sensíveis│       │ city (se usado)     │
│ short_description│        │           + N críticos │       │ state (se usado)    │
│ slogan           │        └─────────────────────────┘       └─────────────────────┘
└──────────────────┘
     captura           →        política de drift          →      decisão de ação
```

| Camada | Função | Quantidade |
|--------|--------|-----------|
| `SNAPSHOT_FIELDS` | Capturar no metadata do brand profile | 7 campos (já implementado) |
| `DRIFT_FIELDS` | Comparar para decidir se há desalinhamento | Varia por `identity_state` |
| `CRITICAL_FIELDS` | Subconjunto do drift que exige nova VS (só para estado VS) | Até 5, depende de `content_used` |

---

## Matriz de Drift por Estado

### text_only

```
name             │  🔵 drift
segment          │  🔵 drift
subsegment       │  🔵 drift
tone_of_voice    │  🔵 drift
positioning      │  🔵 drift
short_description│  🔵 drift
slogan           │  🔵 drift
```

**Realinhamento:** re-inferência do brand profile (POST /brand-profile/realign). VS não se aplica. Não há conceito de crítico vs sensível — qualquer campo alterado dispara drift simples.

### logo

```
name             │  —
segment          │  🔵 drift
subsegment       │  🔵 drift
tone_of_voice    │  🔵 drift
positioning      │  🔵 drift
short_description│  🔵 drift
slogan           │  🔵 drift
```

**`name` propositalmente fora.** O logo é um arquivo enviado pelo usuário — se o nome da loja mudou, o usuário deve enviar um novo logo com o nome atualizado. O sistema não pode corrigir isso automaticamente.

**Realinhamento:** re-inferência do brand profile (POST /brand-profile/realign).

### visual_signature

```
name             │  🔴 CRÍTICO  (sempre)
segment          │  🔴 CRÍTICO  (sempre)
subsegment       │  🟡 sensível
tone_of_voice    │  🟡 sensível
positioning      │  🟡 sensível
short_description│  🟡 sensível
slogan           │  🔴 CRÍTICO  se content_used.slogan = true
city             │  🔴 CRÍTICO  se content_used.city = true
state            │  🔴 CRÍTICO  se content_used.state = true
```

**Prioridade:** 🔴 crítica > 🟡 sensível. Se houver campo crítico alterado, o fluxo excepcional de substituição da VS (ver abaixo) resolve ambos — a nova VS gera novo brand profile. **Porém, a remoção isolada da VS não resolve o drift sensível** — ela apenas leva a loja a `text_only`, onde os 7 campos continuam como drift do brand profile.

**Realinhamento sensível:** re-inferência do brand profile (POST /brand-profile/realign). VS existente mantida.

**Realinhamento crítico (substituição excepcional):** geração de nova VS como draft + aprovação → arquivamento da anterior + ativação da nova + novo brand profile. Disponível apenas quando o drift crítico é revalidado pelo backend. O fluxo depende de disponibilidade de créditos de geração. Sem créditos, o modal alerta sobre o limite e oferece remoção ou manutenção.

---

## Fluxo de Save no Step 2

### Diagnóstico independente de drift

O `computeDriftStatus` existente (baseado nos 7 campos do brand profile) NÃO detecta city/state. O diagnóstico passa a ser independente:

```
sensitiveDrift  = evaluateSensitiveDrift(brandProfileSnapshot, store)  // 7 campos do BP
criticalDrift   = evaluateCriticalDrift(vsInputSnapshot, contentUsed, store)  // VS snapshot

driftCategory = criticalDrift ? 'critical'
             : sensitiveDrift ? 'sensitive'
             : 'none'
```

Para estados `text_only` e `logo`, `criticalDrift` é sempre `false` — só existe drift sensível ou nenhum.

### Precedência: combinação de driftStatus, driftCategory e dismiss

A precedência completa para decidir qual modal abrir:

```
1. critical + new       → DriftCriticalModal (com crédito ou sem)
2. sensitive + new      → DriftDecisionModal
3. critical + dismissed → DriftDecisionModal (só se houver sensitive + new)
4. sensitive + dismissed → nenhum modal, sem badge
5. none                 → salva direto
```

**Caso crítico:** Se `driftCategory = 'critical'` foi dismissado mas `driftStatus = 'new'` para campos sensíveis, o DriftDecisionModal (sensível) deve abrir — o dismiss crítico não bloqueia drift sensível novo.

**Caso sensível puro:** Se só `driftCategory = 'sensitive'` com `driftStatus = 'new'`, abre DriftDecisionModal normalmente.

**Ambos novos:** `critical` tem precedência — abre DriftCriticalModal. O drift sensível será resolvido junto se a substituição for concluída.

### Classificação no Save

```
User clica Salvar (Step 2)

  ┌──────────────────────────────────────────────────────────────┐
  │ identity_state = 'visual_signature'?                         │
  │   ├── Sim                                                    │
  │   │   criticalDrift = evaluateCriticalDrift(VS)             │
  │   │   sensitiveDrift = evaluateSensitiveDrift(BP)           │
  │   │   ├── criticalDrift → driftCategory = 'critical'        │
  │   │   ├── só sensitiveDrift → driftCategory = 'sensitive'   │
  │   │   └── nenhum → salva direto                             │
  │   │                                                          │
  │   └── Não (text_only / logo)                                │
  │       computeDriftStatus → driftStatus = 'new'?             │
  │         ├── Sim → drift simples (sensitive)                  │
  │         └── Não → salva direto                              │
  └──────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
            drift simples          drift crítico (VS)
                   │                     │
            ┌──────▼──────┐    ┌─────────▼──────────────────────────────┐
            │DriftDecision │    │ DriftCriticalModal                     │
            │Modal         │    │                                         │
            │              │    │ "Sua assinatura visual pode estar       │
            │[Realinhar]   │    │  desatualizada porque dados centrais   │
            │ → realinhar  │    │  da loja mudaram."                      │
            │[Manter]      │    │                                         │
            │ → ignorar    │    │ ── Com crédito (< 3 assinaturas) ──   │
            │[Cancelar]    │    │ [Atualizar assinatura visual] ← primário│
            └──────────────┘    │  → abre ApprovalModal com              │
                                │    mode: 'substitution'                │
                                │  → modal chama generate-without-logo   │
                                │    (rota revalida drift server-side)   │
                                │  → geração OK → fase display           │
                                │  → aprova → archive antiga + activate  │
                                │           + gera BP → drift resolvido  │
                                │  → rejeita → feedback → retry (até 3)  │
                                │                                         │
                                 │ ── Sem crédito (>= 3 assinaturas) ──   │
                                 │ "Você já usou as 3 gerações. Se remover│
                                 │  esta assinatura, não poderá gerar nova│
                                 │  até compra de créditos disponível."   │
                                 │ [Manter direção atual] ← primário      │
                                 │ [Remover mesmo assim] ← destrutivo     │
                                 │  → confirmação → DELETE VS → text_only │
                                 │ [Comprar créditos — Em breve] desab.   │
                                 │                                         │
                                 │ ── Ações comuns ──                     │
                                 │ [Manter direção atual]                 │
                                 │  → ignorar drift + salva               │
                                 │ [Cancelar] → volta Step 2              │
                                └─────────────────────────────────────────┘
```

### Fluxo de Realinhamento Sensível

```
User clica [Realinhar] no DriftDecisionModal
  ↓
POST /brand-profile/realign
  ↓
  Backend seleciona estratégia por identity_state:
  │
  ├── text_only → inferência textual (caminho atual)
  │   ├── source = 'text_only', identity_state = 'text_only'
  │   ├── Sucesso → snapshot atualizado + drift resolvido
  │   └── Falha → alerta + retry/manter
  │
  ├── logo → Brand Director (caminho atual)
  │   ├── source = 'logo_analysis', identity_state = 'logo'
  │   ├── Sucesso → snapshot atualizado + drift resolvido
  │   └── Falha → alerta + retry/manter
  │
  └── visual_signature → profiler VS modo regenerate
      ├── Localiza VS ativa
      ├── Re-infere perfil vinculado (source = 'without_logo')
      ├── Preserva identity_state = 'visual_signature'
      ├── Preserva visual_signature_id
      ├── Profiler em modo 'regenerate' (não reusa perfil existente)
      ├── Preserva content_used e metadados da VS no BP
      ├── Sucesso → snapshot atualizado + drift resolvido
      └── Falha → alerta + retry/manter (VS existente mantida)

**Importante:** O cliente não seleciona a estratégia. O backend decide automaticamente por `identity_state`. A rota existente atualmente cria perfil `source: text_only` para text_only/logo — o novo caminho para `visual_signature` usa o profiler com `mode: 'regenerate'`.

### Substituição Excepcional (drift crítico VS — com crédito)

```
DriftCriticalModal → [Atualizar assinatura visual]
  ↓
Abre VisualSignatureApprovalModal com mode: 'substitution'
  ↓
Modal inicia em checking (igual fluxo normal)
  ↓
User confirma → modal chama POST /generate-without-logo
  ├── Rota revalida drift crítico server-side
  │   ├── Drift não confirmado → erro + fallback para sensível
  │   └── Drift confirmado → gera nova VS como DRAFT
  │                           (VS atual CONTINUA ATIVA)
  │
  ├── Geração OK → fase display
  │   ├── User aprova
  │   │   POST /approve com mode: 'substitution'
  │   │   ├── [TIER 1] Arquivar VS anterior  (active → archived)
  │   │   ├── [TIER 1] Ativar nova VS        (draft → active)
  │   │   │   └── Se atualização falhar → compensação testada
  │   │   ├── [TIER 2] Gerar novo brand profile (synced)
  │   │   │   └── Se falhar → nova VS PERMANECE ativa
  │   │   │       BP anterior permanece synced como fallback
  │   │   │       UI exibe warning/retry do BP
  │   │   ├── input_snapshot atualizado
  │   │   ├── drift resolvido (crítico + sensível)
  │   │   └── salva Step 2
  │   │
  │   └── User rejeita → feedback → retry (até 3 tentativas)
  │
  └── Geração falha → fase error
      ├── "Não foi possível gerar. Tente novamente."
      ├── [Tentar novamente] → retry generate
      └── [Continuar por agora] → fecha modal, ignora drift (não persiste dismiss)
```

**Dois tiers de safety:**

| Tier | O que cobre | Falha → |
|------|------------|---------|
| **Tier 1** | Geração + aprovação + troca dos ativos (archive/activate) | VS anterior PERMANECE ativa. Nada muda. |
| **Tier 2** | Geração do brand profile (pós-ativação da nova VS) | Nova VS PERMANECE ativa. BP anterior fica como fallback. Warning na UI. |

Isso reconcilia com o contrato consolidado: aprovação da VS é o ponto de corte. Depois que a nova VS é ativada, falha do profiler não a desfaz.

### Fluxo sem crédito (limite de 3 assinaturas atingido)

```
User com >= 3 assinaturas geradas com sucesso + drift crítico
  ↓
DriftCriticalModal exibe warning:
  "Você já utilizou as 3 gerações disponíveis. Se remover esta
   assinatura, não será possível gerar uma nova até que a compra
   de créditos esteja disponível."
  ↓
Opções:
  [Manter direção atual] ← primário (persiste dismiss)
    → ignorar drift + salva Step 2

  [Remover mesmo assim] ← destrutivo
    → confirmação → DELETE /visual-signature
    → identity_state → text_only
    → badge de drift some (VS não existe mais)
    → Na UI text_only, "Gerenciar assinatura visual"
      mostra [Comprar créditos — Em breve] desabilitado

  [Comprar créditos — Em breve] ← desabilitado, apenas informativo
```

### Guardas do backend no modo substitution

Antes de iniciar a substituição, o endpoint `generate-without-logo` deve validar:

1. **Loja existe** e está ativa
2. **Adquirir lock de geração por loja**; rejeitar se já houver lock ativo (evita corrida). Alternativa: verificar ausência de outro draft de substituição em andamento, identificado por `metadata.mode === 'substitution'`. **Não** bloquear por existência de drafts históricos — após aprovar uma entre três versões, as outras permanecem como draft.
3. **`identity_state = 'visual_signature'`** e existe **uma VS ativa**
4. **Drift crítico** confirmado (revalida com `drift-revalidator.ts` — não confia em estado do frontend)
5. **Limite de assinaturas** respeitado (< 3 geradas com sucesso)
6. **Compensação:** em caso de falha no Tier 1 (archive/activate), VS anterior permanece ativa e marcação de outdated é revertida

**Falha de guarda** → retorna 4xx com `code` e `userMessage` específicos. Frontend trata como erro informativo (não abre modal de substituição).

### Non-blocking em todos os cenários

Em nenhum caso o fluxo é bloqueante. O usuário sempre pode optar por:
- Manter a direção/assinatura atual e seguir
- Cancelar e voltar ao Step 2 para reverter edições
- Tentar novamente se houve falha

---

## Badge na Preview

```
┌──────────────────────────┐
│  Preview da Loja         │
│                          │
│  ┌────┐ ┌──────────────┐│
│  │icone│ │ Nome Loja    ││
│  └────┘ │              ││
│          │ ⚠ desalinhado ││  ← só quando effectiveStatus = 'new'
│          │ [tooltip]    ││
│          │ Segmento     ││
│          └──────────────┘│
│                          │
│  Cores...                │
└──────────────────────────┘
```

- **Posição:** abaixo do nome da loja, em linha própria
- **Texto:** "desalinhado"
- **Tooltip (mouseover):** "A direção visual de sua loja pode estar desatualizada. Ao clicar em salvar você terá opções para corrigir o problema."
- **Status efetivo** (combinação de critical + sensitive):

  ```typescript
  effectiveStatus =
    criticalStatus === 'new' || sensitiveStatus === 'new'
      ? 'new'
      : criticalStatus === 'dismissed' || sensitiveStatus === 'dismissed'
        ? 'dismissed'
        : 'none'
  ```

- **Exibição condicional:** `effectiveStatus === 'new'` e loja em estado definido (não é create mode)
- **Badge para dismissed:** não exibe badge. O indicador de desalinhamento dismissado fica acessível apenas via tooltip no botão "Salvar" ou na reabertura do Step 2.

---

## Fallback de Realinhamento

### Regra Geral: erro → manter

Se o realinhamento (inferência do brand profile ou geração de VS) falhar, o comportamento padrão é **manter a direção visual atual intacta**, nunca criar um estado inconsistente.

```
Realinhamento falhou
  ↓
Exibe alerta: "Não foi possível realinhar a direção visual.
               Tente novamente mais tarde."
  ↓
Opções disponíveis:
  ├── [Tentar novamente] → retry
  └── [Continuar por agora] → ignora drift, salva dados
```

**"Continuar por agora"** significa:
- A direção visual atual (brand profile + VS, se houver) permanece exatamente como está
- O drift não é marcado como ignorado (não persiste `drift_dismissed_snapshot`)
- O usuário poderá ver o badge novamente na próxima visita
- Os dados da Step 1/2 são salvos (a alteração do usuário não é descartada)

### Compensação no Backend (POST /brand-profile/realign)

A rota de realinhamento (`POST /api/store/[id]/brand-profile/realign`) DEVE aplicar a transição compensada em ambos os caminhos (logo e text_only):

1. Inferência executada **antes** de qualquer mutação no banco
2. Perfil anterior marcado como `outdated` **apenas após** inferência bem-sucedida
3. Novo perfil inserido com `status = 'synced'`
4. **Se o insert falhar ou lançar exceção**, o perfil anterior DEVE ser restaurado para `synced`

A implementação atual em `logo/route.ts:269` e `retry-brand-director/route.ts:126` segue este padrão. O realinhamento (`realign/route.ts:98` e `realign/route.ts:234`) está **incompleto** — marca como outdated mas não restaura em caso de falha no insert.

**Testes obrigatórios:**
- Compensação no caminho logo: insert falha → perfil anterior restaurado para `synced`
- Compensação no caminho text_only: insert falha → perfil anterior restaurado para `synced`
- Compensação no caminho visual_signature: insert falha → perfil anterior restaurado para `synced`
- Inferência falha: perfil anterior NÃO marcado como outdated (permanece `synced`)

---

## Sequenciamento da Implementação

A implementação deve seguir ondas obrigatórias. Cada onda exige validação automática (TypeScript, lint, build, testes) e smoke test manual antes de avançar.

### Onda 1 — Congelamento do comportamento existente

Antes de qualquer código novo, registrar e validar os contratos existentes que esta fase não pode quebrar:

- **Matriz de ações** (`useIdentityActions`): identity_state → ações permitidas. VS → geração não listada como ação normal.
- **Transições permitidas** (`identity-transitions.ts`): VS → nova VS só via remoção → text_only. A **única exceção** (substituição crítica) ainda não existe.
- **Aprovação padrão** (`approve/route.ts`): contrato `text_only → visual_signature`. VS sempre começa como draft.
- **Remoção** (`DELETE /visual-signature`): identity_state → text_only. Remover VS não resolve drift sensível do BP.
- **Limite de 3 assinaturas**: contagem de `store_visual_signatures` com `type IN ('ai_generated', 'automatic_generated')`. Tentativas falhas não contam.
- **Fallback do BP**: `logo/route.ts:269`, `retry-brand-director/route.ts:126` — compensação testada. `realign/route.ts` sem compensação (incompleto).
- Testes de regressão para cada contrato acima.

### Onda 2 — Fundação do diagnóstico
- `src/lib/drift.ts`: `evaluateCriticalDrift()`, `evaluateSensitiveDrift()`, tipo `DriftCategory`
- `src/lib/visual-signature/drift-validator.ts`: expandir com tratamento de props ausentes
- `src/lib/visual-signature/drift-revalidator.ts`: **NOVO** — revalidação server-side usando VS snapshot canônico
- Testes unitários para cada função de drift

### Onda 3 — Diagnóstico
- `src/components/flow/use-drift-detection.ts`: retornar `driftCategory` + `criticalDrift` + `sensitiveDrift` separados de `driftStatus`. Aceitar `activeVsSummary: ActiveVisualSignatureSummary \| null`
- GET /brand-profile?status=synced para o hook
- Consumir `activeVsSummary.critical_drift.status` como diagnóstico canônico (frontend não chama `restore_eligibility` diretamente)
- Smoke test: forçar city/state diferentes e confirmar que criticalDrift = true

### Onda 4 — Realinhamento sensível
- `src/app/api/store/[id]/brand-profile/realign/route.ts`: estratégia por identity_state
- `src/lib/visual-signature/brand-profiler.ts`: mode `regenerate` (não reutilizar perfil existente)
- Compensação nos três caminhos (text_only, logo, visual_signature)
- Smoke test: VS + drift sensível → realinhar → VS preservada + BP atualizado

### Onda 5 — Backend da substituição crítica
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`: mode + revalidação
- `src/app/api/store/[id]/visual-signature/approve/route.ts`: mode:'substitution' com dois tiers
- Guards do backend (lock de geração, identity_state, drift, limite, compensação)
- Smoke test: VS ativa + drift crítico → substituição → nova VS ativa + BP novo

### Onda 6 — UI e integração
- `src/components/flow/drift-decision-modal.tsx`: texto "Manter direção atual" (persiste dismiss)
- **NOVO:** `src/app/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts`: POST vazio, persiste `visual_signature_drift_dismissed_snapshot` na VS ativa
- `src/components/flow/drift-critical-modal.tsx`: **NOVO** — abre ApprovalModal com mode:'substitution'
- `src/components/flow/visual-signature-approval-modal.tsx`: mode 'standard' | 'substitution'
- `src/components/flow/store-identity-form.tsx`: bifurcação por driftCategory
- `src/components/flow/store-preview.tsx`: badge "desalinhado" (só quando `effectiveStatus === 'new'`)
- Precedência completa: critical new > sensitive new > critical dismissed > sensitive dismissed > none
- Smoke test: fluxo completo com e sem crédito

### Onda 7 — UAT formal
- UAT único ao final, cobrindo todos os cenários da matriz de drift
- Validação visual, de copy, de legibilidade e de fluxo
- Cada cenário deve passar por todas as ondas antes de ser considerado completo

---

## Modelo de Dados

Nenhuma alteração no schema do banco. O snapshot continua usando os 7 campos definidos na 4.6.2.1 em `store_brand_profiles.metadata`.

### Snapshot do Brand Profile (7 campos) — drift sensível

Armazenado em `store_brand_profiles.metadata.input_snapshot`. Usado como baseline para drift sensível em todos os estados.

| Campo | Fonte |
|-------|-------|
| `name`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan` | `buildStoreProfileInputSnapshot(store)` |

### Snapshot da VS (11 campos) — drift crítico city/state

Armazenado em `store_visual_signatures.metadata.input_snapshot` (tipo `VisualSignatureMetadataInputSnapshot`). Usado como baseline para campos críticos que não estão no brand profile snapshot — especificamente **city** e **state**.

| Campo | Fonte |
|-------|-------|
| `name`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`, **`city`**, **`state`**, `brand_color`, `accent_color` | Populado em toda geração VS (`generate-without-logo/route.ts:216-228` e `277-289`) |

O `VS input_snapshot` é a **fonte canônica** para todos os campos críticos — incluindo name, segment e slogan (não apenas city/state). Isso elimina ambiguidade de ter duas fontes.

### Como o frontend obtém o status de drift crítico da VS ativa

O GET /api/store/[id]/visual-signature retorna a VS ativa com o campo `restore_eligibility`. O contrato atual do campo:

```typescript
restore_eligibility: {
  can_restore: boolean
  drift_fields: string[]
  requires_regeneration: boolean
  reason: 'ok' | 'missing_metadata' | 'critical_drift'
}
```

O frontend usa exclusivamente o campo `reason` para decidir o status do drift crítico:

| `reason` | Drift crítico |
|----------|--------------|
| `critical_drift` | `'new'` |
| `missing_metadata` | `'new'` (conservador: na dúvida, assume desalinhamento) |
| `ok` | `'none'` |

Não é necessário expor o snapshot bruto. VS legada que não tenha `restore_eligibility` retorna `reason: 'missing_metadata'` — o frontend já trata como crítico conservador.

### Drift dismiss crítico

O `drift_dismissed_snapshot` existente (7 campos do BP) não cobre city/state. Para o estado `visual_signature`, o snapshot fica em `store_visual_signatures.metadata.visual_signature_drift_dismissed_snapshot`:

```
store_visual_signatures.metadata.visual_signature_drift_dismissed_snapshot: {
  name: string | null,
  segment: string | null,
  slogan: string | null,
  city: string | null,
  state: string | null,
}
```

**Vantagem:** o snapshot acompanha naturalmente a VS. Quando a VS é substituída (nova VS aprovada), o snapshot expira automaticamente — nenhuma lógica adicional de limpeza é necessária. **Não há necessidade de preservá-lo ao criar novo BP** (realinhar o BP não altera a assinatura).

**Endpoint responsável por persistir o dismiss:**
O próprio `DriftCriticalModal` (ou `DriftDecisionModal` quando crítico foi dismissado mas sensível está novo) chama `POST /api/store/[id]/visual-signature/dismiss-critical-drift` com body vazio. O backend:
1. Verifica se existe VS ativa para a loja
2. Lê os valores atuais da loja (`store.name`, `store.segment`, `store.slogan`, `store.city`, `store.state`)
3. Persiste `metadata.visual_signature_drift_dismissed_snapshot` fazendo **merge** do metadata existente:
   ```
   metadata: {
     ...currentMetadata,
     visual_signature_drift_dismissed_snapshot: currentStoreSnapshot
   }
   ```
   Isso preserva `input_snapshot`, `artDirectorOutput`, parâmetros de geração, métricas e demais campos existentes.
4. Retorna 204

**Como o GET informa o status ao frontend:**

O GET /api/store/[id]/visual-signature retorna no campo `critical_drift`:

```typescript
critical_drift: {
  status: 'none' | 'new' | 'dismissed'
  fields: string[]
  reason: 'ok' | 'critical_drift' | 'missing_metadata'
}
```

O status é calculado combinando `restore_eligibility.reason` com `visual_signature_drift_dismissed_snapshot`:

| `reason` | Snapshot existe e == store atual? | `status` |
|----------|----------------------------------|----------|
| `ok` | — | `none` |
| `critical_drift` `\|` `missing_metadata` | não | `new` |
| `critical_drift` `\|` `missing_metadata` | sim, valores conferem | `dismissed` |
| `critical_drift` `\|` `missing_metadata` | sim, mas store mudou de novo | `new` |

A última linha é crucial: o snapshot salva os **valores atuais da loja no momento do dismiss**, não os do `input_snapshot`. Se a loja mudar novamente após o dismiss, o status volta para `new`. O snapshot salva:

```typescript
{
  name: store.name,
  segment: store.segment,
  slogan: store.slogan,
  city: store.city,
  state: store.state
}
```

Isso também permite dismiss de `missing_metadata` — quando não existe `input_snapshot`, o snapshot de dismiss captura o estado atual da loja, e futuras alterações reabrem o drift.

O frontend usa exclusivamente `critical_drift.status` para decidir qual modal abrir e se exibe badge.

### Compatibilidade com snapshots antigos

Snapshots criados antes desta fase podem ter propriedades ausentes. Regras:

| Cenário | Comportamento |
|---------|--------------|
| Propriedade ausente no snapshot | Não comparar (assume sem drift para este campo) |
| Propriedade presente (null ou string) | Comparar normalmente |

### Outros campos

| Campo | Uso |
|-------|-----|
| `metadata.drift_dismissed_snapshot` | 7 campos. Já implementado (drift sensível). |
| `metadata.content_used` | Campo existente. Usado pela detecção de drift no estado VS para determinar se city/state/slogan são críticos. |
| `metadata.visual_signature_drift_dismissed_snapshot` | **NOVO.** Dismiss de drift crítico VS. |

---

## Arquivos Afetados

### Core — lógica de drift

| Arquivo | O que muda |
|---------|-----------|
| `src/lib/drift.ts` | `DRIFT_FIELDS` vira função `getDriftPolicy(identityState, contentUsed?)` que retorna `{ sensitive: string[], critical: string[] }`. Adicionar tipo `DriftCategory = 'critical' \| 'sensitive' \| 'none'`. `computeDriftStatus` atualizado para aceitar `readonly string[]` de campos a comparar (em vez de fixo em 4). Adicionar `evaluateCriticalDrift(vsSnapshot, contentUsed, store)` e `evaluateSensitiveDrift(bpSnapshot, store)` como funções independentes. |
| `src/lib/snapshot.ts` | Sem mudanças (já captura 7 campos para brand profile). |
| `src/lib/visual-signature/drift-validator.ts` | Expandido para servir como fonte canônica de validação de drift crítico VS. Usado pelo `drift-revalidator.ts` no backend. Tratar propriedades ausentes como "não comparar". |

### Backend — substituição excepcional

| Arquivo | O que muda |
|---------|-----------|
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | Aceitar campo `mode: 'standard' \| 'substitution'`. Em modo `substitution`, revalidar drift crítico server-side antes de gerar. Se drift não confirmado, retornar erro. |
| `src/app/api/store/[id]/visual-signature/approve/route.ts` | Nova ramificação `mode: 'substitution'` — válida apenas para lojas em `visual_signature` com drift crítico revalidado. Dois tiers: (1) archive/activate com compensação testada, (2) BP com fallback sem desfazer ativação. |
| **NOVO:** `src/app/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts` | `POST` vazio. Backend verifica VS ativa, lê valores atuais da loja (`store.name`, `store.segment`, `store.slogan`, `store.city`, `store.state`), faz merge no `metadata` preservando campos existentes. Retorna 204. |
| `src/app/api/store/[id]/brand-profile/realign/route.ts` | Backend decide estratégia por `identity_state`: text_only → inferência textual; logo → Brand Director; visual_signature → profiler VS modo regenerate. Cliente não seleciona estratégia. |
| `src/lib/visual-signature/drift-revalidator.ts` | **NOVO.** Função que revalida drift crítico server-side usando VS snapshot como fonte canônica. Usada pelo generate-without-logo (modo substitution) e pelo approve como guarda adicional. |
| `src/lib/visual-signature/brand-profiler.ts` | Adicionar `mode: 'reuse' \| 'regenerate'`. Modo `regenerate`: ignora cache de perfil, re-infere todos os campos brand (source='without_logo'), preserva `content_used` e metadados existentes no BP. Usado pelo realinhamento VS-sensível. |

### Frontend — detecção e UI

| Arquivo | O que muda |
|---------|-----------|
| `src/components/flow/visual-signature-approval-modal.tsx` | Adicionar prop `mode: 'standard' \| 'substitution'`. Em modo `substitution`, o fluxo é idêntico (checking → generate → display → approve), mas o modal chama `/generate-without-logo` com `mode: 'substitution'` e o approve envia `mode: 'substitution'`. NÃO inicia em generating — o modal sempre começa em checking. O próprio modal faz a única chamada de geração. |
| `src/components/flow/use-drift-detection.ts` | Retornar `driftCategory: DriftCategory` separado de `driftStatus`. `driftCategory` calculado por `identityState` + `contentUsed` + `activeVsSummary`. `hasCriticalDrift` substituído por `driftCategory === 'critical'`. Para estado VS, lê `activeVsSummary.critical_drift.status`. Aceitar `activeVsSummary: ActiveVisualSignatureSummary \| null` como parâmetro, onde `ActiveVisualSignatureSummary` é o DTO do GET com campo `critical_drift`. |
| `src/components/flow/store-identity-form.tsx` | Bifurcar `handleStep2Submit`: se `driftCategory === 'critical'`, abrir `DriftCriticalModal`. Se `driftCategory === 'sensitive'`, `DriftDecisionModal` existente. |
| `src/components/flow/store-preview.tsx` | Receber `driftStatus` e `critical_drift.status`. Calcular `effectiveStatus`. Renderizar badge "desalinhado" com tooltip quando `effectiveStatus === 'new'`. |
| `src/components/flow/drift-decision-modal.tsx` | Adicionar estado de erro/retry para fallback. |
| **NOVO:** `src/components/flow/drift-critical-modal.tsx` | Modal para drift crítico VS. Com crédito: abre `VisualSignatureApprovalModal` com `mode: 'substitution'`. Sem crédito: alerta de limite + "Manter"/"Remover mesmo assim"/"Comprar créditos" desabilitado. |

### Componentes novos

| Arquivo | Conteúdo |
|---------|----------|
| `src/components/flow/drift-critical-modal.tsx` | Modal com: título "Assinatura visual desatualizada", mensagem sobre campos centrais alterados. Com crédito: botão "Atualizar assinatura visual" → abre ApprovalModal com `mode: 'substitution'`. Sem crédito: alerta de limite + "Manter assinatura atual" (primário) / "Remover mesmo assim" (destrutivo) / "Comprar créditos — Em breve" (desabilitado). |

---

## Decisões Arquiteturais

### Decisão: Política de drift por `identity_state`

Antes: `DRIFT_FIELDS = ['segment', 'subsegment', 'tone_of_voice', 'name']` para todos os estados.

Agora: `getDriftPolicy(identityState, contentUsed?)` retorna sensíveis + críticos específicos.

As constantes podem ser definidas como:

```typescript
const DRIFT_POLICY: Record<string, {
  sensitive: readonly string[],
  critical: readonly string[],
}> = {
  'text_only': {
    sensitive: ['name', 'segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan'],
    critical: [],
  },
  'logo': {
    sensitive: ['segment', 'subsegment', 'tone_of_voice', 'positioning', 'short_description', 'slogan'],
    critical: [],
  },
  'visual_signature': {
    sensitive: ['subsegment', 'tone_of_voice', 'positioning', 'short_description'],
    critical: ['name', 'segment'], // + city/state/slogan se content_used
  },
};
```

### Decisão: `name` excluído do drift para estado `logo`

O logo é um arquivo enviado pelo usuário. Se o nome mudou, o usuário deve enviar um novo logo com o nome atualizado. O sistema não pode corrigir isso automaticamente. Manteremos essa decisão na primeira versão e reavaliaremos com dados de uso reais se necessário.

### Decisão: Drift crítico + substituição excepcional

A única situação em que uma VS pode ser gerada para uma loja com VS ativa é quando há **drift crítico revalidado pelo backend**. Não se trata de uma transição genérica `visual_signature → visual_signature` — o `identity_state` permanece inalterado e o fluxo é excepcional.

O fluxo correto:
1. Drift crítico detectado no frontend + revalidado server-side
2. DriftCriticalModal abre ApprovalModal com `mode: 'substitution'`
3. ApprovalModal chama `/generate-without-logo` uma única vez (rota revalida drift)
4. Geração OK → display → aprova → dois tiers:
   - Tier 1 (archive/activate): com compensação testada. Falha → VS anterior ativa.
   - Tier 2 (BP generation): falha → nova VS ativa, BP anterior como fallback.
5. Rejeição → feedback → retry (até 3 tentativas)

**Dois tiers de safety:**
| Tier | Escopo | Falha → |
|------|--------|---------|
| 1 | Geração, aprovação, troca de ativos | VS anterior permanece ativa |
| 2 | Geração do brand profile | Nova VS ativa, BP anterior fallback |

**Não devem ser alterados:**
- `identity-transitions.ts` (contrato atual se mantém)
- Contrato de aprovação padrão (`text_only → visual_signature`)
- Matriz `useIdentityActions` (geração não aparece como ação normal)
- Regra de que troca arbitrária VS→VS passa por remoção → text_only

### Decisão: Drift crítico elimina drift sensível — condicional

O drift sensível só é resolvido junto com o crítico **se a substituição excepcional for concluída com sucesso** (Tier 1 + Tier 2). A remoção isolada da VS não resolve o drift sensível — ele continua no brand profile quando a loja for para `text_only`.

**Importante:** mesmo que o Tier 2 (BP) falhe, o drift crítico é considerado resolvido (nova VS ativa). O drift sensível persiste se o BP não foi atualizado — isso é aceitável pois a UI exibirá warning/retry do BP.

### Decisão: Créditos de geração VS — UX reposicionada

O limite é de **3 assinaturas geradas com sucesso** (não tentativas). O backend conta `store_visual_signatures` com `type IN ('ai_generated', 'automatic_generated')` — tentativas que falharam não contam.

O comportamento varia por contexto:

| Contexto | UX de créditos |
|----------|---------------|
| Drift crítico COM crédito | Fluxo de substituição excepcional disponível |
| Drift crítico SEM crédito | Aviso no modal: "Se remover, não poderá gerar nova". Botão [Comprar créditos — Em breve] desabilitado como informativo |
| Após remoção VS (text_only) | "Gerenciar assinatura visual" → [Comprar créditos — Em breve] desabilitado |

O botão "Comprar créditos" nunca habilita geração imediata enquanto existe VS ativa. Ele apenas informa que o limite foi atingido. O backend é a autoridade (`generate-without-logo/route.ts:97`).

### Decisão: Fallback de realinhamento = manter estado atual

Se o realinhamento falhar, a direção visual existente permanece intacta. Exibe alerta de erro com opção de retry ou "Continuar por agora". "Continuar por agora" não persiste `drift_dismissed_snapshot` — o badge reaparecerá na próxima visita.

### Decisão: VS snapshot como fonte canônica para drift crítico

O VS `input_snapshot` (11 campos) é a **fonte única e canônica** para todos os campos críticos: name, segment, slogan, city, state. O brand profile snapshot (7 campos) é usado exclusivamente para drift sensível.

Isso elimina ambiguidade de ter duas fontes para name/segment/slogan e garante que a comparação de drift crítico use sempre o snapshot que estava vigente no momento da última geração da VS.

| Fonte | Uso |
|-------|-----|
| VS `input_snapshot` (11 campos) | Drift crítico: name, segment, slogan, **city**, **state** (conforme `content_used`) |
| Brand profile `input_snapshot` (7 campos) | Drift sensível: subsegment, tone_of_voice, positioning, short_description |

O `drift-validator.ts` e o `drift-revalidator.ts` usam o VS snapshot como base.

### Decisão: Diagnóstico independente (criticalDrift vs sensitiveDrift)

Para o estado `visual_signature`, o diagnóstico de drift é bifurcado:

- `evaluateCriticalDrift()`: compara store atual contra VS `input_snapshot` (11 campos), considerando `content_used`. Retorna `true` se qualquer campo crítico mudou.
- `evaluateSensitiveDrift()`: compara store atual contra brand profile `input_snapshot` (7 campos). Equivalente ao `computeDriftStatus` existente.

Isolamento garante que city/state (não capturados no BP) disparem drift crítico sem depender do fluxo de 7 campos.

### Decisão: Drift crítico dismissado — independência do realinhamento sensível

O `visual_signature_drift_dismissed_snapshot` fica em `store_visual_signatures.metadata` e acompanha naturalmente a VS. Como realinhar o brand profile **não altera a assinatura**, o dismiss crítico persiste independentemente de realinhamentos sensíveis. Nenhuma lógica adicional de preservação é necessária.

### Decisão: missing_metadata = crítico conservador

Se o VS `input_snapshot` estiver ausente ou malformado, o `drift-revalidator` classifica como `missing_metadata` e o frontend trata como drift crítico. Isso é conservador: na dúvida, assumir que pode haver desalinhamento.

### Decisão: Dois significados para "Manter" — textos diferentes

Existem duas ações de "Manter" com semântica diferente:

| Contexto | Texto | Comportamento |
|----------|-------|--------------|
| Decisão consciente do usuário (dismiss) | **"Manter direção atual"** | Persiste `drift_dismissed_snapshot` ou `visual_signature_drift_dismissed_snapshot`. Badge não é mais exibido (`critical_drift.status = 'dismissed'`). |
| Após falha de realinhamento/geração | **"Continuar por agora"** | Não persiste dismiss. Badge permanece (`driftStatus` continua `'new'`). |

### Decisão: Badge na Preview = "desalinhado" com tooltip

Texto minimalista ("desalinhado") com tooltip explicativo ao hover. Posicionado abaixo do nome da loja para evitar conflito com truncamento.

### Decisão: Posicionamento como 4.6.2.2

Fase filha da 4.6.2 porque estende a política de drift — não introduz funcionalidade nova independente. Coerente com a estrutura existente (4.6.3.1, 4.6.2.1).

---

## Fora de Escopo

| Item | Motivo |
|------|--------|
| `brand_color` / `accent_color` como campos de drift | Cores são derivadas, não dados-fonte. Já removidas do snapshot na 4.6.2.1. |
| Unificação do `drift-validator.ts` (VS restore) com o sistema de drift do brand profile | Sistemas separados com contratos diferentes. Unificação futura se necessário. |
| Sistema de créditos/planos para VS | Apenas respeitar o limite de 3 assinaturas geradas. A lógica de compra de créditos é escopo de fase de billing/planos. |
| Troca arbitrária de VS ativa por nova VS (sem drift crítico) | Regra geral: VS → nova VS passa por remoção → text_only. A **única exceção** é substituição excepcional por drift crítico validado pelo backend, que está no escopo desta fase. |
| Versionamento explícito no snapshot (`input_snapshot_version`) | Não necessário — `getDriftPolicy` já resolve por estado. |
| Redesenho visual amplo do modal de drift | Manter padrão visual existente. Ajustes cosméticos mínimos. |
| Histórico de drift ou auditoria | Registrar decisão de arquitetura, não implementar agora. |
| Badge para core de campanha | Apenas no preview do Step 2. Se aplicável à campanha, será escopo futuro. |

---

## Critérios de Aceite

1. Loja em `text_only`: qualquer dos 7 campos alterados dispara drift simples.
2. Loja em `logo`: qualquer campo exceto `name` dispara drift simples.
3. Loja em `visual_signature`: `name` e `segment` disparam drift crítico; `subsegment`, `tone_of_voice`, `positioning`, `short_description` disparam drift sensível.
4. Loja em VS com `content_used.slogan = true`: alterar `slogan` dispara drift crítico.
5. Loja em VS com `content_used.city = true`: alterar `city` dispara drift crítico.
6. Loja em VS com `content_used.state = true`: alterar `state` dispara drift crítico.
7. Diagnóstico independente no save: VS state calcula `criticalDrift` (VS snapshot) e `sensitiveDrift` (BP snapshot) separadamente. City/state disparam crítico sem depender dos 7 campos do BP.
8. Drift crítico VS com crédito disponível → DriftCriticalModal abre ApprovalModal com `mode: 'substitution'`. Modal inicia em checking e chama `/generate-without-logo` uma única vez. Rota revalida drift server-side.
9. Drift crítico VS sem crédito (>= 3 assinaturas geradas com sucesso) → modal exibe alerta de limite + "Manter direção atual" (primário, persiste dismiss) + "Remover mesmo assim" (destrutivo) + "Comprar créditos — Em breve" (desabilitado).
10. Drift sensível VS → realinhamento preserva `identity_state = visual_signature`. Backend decide estratégia por `identity_state` (sem parâmetro de query). Profiler em modo `regenerate`.
11. Substituição excepcional — Tier 1 (archive/activate): falha na geração, aprovação ou troca de ativos → VS anterior PERMANECE ativa. Compensação testada se segunda atualização falhar.
12. Substituição excepcional — Tier 2 (BP): falha na geração do brand profile → nova VS PERMANECE ativa. BP anterior continua como fallback. UI exibe warning/retry.
13. Remoção isolada da VS (sem substituição) → loja vai para text_only. Drift sensível do brand profile continua detectável.
14. Dismiss crítico VS persiste `visual_signature_drift_dismissed_snapshot` com valores **atuais da loja** (`store.name`, `store.segment`, `store.slogan`, `store.city`, `store.state`). Expira automaticamente quando VS é substituída (nova VS aprovada).
15. Snapshots antigos: propriedade ausente = não comparar. Propriedade presente com null = comparar normalmente.
16. Missing metadata no VS snapshot → classificado como crítico conservador.
17. VS snapshot é fonte canônica para TODOS os campos críticos (name, segment, slogan, city, state).
18. Fallback de realinhamento (BP): realinhamento falha → alerta + manter + badge permanece.
19. Compensação no backend (realinhamento): insert do novo perfil falha → perfil anterior restaurado para `synced`. Para os três caminhos: text_only, logo e visual_signature.
20. Inferência falha no realinhamento: perfil anterior NÃO marcado como outdated (permanece `synced`).
21. Badge "desalinhado" visível na preview apenas quando `effectiveStatus === 'new'`. `effectiveStatus` combina `critical_drift.status` e `sensitiveDrift`: se qualquer um for `'new'`, exibe badge. Dismissado não exibe badge.
22. Tooltip do badge exibe texto explicativo.
23. GET /api/store/[id]/brand-profile aceita parâmetro opcional `?status=synced` para o hook obter o perfil ativo sem perder acesso ao mais recente.
24. Non-blocking: usuário pode manter desalinhamento em qualquer cenário.
25. POST /dismiss-critical-drift: body vazio → lê valores **atuais da loja** (`store.name`, `store.segment`, `store.slogan`, `store.city`, `store.state`), faz merge no `metadata` preservando campos existentes. Retorna 204.
26. GET /visual-signature retorna `critical_drift.status` = `'none'` / `'new'` / `'dismissed'`. O cálculo: se `restore_eligibility.reason` é `critical_drift` ou `missing_metadata`, compara snapshot de dismiss com estado atual da loja. Se iguais → `'dismissed'`. Se loja mudou → `'new'`. VS legada sem `restore_eligibility` → `status: 'new'`, `reason: 'missing_metadata'`.
27. Dismiss de `missing_metadata`: snapshot salva estado atual da loja. Se loja mudar após dismiss, status volta para `'new'`.

---

## Hotspots para Investigação

```
src/lib/drift.ts                                       — evaluateCriticalDrift + evaluateSensitiveDrift
src/lib/visual-signature/drift-validator.ts             — expandir c/ tratamento de props ausentes
src/lib/visual-signature/drift-revalidator.ts           — NOVO: revalidação server-side
src/lib/visual-signature/brand-profiler.ts              — mode: 'reuse' | 'regenerate'
src/components/flow/use-drift-detection.ts               — driftCategory + activeVsSummary
src/components/flow/store-identity-form.tsx              — handleStep2Submit bifurcação
src/components/flow/store-preview.tsx                    — badge rendering
src/components/flow/drift-decision-modal.tsx             — error/retry state
src/components/flow/visual-signature-approval-modal.tsx  — mode: 'standard' | 'substitution'
NOVO: src/components/flow/drift-critical-modal.tsx       — abre ApprovalModal c/ mode substitution
src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts  — mode + revalidação
src/app/api/store/[id]/visual-signature/approve/route.ts — mode: 'substitution' (dois tiers)
src/app/api/store/[id]/brand-profile/realign/route.ts   — estratégia por identity_state + compensação
src/app/api/store/[id]/brand-profile/route.ts           — GET ?status=synced
NOVO: src/app/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts  — POST dismiss crítico, retorna 204
src/app/api/store/[id]/visual-signature/route.ts        — GET retorna critical_drift.status
```

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-06-29 | Política de drift por `identity_state` — três matrizes diferentes (text_only, logo, visual_signature). |
| 2026-06-29 | `name` excluído do drift para estado `logo`. Responsabilidade do usuário atualizar o logo manualmente. |
| 2026-06-29 | Para VS: dois níveis — crítico (name, segment, slogan/city/state se `content_used`) e sensível (subsegment, tone_of_voice, positioning, short_description). |
| 2026-06-29 | Drift crítico elimina drift sensível — mas apenas se a substituição excepcional for concluída (nova VS aprovada + BP gerado). Remoção isolada não resolve sensível. |
| 2026-06-29 | Fluxo crítico VS vai direto para geração (pula checking/review/picking) — excepcional, só para drift crítico revalidado. |
| 2026-06-29 | Créditos de geração VS respeitados: se `signatures.length >= 3`, bloqueia substituição. Modal exibe alerta + "Manter direção atual"/"Remover mesmo assim". |
| 2026-06-29 | Fallback de realinhamento = manter estado atual + alerta de erro + opção de retry. "Continuar por agora" não persiste dismiss. |
| 2026-06-29 | Badge na preview: "desalinhado" com tooltip, abaixo do nome. Exibido apenas para `effectiveStatus === 'new'`. |
| 2026-06-29 | Posicionamento: 4.6.2.2 como filha de 4.6.2 (extensão de política de drift, não fase independente). |
| 2026-06-29 | Non-blocking em todos os cenários — usuário pode sempre optar por manter a direção/assinatura atual. |
| 2026-06-30 | Créditos esgotados: botão "Comprar créditos" desabilitado com selo "Em breve". Aparece no modal crítico como informativo e no gerenciamento text_only. Não redireciona (sem billing). |
| 2026-06-30 | Compensação obrigatória no backend de realinhamento: restore do perfil anterior se insert falhar (ambos os caminhos logo e text_only). |
| 2026-06-30 | Drift crítico de city/state usa `store_visual_signatures.metadata.input_snapshot` como baseline (11 campos), não o brand profile snapshot (7 campos). |
| 2026-06-30 | GET /brand-profile aceita `?status=synced` para o hook de drift, mantendo semântica original sem parâmetros. |
| 2026-06-30 | Substituição excepcional VS: única exceção à regra VS→nova VS via text_only. ApprovalModal com mode:'substitution' — modal inicia em checking, chama generate uma vez. |
| 2026-06-30 | Aprovação `mode: 'substitution'` — dois tiers: Tier 1 (archive/activate) com compensação; Tier 2 (BP) sem desfazer ativação. Falha no Tier 2: nova VS ativa, BP anterior fallback. |
| 2026-06-30 | "Comprar créditos" não habilita geração direta enquanto VS ativa. Só como indicador de limite. |
| 2026-06-30 | Diagnóstico independente: evaluateCriticalDrift (VS snapshot) + evaluateSensitiveDrift (BP snapshot). City/state disparam crítico sem depender dos 7 campos do BP. |
| 2026-06-30 | VS snapshot é fonte canônica para TODOS os campos críticos (name, segment, slogan, city, state). BP snapshot só para sensíveis. |
| 2026-06-30 | Drift dismiss crítico: snapshot salva valores **atuais** da loja (não do input_snapshot). Dismiss válido enquanto loja não mudar. Permite dismiss de missing_metadata. Merge no metadata preserva campos existentes. |
| 2026-06-30 | Realinhamento VS + drift sensível: backend decide estratégia por identity_state. Profiler modo regenerate preserva identity_state e visual_signature_id. |
| 2026-06-30 | Limite de 3 assinaturas geradas com sucesso (não tentativas). |
| 2026-06-30 | Missing_metadata no VS snapshot → classificado como crítico conservador. |
| 2026-06-30 | Guarda de draft substituída por lock de geração por loja. Drafts históricos de VS aprovada não bloqueiam nova substituição. |
| 2026-06-30 | Dois significados para "Manter": "Manter direção atual" (dismiss, persiste snapshot, badge não exibido) vs "Continuar por agora" (falha, não persiste, badge permanece). |
| 2026-06-30 | GET /visual-signature retorna `critical_drift.status` = `'none'` / `'new'` / `'dismissed'`. Frontend usa exclusivamente este campo. |
