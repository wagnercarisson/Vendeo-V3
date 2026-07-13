---
status: complete
phase: 18-app-shell-ui-base-rotas
source: 18-01-SUMMARY.md, 18-02-SUMMARY.md, 18-03-SUMMARY.md
started: 2026-07-13T15:00:00Z
updated: 2026-07-13T15:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Navegação Desktop — Sidebar
expected: Sidebar com 4 links, destaque de rota ativa, navegação funcional
result: pass

### 2. Navegação Desktop — Topbar
expected: Topbar mostra logo "Vendeo", CTA "Nova Campanha" → /campanhas/nova, AccountMenu com email/identificador do usuário
result: pass

### 3. Account Menu — Dropdown
expected: Clicar no menu de conta mostra "Configurações" (link /conta) e "Sair" (LogoutButton)
result: pass

### 4. Drawer Mobile
expected: Em viewport <768px, hamburger aparece; clicar abre drawer com sidebar; overlay escuro atrás; clicar overlay ou Escape fecha
result: pass

### 5. Rota /campanhas — Lista de Campanhas
expected: /campanhas mostra lista de campanhas com thumbnail, nome, data, status; botão "Nova Campanha" no topo
result: pass

### 6. Rota /campanhas/[id] — Detalhe da Campanha
expected: /campanhas/[id] mostra breadcrumb, imagem, "Kit de Publicação" (caption, hashtags, CTA), botão "Editar", botão "Baixar Original"
result: pass

### 7. Redirects 301
expected: /minhas-campanhas → /campanhas, /campanha/:id → /campanhas/:id, /store → /loja, /campaign/preview → /campanhas/nova, / → /dashboard
result: pass

### 8. Proteção de Autenticação
expected: Usuário não autenticado acessando qualquer rota (app) → redirecionado para /login
result: pass

### 9. Logout
expected: Clicar "Sair" no AccountMenu → sessão encerrada → redirecionado para /login
result: pass

### 10. Rota /loja — Perfil da Loja
expected: /loja carrega e mostra perfil da loja ou formulário de onboarding
result: pass

### 11. Rota /conta — Configurações
expected: /conta carrega e mostra página de configurações da conta
result: pass

### 12. Rota /dashboard — Placeholder
expected: /dashboard carrega como placeholder funcional (sem erro)
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
