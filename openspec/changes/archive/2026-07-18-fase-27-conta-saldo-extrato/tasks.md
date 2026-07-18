## 1. CreditService — Session Client + countCreditTransactions

- [x] 1.1 Relaxar tipo do construtor de `CreditService` para aceitar `SupabaseClient` genérico (não apenas `typeof supabaseAdmin`), sem quebrar usos existentes em F24, F25, F26
- [x] 1.2 Implementar `countCreditTransactions(storeId: string): Promise<number>` com `.neq("type", "adjustment")` e `{ count: "exact", head: true }`
- [x] 1.3 Verificar RLS com cliente de sessão: SELECT em `credit_balances` + `credit_transactions` via `createServerClient()`

## 2. Componente BalanceDisplay

- [x] 2.1 Criar `src/components/credit/balance-display.tsx` — Server Component com props `balance`, `hasStore?`, `variant` (badge/card/inline), `showCta`, `ctaHref`
- [x] 2.2 Implementar 3 variantes visuais: badge (compacto), card (destaque), inline (ícone + valor)
- [x] 2.3 Implementar estados baseados no saldo: normal (≥3) badge verde, baixo (>0 e <3) badge amarelo, zero badge vermelho com CTA condicional
- [x] 2.4 Implementar estado sem loja: fallback "0 créditos" sem badge de alerta

## 3. Componente BalanceCard

- [x] 3.1 Criar `src/components/credit/balance-card.tsx` — Server Component com card de saldo completo
- [x] 3.2 Implementar exibição de valor formatado + descrição "Cada geração consome 1 crédito"
- [x] 3.3 Implementar CTA "Solicitar créditos" condicional (saldo zero/baixo) e "Criar loja" (sem store)
- [x] 3.4 Implementar estados: loading (skeleton), erro (mensagem distinta, não "0 créditos")

## 4. Componente TransactionHistory

- [x] 4.1 Criar `src/components/credit/transaction-history.tsx` — Client Component (`"use client"`) que recebe dados por props e gerencia navegação via `useRouter` + `useSearchParams`
- [x] 4.2 Implementar colunas: Tipo, Valor, Saldo, Motivo, Data — com mapeamento de tipos (grant→Concessão, deduction→Geração, etc.)
- [x] 4.3 Integrar com `Pagination` da F21: props `transactions`, `totalPages`, `currentPage`; `onPageChange` atualiza `?page=N` na URL
- [x] 4.4 Implementar empty state: "Nenhuma transação encontrada"

## 5. Componente CreditCta

- [x] 5.1 Criar `src/components/credit/credit-cta.tsx` — Client Component com modal interativo
- [x] 5.2 Implementar modal com instruções de contato e link `mailto:` quando `SUPPORT_EMAIL` configurado
- [x] 5.3 Implementar fallback sem email: mensagem explicativa sem envio automático
- [x] 5.4 Implementar variantes: zero (CTA destacado), low (CTA discreto), normal (null — não renderiza)

## 6. Dashboard — Indicador de Saldo

- [x] 6.1 Modificar `src/app/(app)/dashboard/page.tsx` para buscar saldo via `CreditService.getBalance(store.id)` quando usuário tem loja
- [x] 6.2 Adicionar `BalanceDisplay` (variant="badge") no grid de métricas para `has_store_with_campaigns`
- [x] 6.3 Adicionar `BalanceDisplay` no empty state para `has_store_no_campaigns`
- [x] 6.4 Garantir que `no_store` não exibe badge de saldo
- [x] 6.5 Tratar erro de carregamento: fallback "—" sem quebrar a página

## 7. Página /conta — Seção de Créditos

- [x] 7.1 Modificar `src/app/(app)/conta/page.tsx` para buscar saldo + extrato paginado via `CreditService` com cliente de sessão
- [x] 7.2 Adicionar seção "Créditos" com `BalanceCard` (saldo) + `TransactionHistory` (extrato) + `CreditCta` (condicional)
- [x] 7.3 Implementar paginação via searchParams: `page` com limit 10, total via `countCreditTransactions()`
- [x] 7.4 Tratar estados: sem loja (CTA criar loja, sem extrato), loading (skeleton), erro (mensagem distinta)

