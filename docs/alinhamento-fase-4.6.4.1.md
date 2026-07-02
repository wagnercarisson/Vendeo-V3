# Alinhamento Fase 4.6.4.1 — Botão "Cancelar" no Modal de Aprovação VS

## Nomenclatura das Fases 4.6

```text
4.6  — Store Form Adjusts                             (fase mãe)
 ├── 4.6.1 — Text Only Coverage                       (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection         (concluída)
 ├── 4.6.3 — Logo State Lifecycle                     (concluída)
 ├── 4.6.4 — Visual Signature Lifecycle               (concluída)
 │    └── 4.6.4.1 — Botão "Cancelar" no Modal de VS   (concluída)
 ├── 4.6.5 — VS Color Drift & Profile Alignment       (concluída)
 ├── 4.6.6 — Identity Transition                      (concluída)
 └── 4.6.7 — Color Preferences Persistence            (pendente)
```

Esta fase é um **refinamento** da Fase 4.6.4 — Visual Signature Lifecycle. Identifica e corrige um botão no modal de aprovação de assinatura visual (`VisualSignatureApprovalModal`) que persiste estado indevidamente e corrompe a sincronização entre o campo canônico `identity_state` e o campo derivado `logo_status`.

---

## Propósito

Substituir o botão **"Continuar sem logo" / "Continuar sem assinatura"** na fase `"error"` do `VisualSignatureApprovalModal` por um botão **"Cancelar"** que apenas fecha o modal sem produzir novas mutações de estado.

Isso elimina uma violação de sincronização entre `identity_state` e `logo_status` — o botão `handleContinueWithoutLogo` foi criado antes da diretriz de que o modal não deve persistir estado. (Nota: o repositório ainda possui um PATCH genérico em `src/app/api/store/[id]/route.ts:164` que aceita `logo_status` diretamente; este não faz parte do escopo desta fase mas é uma violação similar conhecida.)

---

## Contexto: A Descoberta

### O botão problemático

**Arquivo:** `src/components/flow/visual-signature-approval-modal.tsx` — linhas 411-422

```typescript
const handleContinueWithoutLogo = useCallback(async () => {
    await fetch(`/api/store/${storeId}/logo-status`, {
      method: "PATCH",
      body: JSON.stringify({ logo_status: "explicit_none" }),
    });
    setState({ phase: "done", logoStatus: "explicit_none" });
    onComplete({ logoStatus: "explicit_none" });
}, [storeId, onComplete]);
```

**Renderizado na fase `"error"` (linhas 795-801):**

```text
┌─ Fase "error" ───────────────────────────────────────────┐
│                                                           │
│   ⚠️ [mensagem de erro contextualizada]                    │
│                                                           │
│   ┌──────────────────────────────────┐                    │
│   │   Tentar novamente               │  → generate()      │
│   └──────────────────────────────────┘                    │
│   ┌──────────────────────────────────┐                    │
│   │   Continuar sem logo/assinatura  │  → PATCH            │
│   └──────────────────────────────────┘                    │
│                                                           │
│   [Voltar] (só quando drift presente)                     │
└───────────────────────────────────────────────────────────┘
```

### O que ele faz — traço completo

1. **Backend:** `PATCH /api/store/{id}/logo-status { logo_status: 'explicit_none' }`
   - Altera `logo_status` no DB sem usar `transition()`
   - `identity_state` **não é alterado** — quebra a sincronização entre os dois campos
2. **Modal:** `setState({ phase: "done", logoStatus: "explicit_none" })`
3. **Callback:** `onComplete({ logoStatus: "explicit_none" })`
   - `StoreIdentityForm.handleApprovalComplete` (linha 461) executa:
     - `setLogoStatus('explicit_none')` ← igual ao DB
     - `setIdentityState('visual_signature')` ← **incondicional**, mesmo sem VS

### Efeito em cascata

