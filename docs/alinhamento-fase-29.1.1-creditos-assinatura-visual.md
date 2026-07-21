# Alinhamento Fase 29.1.1 — Créditos na Assinatura Visual

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                     ✓
  ├── F23 a F29 — todas as fases v1.5 concluídas e testadas          ✓
  │
  └── pós-v1.5 — preparação para monetização pública (F30)
        │
        └── F29.1.1 — Créditos na Assinatura Visual                  ← esta fase
```

A v1.5 está completa com 7 fases e 889 testes. O sistema de créditos (F24-F27) está maduro: ledger imutável, saldo por loja, reserva atômica, estorno, admin operacional, extrato visível e integração com o pipeline de campanhas.

**Problema identificado pós-lançamento:**

A geração de Assinatura Visual (VS) ainda usa o modelo antigo de **cota fixa de 3 tentativas**, enquanto as campanhas já consomem créditos. Com a iminente abertura de compra de créditos (F30), a VS precisa usar o mesmo modelo econômico: cada geração custa 1 crédito, sem limite artificial de tentativas.

```
ANTES (modelo antigo):
  VS: 3 tentativas gratuitas, depois bloqueio absoluto
  Campanha: consome créditos (1 por geração)

DEPOIS (modelo unificado):
  VS: consome créditos (1 por geração), sem limite de tentativas
  Campanha: consome créditos (1 por geração)
```

**O que não muda:** o usuário pode gerar uma VS por vez, aprovar ou rejeitar, e o histórico de versões anteriores continua disponível. O que muda é a autoridade de limite: sai a cota fixa `3/3`, entra o saldo de créditos.

---

## Propósito

1. **VS passa a consumir créditos** — cada geração custa 1 crédito, seguindo o mesmo padrão do pipeline de campanhas (`getBalance → reserveCredit → refund em falha técnica`). O crédito é reservado antes da chamada de IA, estornado apenas em falha técnica (timeout, erro de IA, falha de storage), e consumido quando a VS é persistida com sucesso — mesmo que o usuário rejeite depois. **Rejeição é escolha criativa, não falha técnica, e não gera estorno.**
2. **Remover cota fixa de 3 tentativas** — `visual_signature_attempts` deixa de ser autoridade de produto. O usuário pode gerar quantas VS quiser, limitado apenas pelo saldo de créditos
3. **Tratar saldo insuficiente na UI** — modal de aprovação (`VisualSignatureApprovalModal`) exibe estado "Créditos insuficientes" com CTA para solicitar créditos, sem tratá-lo como erro de sistema
4. **Manter histórico de versões** — as VS geradas anteriormente continuam acessíveis para reativação via a revisão (`review` phase), com validação de drift preservada
5. **Não contabilizar tentativas fracassadas** — falhas técnicas (timeout, erro de IA, storage) estornam o crédito e não consomem saldo

---

## Estado Atual (pós-F29)

```
                                          ANTES                              DEPOIS (F29.1.1)
═══════════════════════════════════════════════════════════════════════════════════════════════════

Modelo de limite:
  Autoridade                       cota fixa de 3 gerações                saldo de créditos (1 por geração)
  visual_signature_attempts        incrementado a cada geração            NÃO é mais incrementado
                                   bem-sucedida                           (coluna existe mas não é usada
                                   zerado na aprovação                     como quota)

generate-without-logo/route.ts:
  Guard de acesso                  totalCount >= 3 → 403 exhausted        balance < 1 → 402 insufficient_credits
                                   [REMOVER]                              [ADICIONAR] reserve + refund
  Incremento de attempts           store.update({ visual_signature_       [REMOVER] não incrementar
                                   attempts: attemptNumber })

reject/route.ts:
  Guard de exaustão                currentAttempts >= 3 → exhausted       [REMOVER] sempre permite nova geração
                                   (retorna 3 versões para escolha)       (histórico mantido, sem bloqueio)
  Comportamento                    arquiva + verifica limite              arquiva + retorna success (sempre)

