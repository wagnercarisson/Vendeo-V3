## 1. generate-without-logo — Integração de crédito

- [ ] 1.1 Adicionar imports: `getLaunchConfig`, `CreditService`
- [ ] 1.2 Adicionar guard `generationPaused` → 503 no início do handler
- [ ] 1.3 Adicionar verificação de `v15Enabled` e `creditsChargingEnabled`
- [ ] 1.4 [REMOVER] Guard `totalCount >= 3` (limite de 3 tentativas)
- [ ] 1.5 [REMOVER] `store.update({ visual_signature_attempts })` (incremento)
- [ ] 1.6 [ADICIONAR] Balance check antes da chamada de IA (`getBalance < 1` → 402)
- [ ] 1.7 [ADICIONAR] `reserveCredit` com `campaignId: null` e `metadata.feature: "visual_signature"` antes da IA
- [ ] 1.8 [ADICIONAR] Estorno (`refundCredit`) no catch de falha técnica (IA, storage, timeout)
- [ ] 1.9 [ADICIONAR] Gravar `credit_tx_id` no metadata da VS após persistência bem-sucedida
- [ ] 1.10 [ADICIONAR] Envolver lock `generationLocks` em `try/finally` para garantir liberação + limpeza de timeout

## 2. reject/route.ts — Remover exhausted

- [ ] 2.1 [REMOVER] Bloco `if (currentAttempts >= 3)` que retornava exhausted
- [ ] 2.2 Garantir que o archive da draft mantém o fluxo normal de retorno success

## 3. approve/route.ts — Remover reset de attempts

- [ ] 3.1 [REMOVER] `store.update({ visual_signature_attempts: 0 })` (reset na aprovação)
- [ ] 3.2 Manter ativação da VS + brand profile (fluxo normal inalterado)

## 4. VisualSignatureApprovalModal — UI e estados

- [ ] 4.1 [REMOVER] Badge "Tentativa X/3" do display phase
- [ ] 4.2 [REMOVER] Guard `state.attempt >= 3` no handler de reject
- [ ] 4.3 [REMOVER] `sigs.length >= 3` → exhausted no checking phase
- [ ] 4.4 [REMOVER] Fase "exhausted" e toda sua renderização (3 cards, "Limite de 3 versões atingido", "Continuar sem logo")
- [ ] 4.5 [ADICIONAR] Tratamento de 402 no `generate()`: `if (res.status === 402) → setState({ phase: "insufficient_credits" })`
- [ ] 4.6 [ADICIONAR] Fase "insufficient_credits" com mensagem, sub-mensagem, CTA "Ver meus créditos" → `/conta`, CTA "Tentar novamente"
- [ ] 4.7 [ADICIONAR] Botão "Ver versões anteriores" no display phase se `signatures.length > 1`
- [ ] 4.8 Alterar checking phase para carregar `GET /api/store/[id]/visual-signature?limit=6` e usar review se houver signatures (sem exhausted)
- [ ] 4.9 Adicionar indicador "Há mais versões no histórico" se total > 6

## 5. store-visual-signature-section — Ocultar modal antigo (D2)

- [ ] 5.1 [REMOVER ou OCULTAR] Caminho que abre `VisualSignatureModal` (modal antigo com "Gerar 3 opções" e "Deixar Vendeo escolher")
- [ ] 5.2 Garantir que nenhuma UI acessível chame `generateVariations()` ou `generateAutomatic()`

## 6. Types — credit_tx_id no metadata

- [ ] 6.1 [ADICIONAR] Campo opcional `credit_tx_id` em `VisualSignatureMetadata` em `src/lib/visual-signature/types.ts`

## 7. API de histórico — limit e offset

- [ ] 7.1 [ADICIONAR] Parâmetros `?limit=N&offset=0` (opcionais, default limit=12) em `GET /api/store/[id]/visual-signature`
- [ ] 7.2 Garantir que `signatures` respeita `limit` e `offset`, `total` mantém contagem completa

## 8. Testes

- [ ] 8.1 Testar fluxo de crédito na VS (8 testes): saldo suficiente, saldo zero, falha de IA com estorno, falha de storage com estorno, creditsChargingEnabled=false, generationPaused=true, v15Enabled=false, idempotência
- [ ] 8.2 Testar limite de 3 removido (5 testes): 5 gerações sequenciais sem bloqueio, reject sempre success, modal abre em review, ciclo infinito possível, visual_signature_attempts não incrementado
- [ ] 8.3 Testar UI de 402 (4 testes): modal exibe insufficient_credits, CTA /conta, "Tentar novamente", sem contador "Tentativa X/3"
- [ ] 8.4 Testar histórico/review (3 testes): review limita a 6, reativar com drift bloqueado, reativar sem drift aprovado
- [ ] 8.5 Testes de regressão: build, typecheck, lint, vitest

## 9. Verificação final

- [ ] 9.1 Rodar `npm run build`
- [ ] 9.2 Rodar `npm run typecheck`
- [ ] 9.3 Rodar `npm run lint`
- [ ] 9.4 Rodar `npx vitest run`
- [ ] 9.5 UAT: fluxo completo de VS com créditos (gerar → aprovar/rejeitar → gerar)
- [ ] 9.6 UAT: fluxo de campanha continua consumindo créditos normalmente