## 8. Fluxo de Geração — Saldo Antes de Gerar

- [x] 8.1 Modificar server component `src/app/(app)/campanhas/nova/page.tsx` para buscar saldo via `CreditService.getBalance(store.id)`
- [x] 8.2 Passar saldo como prop para `CampaignPageClient` (ou componente de formulário)
- [x] 8.3 Adicionar indicador inline "⚡ Saldo: X créditos    Custo: 1" antes do botão "Gerar campanha"
- [x] 8.4 Desabilitar botão "Gerar campanha" com tooltip quando saldo = 0
- [x] 8.5 Exibir CTA "Solicitar créditos" quando saldo = 0
- [x] 8.6 Tratar erro de carregamento: mensagem distinta "Não foi possível confirmar seu saldo. Tente novamente." + botão gerar desabilitado com tooltip + ação "Tentar novamente" para recarregar — nunca tratar como saldo zero

## 9. Testes — Componentes de Crédito

- [x] 9.1 `BalanceDisplay` com saldo normal → badge verde (#1)
- [x] 9.2 `BalanceDisplay` com saldo baixo → badge amarelo (#2)
- [x] 9.3 `BalanceDisplay` com saldo zero → badge vermelho + CTA (#3)
- [x] 9.4 `BalanceDisplay` com `hasStore: false` → fallback 0 sem badge de alerta (#4)
- [x] 9.5 `BalanceCard` com saldo → valor formatado (#5)
- [x] 9.6 `BalanceCard` com saldo zero → CTA visível (#6)
- [x] 9.7 `BalanceCard` sem store → mensagem onboarding + CTA criar loja (#7)
- [x] 9.8 `TransactionHistory` com transações → tabela paginada (#8)
- [x] 9.9 `TransactionHistory` vazio → empty state (#9)
- [x] 9.10 `TransactionHistory` com paginação → navegação entre páginas (#10)
- [x] 9.11 `CreditCta` → modal/mailto com email configurado (#11)

## 10. Testes — Dashboard + Geração

- [x] 10.1 Dashboard `has_store_with_campaigns` → badge de saldo no grid (#12)
- [x] 10.2 Dashboard `has_store_no_campaigns` → badge de saldo no empty state (#13)
- [x] 10.3 Dashboard sem loja → sem badge de saldo (#14)
- [x] 10.4 `/campanhas/nova` com saldo ≥ 1 → botão gerar habilitado + saldo visível (#15)
- [x] 10.5 `/campanhas/nova` com saldo 0 → botão gerar desabilitado + tooltip + CTA (#16)
- [x] 10.6 `/campanhas/nova` com erro de saldo → botão gerar desabilitado + tooltip + ação "Tentar novamente" + mensagem distinta (não saldo zero, não CTA solicitar)

## 11. Testes — Integração CreditService

- [x] 11.1 `CreditService` com cliente de sessão → lê saldo do próprio store via RLS (#17)
- [x] 11.2 `CreditService` com cliente de sessão → extrato filtrado (sem adjustment) (#18)
- [x] 11.3 `countCreditTransactions()` → total de transações do store (#19)

## 12. Verificação Final

- [x] 12.1 Executar `npx vitest run src/components/credit/__tests__/` — 11+ testes passando
- [x] 12.2 Executar `npm run typecheck` — zero erros
- [x] 12.3 Executar `npm run lint` — zero erros
- [x] 12.4 Executar `npx vitest run` — novos + existentes passando (zero regressão)
- [x] 12.5 Executar `npm run build` — build bem-sucedido
- [x] 12.6 UAT local: saldo visível no dashboard (com e sem campanhas), extrato paginado em `/conta`, CTA em saldo zero, geração bloqueada sem crédito
- [x] 12.7 UAT local: erro ao carregar saldo mostra mensagem distinta, não "saldo zero"
