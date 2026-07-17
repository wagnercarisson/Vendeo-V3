---
status: complete
phase: 25-integracao-transacional-pipeline
source: 25-01-SUMMARY.md, 25-02-SUMMARY.md, 25-03-SUMMARY.md
started: 2026-07-17T16:30:00Z
updated: 2026-07-17T17:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Criar loja + onboarding grant
expected: POST /api/store → 201 + store criada + saldo = 5 créditos
result: pass

### 2. Geração com saldo suficiente
expected: Fluxo completo no formulário → campanha gerada → 1 crédito debitado
result: pass

### 3. Rate limit — exceder 10/hora
expected: Após 10 gerações na janela, próxima geração retorna 429 Too Many Requests
result: pass
reason: Validated via code review + 6 unit tests covering hourly/daily/INSERT/edge cases

### 4. Saldo insuficiente retorna 402
expected: Zerar créditos → tentar gerar → 402 Payment Required na resposta HTTP
result: pass

### 5. mandatoryArtworkText no formulário
expected: Campo "Texto obrigatório na arte (opcional)" visível no formulário de campanha, abaixo do CTA
result: pass

### 6. mandatoryArtworkText influencia a arte
expected: Preencher "Imagens meramente ilustrativas" → arte gerada contém o texto; legenda NÃO contém
result: pass

### 7. Estorno em falha de geração
expected: Simular falha de IA (desabilitar API) → campanha fica error → 0 créditos debitados (estorno)
result: pass

### 8. Campanha antiga sem title não quebra
expected: Navegar para campanha gerada antes da F25 → página carrega sem erros, sem campo title
result: pass

### 9. Campanha F25+ com title visível
expected: Campanha nova gerada → página de campanha mostra título (title) do Copy Director
result: pass

### 10. Edição de publication copy preserva title
expected: Editar caption de campanha F25 → salvar → title original NÃO é sobrescrito
result: pass

### 11. Retry Gemini (se configurado)
expected: Se GEMINI_API_KEY + TEXT_FALLBACK_PROVIDER=gemini configurados → falha do OpenAI → fallback Gemini ativado → campanha gerada com sucesso
result: skipped
reason: Validated via testes automatizados (#17-19). Usuário não tem Gemini configurado. Comentar OPENAI_MODEL NÃO ativa fallback — o código lê OPENAI_TEXT_MODEL, não OPENAI_MODEL.

### 12. Onboarding grant idempotente
expected: Uma store por user. Segundo POST /api/store para mesmo user → 409. Grant idempotente via onboarding_{storeId}
result: pass

## Summary

total: 12
passed: 11
issues: 0
pending: 0
skipped: 1
skipped: 0
blocked: 0

## Gaps

[none yet]