approve/route.ts:
  Reset de attempts                visual_signature_attempts = 0          [REMOVER] não resetar
  Comportamento                    ativa + reseta quota                    ativa (sem efeito colateral de quota)

VisualSignatureApprovalModal:
  Contador de tentativas           "Tentativa X/3"                        [REMOVER] não exibir contador
  Limite na inicialização          sigs.length >= 3 → exhausted           [REMOVER] mostrar review (sempre)
  Guard no reject                  state.attempt >= 3 → "Ver versões"     [REMOVER] mostrar "Gerar nova"
                                   (não permite gerar nova)               (sempre, se tiver créditos)
  Estado exhausted                 phase "exhausted" com 3 cards          [REMOVER] substituído por review
                                   e "Limite de 3 versões atingido"       padrão + trata 402
  Tratamento de 402                inexistente                             [ADICIONAR] phase "insufficient_credits"
                                                                          com mensagem e CTA "/conta"

Referência no ledger:
  campaignId em reserveCredit      usado (campaign_id referencia           [ALTERAR] usar metadata explícita:
                                   campanhas)                             { feature: "visual_signature",
                                                                             operationId, mode }
  credit_tx_id na VS               inexistente                            [ADICIONAR] gravar credit_tx_id
                                                                          no metadata da store_visual_signatures

Custo:
  generateAutomatic()              1 geração                              DESCONTINUADO (ver D2)
  generateVariations()             3 variações na mesma sessão            DESCONTINUADO (ver D2)
  API generate-without-logo        1 geração                              custa 1 crédito (consistente)

Modal antigo (VisualSignatureModal):
  Opção "Gerar 3 opções"           generateVariations() → 3 variações     DESCONTINUADO (ver D2)
  Opção "Deixar Vendeo escolher"   generateAutomatic() → 1 VS             DESCONTINUADO (ver D2)
