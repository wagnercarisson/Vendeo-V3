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
- O consumidor administrativo foi migrado para saldo disponível; a página admin não seleciona mais `credit_balances.balance`. Fixtures foram co-migradas para o novo breakdown.
- Corrigido o consumidor administrativo: página de usuários e RPC `admin_get_users_summary` agora calculam saldo disponível, excluindo demo vencida.
- `checkDemoEligibility` bloqueia `onboarding`, `demo` e `admin_exception`.

## Validation

- `npm run typecheck`: PASS.
- Credit/freemium tests: 46/46 PASS.
- Nenhum consumidor produtivo lê diretamente `credit_balances.balance` bruto; a página administrativa consulta `credit_balances` para derivar o saldo disponível.
- `supabase db reset --local`: PASS; RPC administrativa redefinida e verificada.
