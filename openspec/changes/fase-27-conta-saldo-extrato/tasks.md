## 1. CreditService — Session Client + countCreditTransactions

- [ ] 1.1 Relaxar tipo do construtor de `CreditService` para aceitar `SupabaseClient` genérico (não apenas `typeof supabaseAdmin`), sem quebrar usos existentes em F24, F25, F26
- [ ] 1.2 Implementar `countCreditTransactions(storeId: string): Promise<number>` com `.neq("type", "adjustment")` e `{ count: "exact", head: true }`
- [ ] 1.3 Verificar RLS com cliente de sessão: SELECT em `credit_balances` + `credit_transactions` via `createServerClient()`

## 2. Componente BalanceDisplay

- [ ] 2.1 Criar `src/components/credit/balance-display.tsx` — Server Component com props `balance`, `hasStore?`, `variant` (badge/card/inline), `showCta`, `ctaHref`
- [ ] 2.2 Implementar 3 variantes visuais: badge (compacto), card (destaque), inline (ícone + valor)
- [ ] 2.3 Implementar estados baseados no saldo: normal (≥3) badge verde, baixo (>0 e <3) badge amarelo, zero badge vermelho com CTA condicional
- [ ] 2.4 Implementar estado sem loja: fallback "0 créditos" sem badge de alerta

## 3. Componente BalanceCard

- [ ] 3.1 Criar `src/components/credit/balance-card.tsx` — Server Component com card de saldo completo
- [ ] 3.2 Implementar exibição de valor formatado + descrição "Cada geração consome 1 crédito"
- [ ] 3.3 Implementar CTA "Solicitar créditos" condicional (saldo zero/baixo) e "Criar loja" (sem store)
- [ ] 3.4 Implementar estados: loading (skeleton), erro (mensagem distinta, não "0 créditos")

## 4. Componente TransactionHistory

- [ ] 4.1 Criar `src/components/credit/transaction-history.tsx` — Client Component (`"use client"`) que recebe dados por props e gerencia navegação via `useRouter` + `useSearchParams`
- [ ] 4.2 Implementar colunas: Tipo, Valor, Saldo, Motivo, Data — com mapeamento de tipos (grant→Concessão, deduction→Geração, etc.)
- [ ] 4.3 Integrar com `Pagination` da F21: props `transactions`, `totalPages`, `currentPage`; `onPageChange` atualiza `?page=N` na URL
- [ ] 4.4 Implementar empty state: "Nenhuma transação encontrada"

## 5. Componente CreditCta

- [ ] 5.1 Criar `src/components/credit/credit-cta.tsx` — Client Component com modal interativo
- [ ] 5.2 Implementar modal com instruções de contato e link `mailto:` quando `SUPPORT_EMAIL` configurado
- [ ] 5.3 Implementar fallback sem email: mensagem explicativa sem envio automático
- [ ] 5.4 Implementar variantes: zero (CTA destacado), low (CTA discreto), normal (null — não renderiza)

## 6. Dashboard — Indicador de Saldo

- [ ] 6.1 Modificar `src/app/(app)/dashboard/page.tsx` para buscar saldo via `CreditService.getBalance(store.id)` quando usuário tem loja
- [ ] 6.2 Adicionar `BalanceDisplay` (variant="badge") no grid de métricas para `has_store_with_campaigns`
- [ ] 6.3 Adicionar `BalanceDisplay` no empty state para `has_store_no_campaigns`
- [ ] 6.4 Garantir que `no_store` não exibe badge de saldo
- [ ] 6.5 Tratar erro de carregamento: fallback "—" sem quebrar a página

## 7. Página /conta — Seção de Créditos

- [ ] 7.1 Modificar `src/app/(app)/conta/page.tsx` para buscar saldo + extrato paginado via `CreditService` com cliente de sessão
- [ ] 7.2 Adicionar seção "Créditos" com `BalanceCard` (saldo) + `TransactionHistory` (extrato) + `CreditCta` (condicional)
- [ ] 7.3 Implementar paginação via searchParams: `page` com limit 10, total via `countCreditTransactions()`
- [ ] 7.4 Tratar estados: sem loja (CTA criar loja, sem extrato), loading (skeleton), erro (mensagem distinta)