```

---

## Decisões de Alinhamento

### D1 — Substituição do limite de 3 por saldo de créditos

`DECIDIDO`

A cota fixa de 3 tentativas de geração de VS deixa de existir como regra de produto. O novo modelo é:

- Cada geração de VS custa **1 crédito**
- O saldo é verificado antes da chamada de IA
- Se saldo insuficiente → HTTP 402 + UI específica
- Se a geração falha tecnicamente → crédito é estornado (`refundCredit`)
- Se a geração é bem-sucedida → crédito é consumido (a reserva já deduziu)
- O usuário pode gerar quantas VS quiser, limitado apenas pelo saldo

**O que morre com essa decisão:**

| Artefato | Ação |
|----------|------|
| `visual_signature_attempts` em `stores` | Para de ser incrementado (coluna mantida, sem migration de remoção) |
| `totalCount >= 3` em `generate-without-logo/route.ts` | Remover guard |
| `currentAttempts >= 3` em `reject/route.ts` | Remover bloco exhausted |
| `visual_signature_attempts = 0` em `approve/route.ts` | Remover reset |
| `sigs.length >= 3` → exhausted em `VisualSignatureApprovalModal` | Remover (sempre mostrar review) |
| `state.attempt >= 3` → "Ver versões geradas" em `VisualSignatureApprovalModal` | Remover (sempre permitir gerar nova) |
| Fase "exhausted" no modal | Remover (substituído por review + 402) |

**O que nasce:**

| Artefato | Ação |
|----------|------|
| `balance check` em `generate-without-logo/route.ts` | Adicionar antes da IA |
| `reserveCredit` em `generate-without-logo/route.ts` | Adicionar antes da IA |
| `refundCredit` em caso de falha | Adicionar no catch da geração |
| Tratamento de 402 em `VisualSignatureApprovalModal` | Adicionar `insufficient_credits` state |
| `credit_tx_id` no metadata da VS | Adicionar no `generate-without-logo` |
| `getLaunchConfig().creditsChargingEnabled` | Respeitar flag no fluxo de VS |

---

### D2 — Custo do "Gerar 3 opções" (generateVariations)

`DECIDIDO — OPÇÃO C: DESCONTINUAR`

O `generateVariations()` e `generateAutomatic()` em `server-actions.ts` são caminhos paralelos de geração que **não passam pelo fluxo de crédito**. Se mantidos sem custo, driblam a cobrança do fluxo principal.

**Decisão:** o `VisualSignatureModal` (modal antigo com opções "Gerar 3 opções", "Deixar o Vendeo escolher", etc.) é **descontinuado/ocultado nesta fase**. O fluxo principal `VisualSignatureApprovalModal` (generate-without-logo com Art Director) é o único caminho de geração de VS.

**Consequências:**
- `server-actions.ts:generateVariations()` — não recebe integração de crédito. Mantido sem uso nesta fase
- `server-actions.ts:generateAutomatic()` — não recebe integração de crédito. Mantido sem uso nesta fase
- `VisualSignatureModal` — ocultado da UI. Se mantido no código, fica inacessível ao usuário
- Todo o esforço de crédito na VS fica concentrado no `VisualSignatureApprovalModal` + `generate-without-logo/route.ts`

**Por que não manter com custo de 3 créditos?** Introduzir dois fluxos de VS com UX, custo e qualidade diferentes gera confusão para o usuário e complexidade de manutenção. O fluxo principal é superior (Art Director + feedback por rejeição + validação de drift). Unificar o esforço nele é a escolha mais limpa.

---

### D3 — Histórico de VS: limite na API e no modal

`DECIDIDO`

Com a remoção do limite de 3, o usuário pode acumular dezenas de VS geradas. A API atual (`GET /api/store/[id]/visual-signature`) retorna **todas** as signatures sem limite. O modal não deve carregar o histórico completo.

**Mudanças concretas:**

1. **API `GET /api/store/[id]/visual-signature`** — adicionar parâmetros `?limit=N&offset=0` (opcionais, default limit=12). Isso protege tanto o modal quanto futuros consumidores. O retorno atual (`{ signatures, total }`) é mantido, mas `signatures` passa a respeitar `limit`.

2. **Review no modal** — carrega as últimas 6 signatures via `GET .../visual-signature?limit=6`. Mostra grid compacto com validação de drift. Se `total > 6`, exibe indicador não clicável: "Há mais versões no histórico. Galeria completa em breve." **Sem link navegável — não há página para onde ir nesta fase.**

3. **Galeria/Histórico completo** (fora do escopo — fase futura) — página dedicada com grid paginado, filtros (Ativa, Disponíveis, Com dados antigos, Indisponíveis), status de validade/drift.

**Regra:** a API sempre aceita `limit` e `offset`. O modal nunca passa de 6 registros. O review mantém a mesma lógica de aprovação/reativação com validação de drift.

---

### D4 — Referência correta no ledger para VS

`DECIDIDO`

`reserveCredit()` deve ser chamado com `campaignId: null` e `metadata` explícita para VS:

```typescript
const creditTxId = await creditService.reserveCredit(storeId, 1, {
  idempotencyKey: `vs_reserve_${storeId}_${operationId}`,
  metadata: {
    feature: "visual_signature",
    mode: "standard" | "substitution",
    operationId,
  },
});
```

Após `persistSignature()`, o `credit_tx_id` é gravado no `metadata` da `store_visual_signatures` para rastreabilidade:

```typescript
await supabase
  .from("store_visual_signatures")
  .update({
    metadata: {
      ...existingMetadata,
      credit_tx_id: creditTxId,
    },
  })
  .eq("id", signature.id);