```text
PATCH /logo-status { logo_status: 'explicit_none' }
  → DB: logo_status = 'explicit_none'
  → DB: identity_state NÃO ALTERADO
  → identity_state e logo_status ficam DESSINCRONIZADOS

onComplete({ logoStatus: 'explicit_none' })
  → StoreIdentityForm:
      setLogoStatus('explicit_none')
      setIdentityState('visual_signature')     ← divergente do DB
```

**Resultado:** estado React diverge do DB até o próximo reload. O campo derivado (`logo_status`) é alterado sem orquestração, enquanto o campo canônico (`identity_state`) permanece inalterado.

---

## Quando o botão aparece (cenários que levam à fase "error")

| Cenário | Gatilho | `state.drift` |
|---------|---------|---------------|
| **Timeout de geração** | generate() → AbortError | undefined |
| **Erro de API/rede** | generate() → erro genérico | undefined |
| **Drift na VS ativa (standard mode)** | `hasActiveSignatureDrift=true` ao abrir o modal | preenchido |

**A prop não é morta** (possui caller em `store-identity-form.tsx:1739`), mas **o branch de erro por drift em standard mode não é alcançável pela UI atual.** Isso porque drift crítico (`driftCategory === 'critical'`) só ocorre quando `identity_state === 'visual_signature'` (`use-drift-detection.ts:59`). Nesse estado, `canCreateVS` e `canManageVS` são `false` (`use-store-form.ts:101`), portanto o botão "Criar Assinatura Visual" (`handleNoLogo`) não fica disponível para o usuário. O branch permanece como **código defensivo**, podendo ser acionado por integrações futuras ou acesso programático. O fluxo de substitution mode ignora essa prop (linha 189 — pula a verificação e vai direto para generate).

---

## Mensagens de erro já são informativas ✅

No `generate()` (linhas 169-176):

```typescript
// Timeout:
"A requisição excedeu o tempo limite. Pode haver instabilidade
 temporária no serviço de IA. Tente novamente mais tarde."

// Outros erros:
"Não foi possível criar sua assinatura visual agora. Pode haver
 instabilidade temporária no serviço de IA, problema de conexão
 ou servidor. Tente novamente mais tarde."
```

**Nenhum ajuste de UI/UX é necessário nas mensagens.**

---

## O que o "Cancelar" deve fazer

```typescript
const handleCancel = useCallback(() => {
    onClose();  // apenas fecha o modal
}, [onClose]);
```

- **Não chama** `PATCH /logo-status`
- **Não chama** `onComplete()` com `logoStatus`
- **Não produz nenhuma mutação** além das que já ocorreram no backend durante a tentativa
- Apenas fecha o modal e retorna à Step 2

### Estado resultante em cada cenário

| Cenário | Mutação já ocorrida no backend | Após "Cancelar" |
|---------|-------------------------------|-----------------|
| **Standard mode — erro de geração** (text_only) | `logo_status='failed'`, `identity_state='text_only'` (inalterado) | Nenhuma mutação adicional. Step 2 reexibe estado 'text_only'. |
| **Standard mode — drift** (`hasActiveSignatureDrift=true`) | Nenhuma (erro é pré-geração, baseado em validação local) | Nenhuma mutação. Step 2 reexibe estado anterior. |
| **Substitution mode — erro de geração** (VS ativa + drift) | `logo_status='failed'` (sobrescreve 'generated' indevidamente), `identity_state='visual_signature'` (inalterado) | Nenhuma mutação adicional. Step 2 reexibe VS ativa. |

> **Nota sobre substitution mode:** O backend seta `logo_status='failed'` no erro de geração (linhas 402-408 do `generate-without-logo/route.ts`) mesmo em substitution mode, onde a VS ativa continua existindo. Isso sobrescreve o valor esperado (`'generated'`) e é **inconsistente**. Este problema será corrigido nesta mesma fase — ver Escopo.

---

## Tipos de violação que este botão causa

O botão `handleContinueWithoutLogo` viola três princípios:

