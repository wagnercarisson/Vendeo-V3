---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 04
subsystem: credit-services
tags: [credits, demo, entitlement, launch-config]
completed: 2026-09-21
---

# Phase 50 Plan 04 Summary

## Accomplishments

- `CreditService.getBalance` agora deriva saldo disponível sem materializar expiração.
- `getBalanceBreakdown` expõe saldo bruto, demo, bônus, comprado e disponível.
- Tipos e labels incluem `demo` e `expiration`.
- Entitlement service ganhou elegibilidade e concessão demo idempotente via RPC.
- Launch config ganhou flags demo/email fail-closed; mensal preservado default `true`.
- Criado helper puro `getDemoStatus`/`formatRelativeExpiry` com estados ativos, próximos, exauridos, expirados e inexistentes.
- Inventário não encontrou consumidores produtivos adicionais de `credit_balances.balance`; o serviço era o único acesso direto relevante. Fixtures foram co-migradas para o novo breakdown.
- Corrigido o consumidor administrativo: página de usuários e RPC `admin_get_users_summary` agora calculam saldo disponível, excluindo demo vencida.
- `checkDemoEligibility` bloqueia `onboarding`, `demo` e `admin_exception`.

## Validation

- `npm run typecheck`: PASS.
- Credit/freemium tests: 41/41 PASS.
- Nenhum acesso produtivo adicional a `credit_balances` fora de `credit-service` foi encontrado no inventário executado.
- `supabase db reset --local`: PASS; RPC administrativa redefinida e verificada.