```

**Motivo:** `campaign_id` no ledger referencia campanhas. Misturar VS no mesmo campo polui a semântica.

**Sobre o extrato em `/conta`:** a transação de dedução gerada por `reserve_credit` não possui campo `reason` — o RPC grava apenas `campaign_id`, `idempotency_key` e `metadata` no ledger. Portanto, o extrato mostrará essas transações com `campaignId: null`, `reason: null` e `metadata.feature: "visual_signature"`. A UI do extrato não é modificada nesta fase; a tradução de `metadata.feature` para um label amigável ("Assinatura Visual") fica para uma melhoria futura na página `/conta`.

---

### D5 — Launch Config respeitado no fluxo de VS

`DECIDIDO`

O fluxo de VS deve respeitar as mesmas flags de launch config que o pipeline de campanhas:

| Flag | Efeito |
|------|--------|
| `v15Enabled=false` | VS gera sem consumir crédito (compatibilidade v1.4) |
| `creditsChargingEnabled=false` | VS gera sem verificar saldo (útil para testes) |
| `generationPaused=true` | VS retorna 503 antes de qualquer operação |

A verificação é feita no início do handler, antes do balance check:

```typescript
import { getLaunchConfig } from "@/lib/launch-config/config";

const config = getLaunchConfig();

if (config.generationPaused) {
  return NextResponse.json(
    { error: "Geração temporariamente indisponível." },
    { status: 503 }
  );
}
```

---

### D6 — Lock de geração + try/finally

`DECIDIDO`

O `generationLocks` existente em `generate-without-logo/route.ts` deve ser mantido e envolto em `try/finally` para garantir liberação mesmo em caso de falha de crédito, IA, storage ou persistência:

```typescript
generationLocks.set(id, true);
try {
  // ... todo o fluxo (balance check, reserve, geração, persistência) ...
} catch (err) {
  // ... refund se necessário ...
  throw err; // ou retornar erro
} finally {
  generationLocks.delete(id);
  clearTimeout(timeoutId);
}
```

---

### D7 — Coluna `visual_signature_attempts` mantida

`DECIDIDO`

A coluna `visual_signature_attempts` na tabela `stores` não é removida nesta fase. Ela simplesmente para de ser incrementada e verificada. Motivos:

- Remover coluna exige migration com risco de quebra retroativa
- Dados históricos continuam disponíveis para analytics
- Se um dia precisarmos de um limite suave anti-abuso, podemos reutilizar a coluna com nova semântica

Nenhuma migration de schema nesta fase.

---

## Estrutura de Código

```
ARQUIVOS MODIFICADOS:
══════════════════════

src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
  ← Adicionar import getLaunchConfig(), CreditService
  ← Adicionar guard generationPaused (503)
  ← [REMOVER] if (totalCount >= 3) — guard de limite
  ← [REMOVER] store.update({ visual_signature_attempts }) — incremento
  ← [ADICIONAR] balance check + reserveCredit antes da IA
  ← [ADICIONAR] refundCredit em catch de falha
  ← [ADICIONAR] credit_tx_id no metadata da VS
  ← [ADICIONAR] try/finally para liberar lock + timeout

src/app/api/store/[id]/visual-signature/reject/route.ts
  ← [REMOVER] if (currentAttempts >= 3) — bloco exhausted
  ← Manter archive da draft (fluxo normal)

src/app/api/store/[id]/visual-signature/approve/route.ts
  ← [REMOVER] store.update({ visual_signature_attempts: 0 }) — reset
  ← Manter ativação + brand profile (fluxo normal)

src/components/flow/visual-signature-approval-modal.tsx
  ← [REMOVER] "Tentativa X/3" do display phase
  ← [REMOVER] guard state.attempt >= 3 no reject handler
  ← [REMOVER] sigs.length >= 3 → exhausted no checking phase
  ← [REMOVER] phase "exhausted" e toda sua renderização
  ← [ADICIONAR] tratamento de 402 no generate():
                if (res.status === 402) → insufficient_credits
  ← [ADICIONAR] phase "insufficient_credits" com:
                - mensagem "Créditos insuficientes para gerar assinatura visual"
                - CTA "Ver meus créditos" → /conta
                - CTA "Tentar novamente" (se receber créditos)
  ← [ADICIONAR] botão "Ver versões anteriores" se signatures.length > 1
                no display phase