1. **identity_state como fonte canônica** — o campo deve determinar o asset visual ativo. Alterar `logo_status` sem transição de `identity_state` quebra essa relação.
2. **Sincronização identity_state ↔ logo_status** — `IDENTITY_TO_LOGO_STATUS` mapeia cada `identity_state` a um `logo_status` esperado. Alterar apenas `logo_status` fere esse contrato.
3. **Coerência React ↔ DB** — `handleApprovalComplete` seta `identityState='visual_signature'` incondicionalmente, mesmo quando não há VS, criando divergência temporária.

---

## Escopo da Fase 4.6.4.1

### Dentro de escopo

1. **Trocar ação secundária da fase "error"** — Substituir `handleContinueWithoutLogo` por `handleCancel` que apenas chama `onClose()`. O texto do botão muda para "Cancelar".
2. **Remover `handleContinueWithoutLogo`** — A função é removida do componente. O PATCH para `/logo-status` deixa de existir.
3. **Remover rota `/logo-status`** — Após confirmar que não há consumidor externo, remover `src/app/api/store/[id]/logo-status/route.ts`. **Premissa:** endpoint exclusivamente interno, sem consumidores externos conhecidos. Sua remoção é uma quebra de contrato da API; qualquer caller não identificado quebrará após o deploy.
4. **Corrigir `logo_status='failed'` em substitution mode** — No `generate-without-logo/route.ts`, o bloco de falha (linhas 402-408) não deve setar `logo_status='failed'` quando `mode === 'substitution'`, pois a VS ativa continua existindo e `identity_state` permanece `'visual_signature'`.
<!-- Item removido intencionalmente — exhausted state não pertence ao escopo desta fase; qualquer alinhamento de spec de exhausted state é escopo de fase posterior -->

### Fora de escopo

- Redesenho completo do modal
- Alteração nas mensagens de erro (já são informativas ✅)
- Remoção de `text_only_origin` (dormant, sem impacto)
- `identity-transitions.ts` — inalterado (o problema não está nas transições)
- `DriftCriticalModal` / `DriftDecisionModal` — inalterados
- Redesenho do protocolo de substitution mode — fora de escopo; somente a preservação de `logo_status` em falha pertence a esta fase

### Dívidas técnicas registradas

- **Testes do modal:** Os testes atuais em `src/components/flow/__tests__/visual-signature-approval-modal.test.ts` não renderizam o componente — apenas testam funções isoladas. A base técnica deverá prever infraestrutura e teste comportamental do modal, validando fechamento sem `onComplete` e sem `PATCH /logo-status`.

---

## Critérios de validação

### Automáticos

- [x] TypeScript — sem erros de tipo
- [x] Lint — sem violações
- [x] Build — `npm run build` passa
- [x] Testes existentes — continuam passando (275/275)
- [x] **Cancelar chama `onClose`, não chama `onComplete`, não executa PATCH** — teste comportamental do modal implementado
- [x] **Falha em substitution mode não altera `logo_status`** — teste parametrizado na rota `generate-without-logo` com `mode=substitution`
- [x] **Falha em standard mode continua gravando `failed`** — teste parametrizado com `mode=standard`
- [x] **Rota `/logo-status` não existe mais** — confirmado via `Test-Path`

### Manuais (2 cenários)

1. **Erro comum** — Abrir modal, gerar VS, induzir erro de geração → "Cancelar" fecha o modal sem nova requisição iniciada pelo clique e sem `onComplete`. Step 2 exibe estado anterior.
2. **Erro em substitution** — VS ativa com drift, DriftCriticalModal → "Atualizar" → substitution mode → erro de geração → "Cancelar" fecha. VS ativa e brand profile permanecem intactos. `logo_status` continua `'generated'` (não mais sobrescrito para `'failed'`).

> ⚠️ **Caveat de timeout:** O timeout do cliente é 190s, enquanto o backend admite até 300s. "Cancelar" após um timeout do cliente **não garante** que o processamento do servidor tenha encerrado. O botão apenas não inicia novas mutações. Uma geração anterior ainda pode completar posteriormente no backend, resultando em estado persistido divergente do esperado pelo cliente.