## 8. Fluxo de Geração — Saldo Antes de Gerar

- [ ] 8.1 Modificar server component `src/app/(app)/campanhas/nova/page.tsx` para buscar saldo via `CreditService.getBalance(store.id)`
- [ ] 8.2 Passar saldo como prop para `CampaignPageClient` (ou componente de formulário)
- [ ] 8.3 Adicionar indicador inline "⚡ Saldo: X créditos    Custo: 1" antes do botão "Gerar campanha"
- [ ] 8.4 Desabilitar botão "Gerar campanha" com tooltip quando saldo = 0
- [ ] 8.5 Exibir CTA "Solicitar créditos" quando saldo = 0
- [ ] 8.6 Tratar erro de carregamento: mensagem distinta "Não foi possível confirmar seu saldo. Tente novamente." + botão gerar desabilitado com tooltip + ação "Tentar novamente" para recarregar — nunca tratar como saldo zero

## 9. Testes — Componentes de Crédito

- [ ] 9.1 `BalanceDisplay` com saldo normal → badge verde (#1)
- [ ] 9.2 `BalanceDisplay` com saldo baixo → badge amarelo (#2)
- [ ] 9.3 `BalanceDisplay` com saldo zero → badge vermelho + CTA (#3)
- [ ] 9.4 `BalanceDisplay` com `hasStore: false` → fallback 0 sem badge de alerta (#4)
- [ ] 9.5 `BalanceCard` com saldo → valor formatado (#5)
- [ ] 9.6 `BalanceCard` com saldo zero → CTA visível (#6)
- [ ] 9.7 `BalanceCard` sem store → mensagem onboarding + CTA criar loja (#7)
- [ ] 9.8 `TransactionHistory` com transações → tabela paginada (#8)
- [ ] 9.9 `TransactionHistory` vazio → empty state (#9)
- [ ] 9.10 `TransactionHistory` com paginação → navegação entre páginas (#10)
- [ ] 9.11 `CreditCta` → modal/mailto com email configurado (#11)

## 10. Testes — Dashboard + Geração

- [ ] 10.1 Dashboard `has_store_with_campaigns` → badge de saldo no grid (#12)
- [ ] 10.2 Dashboard `has_store_no_campaigns` → badge de saldo no empty state (#13)
- [ ] 10.3 Dashboard sem loja → sem badge de saldo (#14)
- [ ] 10.4 `/campanhas/nova` com saldo ≥ 1 → botão gerar habilitado + saldo visível (#15)
- [ ] 10.5 `/campanhas/nova` com saldo 0 → botão gerar desabilitado + tooltip + CTA (#16)
- [ ] 10.6 `/campanhas/nova` com erro de saldo → botão gerar desabilitado + tooltip + ação "Tentar novamente" + mensagem distinta (não saldo zero, não CTA solicitar)

## 11. Testes — Integração CreditService

- [ ] 11.1 `CreditService` com cliente de sessão → lê saldo do próprio store via RLS (#17)
- [ ] 11.2 `CreditService` com cliente de sessão → extrato filtrado (sem adjustment) (#18)
- [ ] 11.3 `countCreditTransactions()` → total de transações do store (#19)

## 12. Verificação Final

- [ ] 12.1 Executar `npx vitest run src/components/credit/__tests__/` — 11+ testes passando
- [ ] 12.2 Executar `npm run typecheck` — zero erros
- [ ] 12.3 Executar `npm run lint` — zero erros
- [ ] 12.4 Executar `npx vitest run` — novos + existentes passando (zero regressão)
- [ ] 12.5 Executar `npm run build` — build bem-sucedido
- [ ] 12.6 UAT local: saldo visível no dashboard (com e sem campanhas), extrato paginado em `/conta`, CTA em saldo zero, geração bloqueada sem crédito
- [ ] 12.7 UAT local: erro ao carregar saldo mostra mensagem distinta, não "saldo zero"
