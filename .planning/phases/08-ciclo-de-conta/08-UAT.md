---
status: complete
phase: 08-ciclo-de-conta
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md
started: 2026-07-06T12:00:00Z
updated: 2026-07-06T17:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Login Navigation Links
expected: Abrir /login — links "Esqueci minha senha" (abaixo do campo senha) e "Criar conta" (abaixo do botão) visíveis e funcionais
result: pass

### 2. Signup Form — Validação
expected: Preencher senha < 6 caracteres ou senhas diferentes no /signup — mensagem de erro em português aparece sem submeter
result: pass

### 3. Signup Form — Submissão
expected: Submeter signup com email+senha válidos — redireciona para /check-email?type=signup (nunca mostra erro)
result: pass

### 4. Check-email — Copy Contextual Signup
expected: /check-email?type=signup — mensagem diz "link de confirmação" (não recovery/generic). Não exibe o email do usuário.
result: pass

### 5. Signup Email Delivery
expected: Email de confirmação chega na caixa de entrada via SMTP configurado (Impromx/Hostinger), com template em português.
result: pass

### 6. Auth Confirm — Signup
expected: Clicar no link de confirmação do email — abre /auth/confirm?token_hash=...&type=signup — redireciona para / (login automático)
result: pass

### 7. Forgot-password Form
expected: Submeter email em /forgot-password — redireciona para /check-email?type=recovery (nunca mostra erro)
result: pass

### 8. Check-email — Copy Contextual Recovery
expected: /check-email?type=recovery — mensagem diz "link de redefinição de senha"
result: pass

### 9. Recovery Email Delivery
expected: Email de recovery chega na caixa de entrada. Link contém token_hash, type=recovery e next=/update-password
result: pass

### 10. Auth Confirm — Recovery + Update Password
expected: Clicar link de recovery — abre /auth/confirm...&next=/update-password — redireciona para /update-password. Definir nova senha > 6 caracteres — redireciona para /. Fazer logout e login com nova senha funciona.
result: pass

### 11. Middleware — Rota Pública Anônimo
expected: Sem sessão, acessar /signup, /login, /check-email, /forgot-password — páginas carregam normalmente (sem redirect)
result: pass

### 12. Middleware — /auth/confirm Always Passthrough
expected: /auth/confirm sempre passa pelo middleware, com ou sem sessão (handler faz próprio redirect)
result: pass

### 13. Middleware — /update-password Protegido
expected: Sem sessão, /update-password redireciona para /login
result: pass

### 14. Middleware — Autenticado Redireciona de Public Routes
expected: Com sessão ativa, acessar /login ou /signup — redireciona para /
result: pass

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0

## Gaps

# Gap 1 (resolved): Templates PT-BR copiados para o Dashboard manualmente pelo usuário

# Gap 2 (resolved): Template recovery customizado no Dashboard com token_hash manualmente pelo usuário
