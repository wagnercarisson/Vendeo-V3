---
status: complete
phase: 05-identity-aware-campaign-briefing
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md
started: 2026-07-03T00:00:00.000Z
updated: 2026-07-03T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Bloco de identidade da loja mostra estado correto
expected: Após carregar uma loja na página de campanha, o StoreIdentityBlock exibe o badge de identity_state correto (text_only, logo ou visual_signature), o asset de assinatura (ou fallback de iniciais) e a seção de perfil de marca com segmento e cores
result: pass

### 2. Geração de campanha com loja que tem logo
expected: Para uma loja com logo ativo, gerar uma campanha produz um resultado onde a campanha renderizada exibe o logotipo como assinatura de identidade
result: pass

### 3. Geração de campanha com loja que tem VS
expected: Para uma loja com assinatura visual ativa, gerar uma campanha mostra a assinatura visual como identidade (sem logo)
result: pass

### 4. Geração de campanha para loja text_only
expected: Para uma loja text_only (sem logo, sem VS), gerar uma campanha não mostra logo nem VS — apenas fallback de iniciais
result: pass

### 5. Geração de campanha após remoção de logo
expected: Após remover o logo de uma loja, gerar uma campanha não mostra logo (diretriz: "Não inventar logotipo"), estado de identidade mostra text_only
result: pass

### 3. Geração de campanha com loja que tem VS
expected: Para uma loja com assinatura visual ativa, gerar uma campanha mostra a assinatura visual como identidade (sem logo)
result: [pending]

### 4. Geração de campanha para loja text_only
expected: Para uma loja text_only (sem logo, sem VS), gerar uma campanha não mostra logo nem VS — apenas fallback de iniciais
result: [pending]

### 5. Geração de campanha após remoção de logo
expected: Após remover o logo de uma loja, gerar uma campanha não mostra logo (diretriz: "Não inventar logotipo"), estado de identidade mostra text_only
result: [pending]

### 6. Compatibilidade de preview legado
expected: Uma URL/payload de preview antigo (sem campo identityState) ainda renderiza corretamente — a identidade é normalizada dos campos logoUrl/visualSignatureUrl
result: skipped
reason: "Não tenho campanhas antigas salvas para testar — código verificado manualmente em src/app/campaign/preview/page.tsx"

### 7. Testes automatizados passam
expected: npx vitest run mostra 15/15 testes passando para as actions de identidade da loja
result: pass

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 1

## Gaps

[none yet]
