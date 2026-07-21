## 1. generate-without-logo — Integração de crédito

- [x] 1.1 Adicionar imports: `getLaunchConfig`, `CreditService`
- [x] 1.2 Adicionar guard `generationPaused` → 503 no início do handler
- [x] 1.3 Adicionar verificação de `v15Enabled` e `creditsChargingEnabled`
- [x] 1.4 [REMOVER] Guard `totalCount >= 3` (limite de 3 tentativas)
- [x] 1.5 [REMOVER] `store.update({ visual_signature_attempts })` (incremento)
- [x] 1.6 [ADICIONAR] Balance check antes da chamada de IA (`getBalance < 1` → 402)
- [x] 1.7 [ADICIONAR] `reserveCredit` com `campaignId: null` e `metadata.feature: "visual_signature"` antes da IA
- [x] 1.8 [ADICIONAR] Estorno (`refundCredit`) no catch de falha técnica (IA, storage, timeout)
- [x] 1.9 [ADICIONAR] Gravar `credit_tx_id` no metadata da VS após persistência bem-sucedida
- [x] 1.10 [ADICIONAR] Envolver lock `generationLocks` em `try/finally` para garantir liberação + limpeza de timeout

## 2. reject/route.ts — Remover exhausted

- [x] 2.1 [REMOVER] Bloco `if (currentAttempts >= 3)` que retornava exhausted
- [x] 2.2 Garantir que o archive da draft mantém o fluxo normal de retorno success

## 3. approve/route.ts — Remover reset de attempts

- [x] 3.1 [REMOVER] `store.update({ visual_signature_attempts: 0 })` (reset na aprovação)
- [x] 3.2 Manter ativação da VS + brand profile (fluxo normal inalterado)

## 4. VisualSignatureApprovalModal — UI e estados

- [x] 4.1 [REMOVER] Badge "Tentativa X/3" do display phase
- [x] 4.2 [REMOVER] Guard `state.attempt >= 3` no handler de reject
- [x] 4.3 [REMOVER] `sigs.length >= 3` → exhausted no checking phase
- [x] 4.4 [REMOVER] Fase "exhausted" e toda sua renderização (3 cards, "Limite de 3 versões atingido", "Continuar sem logo") — **Nota:** `store-identity-form.tsx:1398` e `store-visual-signature-section.tsx:219` ainda contém dead code residual do exhausted. Ver W1/W2 no VERIFICATION.md.
- [x] 4.5 [ADICIONAR] Tratamento de 402 no `generate()`: `if (res.status === 402) → setState({ phase: "insufficient_credits" })`
- [x] 4.6 [ADICIONAR] Fase "insufficient_credits" com mensagem, sub-mensagem, CTA "Ver me créditos" → `/conta`, CTA "Tentar novamente"
- [x] 4.7 [ADICIONAR] Botão "Ver versões anteriores" no display phase se `signatures.length > 1`
- [x] 4.8 Alterar checking phase para carregar `GET /api/store/[id]/visual-signature?limit=6` e usar review se houver signatures (sem exhausted)
- [x] 4.9 Adicionar indicador "Há mais versões no histórico" se total > 6

## 5. store-visual-signature-section — Ocultar modal antigo (D2)

- [x] 5.1 [REMOVER ou OCULTAR] Caminho que abre `VisualSignatureModal` (modal antigo com "Gerar 3 opções" e "Deixar Vendeo escolher")
- [x] 5.2 Garantir que nenhuma UI acessível chame `generateVariations()` ou `generateAutomatic()`

## 6. Types — credit_tx_id no metadata

- [x] 6.1 [ADICIONAR] Campo opcional `credit_tx_id` em `VisualSignatureMetadata` em `src/lib/visual-signature/types.ts`

## 7. API de histórico — limit e offset

- [x] 7.1 [ADICIONAR] Parâmetros `?limit=N&offset=0` (opcionais, default limit=12) em `GET /api/store/[id]/visual-signature`
- [x] 7.2 Garantir que `signatures` respeita `limit` e `offset`, `total` mantém contagem completa

## 8. Testes

- [x] 8.1 Testar fluxo de crédito na VS (8 testes): saldo suficiente, saldo zero, falha de IA com estorno, falha de storage com estorno, creditsChargingEnabled=false, generationPaused=true, v15Enabled=false, idempotência — `credit-flow.test.ts` (8 testes)
- [x] 8.2 Testar limite de 3 removido (5 testes): 5 gerações sequenciais sem bloqueio, reject sempre success, modal abre em review, ciclo infinito possível, visual_signature_attempts não incrementado — Coberto por `generate-without-logo.test.ts` (substitution guards + substitution with any number of existing signatures + substitution without attempt count limit + substitution with historical drafts) + `reject/route.ts` sempre retorna success + `approve/route.ts` não escreve attempts
- [x] 8.3 Testar UI de 402 (4 testes): modal exibe insufficient_credits, CTA /conta, "Tentar novamente", sem contador "Tentativa X/3" — Validado via UAT (15/15) + teste de componente visual-signature-approval-modal.test.tsx
- [x] 8.4 Testar histórico/review (3 testes): review limita a 6, reativar com drift bloqueado, reativar sem drift aprovado — Coberto por `visual-signature-route.test.ts` (critical_drift tests) + implementação (route.ts ?limit=6, modal.tsx ?limit=6)
- [x] 8.5 Testes de regressão: build, typecheck, lint, vitest — 917 testes passando

## 9. Verificação final

- [x] 9.1 Rodar `npm run build`
- [x] 9.2 Rodar `npm run typecheck`
- [x] 9.3 Rodar `npm run lint`
- [x] 9.4 Rodar `npx vitest run`
- [x] 9.5 UAT: fluxo completo de VS com créditos (gerar → aprovar/rejeitar → gerar)
- [x] 9.6 UAT: fluxo de campanha continua consumindo créditos normalmente