src/components/flow/store-visual-signature-section.tsx
  ← [REMOVER ou OCULTAR] caminho que abre VisualSignatureModal
  ← Garantir que nenhuma UI acessível chame generateVariations() ou
     generateAutomatic()

src/lib/visual-signature/server-actions.ts
  ← NÃO modificado. generateVariations() e generateAutomatic() estão
     descontinuados (D2). O código pode permanecer, mas não é chamado
     pelo fluxo principal de VS.

src/lib/visual-signature/types.ts
  ← [ADICIONAR] campo opcional creditTxId em VisualSignatureMetadata
                (interface no metadata, sem alteração de schema)
```

---

## Contratos de Integração

### generate-without-logo — fluxo com créditos

```
REQUEST:
  POST /api/store/[storeId]/visual-signature/generate-without-logo
  { rejectionContext?, mode? }

PREFLIGHT:
  1. generationPaused? → 503
  2. Lock (generationLocks)
  3. Credits charging check
  4. Saldo >= 1? → 402 (insufficient_credits)
  5. reserveCredit(storeId, 1, { metadata: { feature: "visual_signature" } })
  6. Gerar via Art Director → cascade
     ├── Sucesso: persistSignature + salvar credit_tx_id no metadata
     └── Falha: refundCredit + retornar erro
  7. Liberar lock + timeout

RESPONSE SUCCESS:
  { success: true, assetUrl, signatureId, artDirectorOutput, attempt }

RESPONSE 402:
  { error: "Saldo insuficiente. Você precisa de créditos para gerar uma assinatura visual.",
    code: "insufficient_credits" }
```

### reserveCredit — metadata para VS

```typescript
const creditTxId = await creditService.reserveCredit(storeId, 1, {
  idempotencyKey: `vs_reserve_${storeId}_${operationId}`,
  metadata: {
    feature: "visual_signature",
    mode: body.mode ?? "standard",
    operationId,
  },
});
```

### Tratamento de 402 no modal

```typescript
// generate() no VisualSignatureApprovalModal
if (res.status === 402) {
  setState({
    phase: "insufficient_credits",
    message: "Créditos insuficientes para gerar assinatura visual.",
  });
  return;
}
```

### insufficient_credits — estado no modal

```typescript
case "insufficient_credits":
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <AlertCircle className="w-10 h-10 text-accent-amber" />
      <p className="text-text-primary font-body text-sm text-center max-w-sm">
        {state.message}
      </p>
      <p className="text-text-muted text-xs font-body text-center max-w-sm">
        Cada geração de assinatura visual consome 1 crédito.
      </p>
      <div className="flex flex-col gap-3 w-full">
        <a
          href="/conta"
          className="w-full px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 text-center"
        >
          Ver meus créditos
        </a>
        <button
          type="button"
          onClick={handleRetry}
          className="w-full px-6 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
```

### Review phase — sem limite de 3

```typescript
// No checking phase — REMOVER o guard >= 3
if (sigs.length >= 3) {  // ← REMOVER
  setState({ phase: "exhausted", signatures: sigs });
} else if (sigs.length > 0) {
  setState({ phase: "review", signatures: sigs, canGenerate: true });
} else {
  generate();
}

// Substituir por:
if (sigs.length > 0) {
  setState({ phase: "review", signatures: sigs });
} else {
  generate();
}
```

### Display phase — sem contador de tentativas

```typescript
// REMOVER o badge "Tentativa X/3"
// ANTES:
<div className="flex items-center gap-2">
  <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
    Tentativa {Math.min(attempt, 3)}/3
  </span>
</div>

// DEPOIS: não exibir contador. Opcional: exibir "1 crédito utilizado"
// Apenas se for uma informação de UX relevante e de baixo custo
```

---

## Testes

20+ testes seguindo padrão do repositório:

### Fluxo de crédito na VS (8 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `generate-without-logo` com saldo suficiente → reserve executado, VS criada | Crédito consumido |
| 2 | `generate-without-logo` com saldo = 0 → 402, VS não criada | Bloqueio correto |
| 3 | `generate-without-logo` com falha de IA → refund executado, saldo restaurado | Estorno |
| 4 | `generate-without-logo` com falha de storage → refund executado, saldo restaurado | Estorno |
| 5 | `generate-without-logo` com `creditsChargingEnabled=false` → sem reserve, VS criada | Flag respeitada |
| 6 | `generate-without-logo` com `generationPaused=true` → 503 | Emergency brake |
| 7 | `generate-without-logo` com `v15Enabled=false` → sem verificação de crédito | Master switch |
| 8 | Idempotência: mesmo idempotencyKey → segunda chamada não deduz novamente | Idempotência |

### Limite de 3 removido (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 9 | Gerar 5 VS sequencialmente (simular saldo suficiente) → todas criadas, sem bloqueio | Limite removido |
| 10 | Rejeitar todas as 5 → reject sempre retorna success, sem exhausted | Reject sem limite |
| 11 | Modal: 5 VS existentes → abre em review (não exhausted) | UI correta |
| 12 | Modal: gerar → rejeitar → gerar (10x) → funciona sem bloqueio | Ciclo infinito possível |
| 13 | `visual_signature_attempts` não é incrementado | Coluna inalterada |

### UI: tratamento de 402 (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 14 | Modal recebe 402 → exibe `insufficient_credits` state | UI correta |
| 15 | `insufficient_credits` → CTA "Ver meus créditos" → `/conta` | Navegação |
| 16 | `insufficient_credits` → "Tentar novamente" → nova tentativa | Recuperação |
| 17 | Modal sem contador "Tentativa X/3" | UX limpa |

### Histórico e review (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 18 | Review limita a 6 VS e não entra em exhausted | Apenas 6 signatures retornadas |
| 19 | Reativar VS antiga com drift → bloqueada com mensagem | Drift preservation |
| 20 | Reativar VS antiga sem drift → aprovada com sucesso | Restore funciona |

### Regressão (4+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 21 | `npm run build` | Build OK |
| 22 | `npm run typecheck` | Types OK |
| 23 | `npm run lint` | Lint OK |
| 24 | `npx vitest run` | ~889 testes existentes + novos passando |
| 25 | UAT: fluxo completo de VS com créditos (gerar → aprovar/rejeitar → gerar) | Sem quebras |
| 26 | UAT: fluxo de campanha continua consumindo créditos normalmente | Sem regressão |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Usuário gera dezenas de VS sem aprovar nenhuma** — acumula histórico e gasta créditos sem benefício | Experiência esperada (crédito = consumo). O review/histórico permite reaproveitar. Galeria dedicada em fase futura |
| **Drift em VS antigas** — reativar VS gerada há muito tempo com dados desatualizados da loja | Validação de drift já existe no backend. A UI review já mostra elegibilidade. Decisão final é server-side |
| **Modal fica pesado com muitas VS** — carregar dezenas de signatures no review | Review não carrega tudo. O review mostra as últimas N. Histórico completo é fase futura (galeria) |
| **VisualSignatureModal ainda acessível** — se o modal antigo não for ocultado, o usuário pode gerar VS sem consumir crédito | D2 decidiu descontinuar. Verificar na implementação que o modal antigo não está mais acessível na UI |
| **Lock de concorrência com crédito** — dois requests simultâneos para mesma loja podem reservar 2 créditos | Lock mantido. Balance check + reserve DENTRO do lock. Ordem: lock → balance → reserve → geração |
| **Refund em falha não executado** — catch não tratado corretamente deixa crédito preso | try/finally no handler. Refund no catch de qualquer erro após reserve |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Galeria/Histórico completo de VS (página dedicada) | Fase futura (29.1.2 ou 29.2). Modal mantém review limitado |
| Stripe Checkout / compra real de créditos | F30/v1.6 |
| Créditos mensais freemium (5 a cada 30 dias) | Fase futura (29.1.3) |
| Onboarding: 5 → 10 créditos | Fase futura (29.1.4) |
| Changelog in-app | Fase futura (29.1.5) |
| Remoção da coluna `visual_signature_attempts` | Mantida (sem migration). Dados históricos preservados |
| Redesenho do `VisualSignatureModal` (modal antigo) | Descontinuado (D2). Apenas ocultar da UI, sem redesenho |
| UI de saldo restante no modal de VS | Não obrigatório nesta fase. Pode ser adicionado se houver caminho barato (ex.: balance já carregado no AppShell) |
| Notificações de crédito baixo | Fora do escopo |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — VS passa a consumir créditos, substituindo limite fixo de 3 gerações
- [x] D2 — `VisualSignatureModal` descontinuado. `generateVariations()` e `generateAutomatic()` sem integração de crédito. Todo esforço concentrado no `VisualSignatureApprovalModal`
- [ ] D3 — Histórico de VS dividido em modal (agora) + galeria (futuro)
- [ ] D4 — `reserveCredit` para VS usa `campaignId: null` + `metadata.feature: "visual_signature"`
- [ ] D5 — Launch Config respeitado no fluxo de VS (`creditsChargingEnabled`, `generationPaused`, `v15Enabled`)
- [ ] D6 — Lock + try/finally no handler de geração
- [ ] D7 — `visual_signature_attempts` mantida, não removida

### generate-without-logo/route.ts
- [ ] Guard `generationPaused` → 503
- [ ] [REMOVER] `totalCount >= 3` guard
- [ ] [REMOVER] `visual_signature_attempts` increment
- [ ] [ADICIONAR] Balance check + `reserveCredit` antes da IA
- [ ] [ADICIONAR] `refundCredit` em catch de falha
- [ ] [ADICIONAR] `credit_tx_id` no metadata da VS
- [ ] [ADICIONAR] try/finally para lock + timeout
- [ ] [ADICIONAR] Respeitar `creditsChargingEnabled`

### reject/route.ts
- [ ] [REMOVER] `currentAttempts >= 3` exhausted block

### approve/route.ts
- [ ] [REMOVER] `visual_signature_attempts = 0` reset

### VisualSignatureApprovalModal
- [ ] [REMOVER] Badge "Tentativa X/3"
- [ ] [REMOVER] Guard `state.attempt >= 3` no reject
- [ ] [REMOVER] `sigs.length >= 3` → exhausted
- [ ] [REMOVER] Phase "exhausted" e renderização
- [ ] [ADICIONAR] Tratamento de 402 → `insufficient_credits`
- [ ] [ADICIONAR] Phase "insufficient_credits" com CTA
- [ ] [ADICIONAR] Botão "Ver versões anteriores" se houver histórico

### server-actions.ts (descontinuado — D2)
- [ ] `generateVariations()` e `generateAutomatic()` não recebem integração de crédito
- [ ] `VisualSignatureModal` ocultado da UI

### Testes
- [ ] Fluxo de crédito na VS (8+ testes)
- [ ] Limite de 3 removido (5+ testes)
- [ ] UI: tratamento de 402 (4+ testes)
- [ ] Histórico/review (3+ testes)
- [ ] Regressão: build, typecheck, lint, vitest
- [ ] UAT: fluxo completo de VS com créditos

---

*Documento criado: 2026-07-21*
*Baseado em discussão exploratória sobre o fluxo real de geração de assinatura visual e alinhamento com o modelo de créditos existente.*
*Próximo passo: revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
