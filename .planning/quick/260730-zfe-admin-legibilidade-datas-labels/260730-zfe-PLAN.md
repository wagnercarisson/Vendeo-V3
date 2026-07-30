# Quick Task 260730-zfe: Admin Legibilidade — Datas e Labels

## 1. Diagnóstico

### Datas sem timezone — fuso depende do ambiente

Todas as páginas/admin usam `toLocaleString("pt-BR")` ou `toLocaleDateString("pt-BR")` **sem** `timeZone: "America/Sao_Paulo"`. Sem timezone, o fuso depende do ambiente: no servidor (Vercel) tende a exibir UTC; no cliente segue o fuso do usuário. O aceite é exibir em horário de Brasília de forma determinística:

| Arquivo | Linha | Formato atual |
|---------|-------|---------------|
| `src/app/(app)/admin/audit-log/page.tsx` | 132, 156 | `toLocaleString("pt-BR")` |
| `src/app/(app)/admin/users/page.tsx` | 240, 281 | `toLocaleDateString("pt-BR")` |
| `src/app/(app)/admin/users/[id]/page.tsx` | 236, 309, 357, 397 | `toLocaleString("pt-BR")` |
| `src/app/(app)/admin/reviews/page.tsx` | 116 | `toLocaleDateString("pt-BR")` |
| `src/app/(app)/admin/campaigns/errors/page.tsx` | 130, 167 | `toLocaleString("pt-BR")` |
| `src/app/(app)/admin/page.tsx` | 82 | `toLocaleString("pt-BR")` |
| `src/components/credit/transaction-history.tsx` | 40 | `toLocaleDateString("pt-BR")` (client) |

### Labels raw — valores crus do banco

**Actions (audit log):**
- `admin/page.tsx` e `audit-log/page.tsx` têm `ACTION_LABELS` com apenas 4 entradas: `credit_grant`, `credit_adjustment`, `store_create_invite`, `manual_refund`
- **Faltam:** `approve_verification`, `reject_verification`, `create_test_store`, `admin_exception`, `reveal_cnpj`
- Fallback `??` exibe o valor raw

**Credit transaction types (admin/users/[id]/page.tsx linha 350):**
- `{tx.type as string}` — exibe raw (7 tipos: `bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase`, `deduction`, `refund`, `adjustment`)
- O componente `TransactionHistory` (cliente) já tem `TYPE_LABEL`, mas o server component admin não usa

**Entitlement benefit_type (admin/users/[id]/page.tsx linha 232):**
- `{e.benefit_type}` — exibe raw (`onboarding`, `monthly`, `admin_exception`)

**Document type (admin/users/[id]/page.tsx linha 306):**
- `{entry.document_type as string}` — exibe raw (`terms_of_service`, `acceptable_use`)

**Acceptance source (admin/users/[id]/page.tsx linha 311):**
- `{entry.acceptance_source as string}` — exibe raw

**Campaign status (admin/users/[id]/page.tsx linha 387-391):**
- Apenas `"error"` tem cor vermelha; `"ready"`, `"generating"` exibidos raw

**Reason labels — duplicados:**
- `REASON_LABELS` idêntico em `reviews/page.tsx` e `admin/users/[id]/page.tsx` — risco de drift

### Labels já mapeados corretamente
- **Transaction types** no componente cliente `transaction-history.tsx` (mas não no admin server)
- **Verification status** em `admin/users/page.tsx` e `admin/users/[id]/page.tsx` com cores
- **Freemium status** em `admin/users/[id]/page.tsx`
- **Target types** em `audit-log/page.tsx`

## 2. Proposta de Helpers/Arquitetura

### `src/lib/formatters.ts` — Helpers de data (já existe, estender)
```typescript
export const BR_TIMEZONE = "America/Sao_Paulo";
export function formatDateBR(date: string | Date): string;
export function formatDateTimeBR(date: string | Date): string;
export function formatDateTimeFullBR(date: string | Date): string;
```

### `src/lib/labels.ts` — Helpers neutros de label (sem domínio)
```typescript
// Helper: getLabel(map, value) — lookup com fallback textual
export function getLabel(map: Record<string, string>, value: string): string
// Helper: humanizeLabel(value) — fallback genérico snake_case → "Snake Case"
export function humanizeLabel(value: string): string
```

### `src/lib/admin/labels.ts` — Labels administrativas (audit, admin)
```typescript
import { getLabel } from "@/lib/labels";

// Audit actions (9 valores: credit_grant, credit_adjustment, store_create_invite,
//   manual_refund, approve_verification, reject_verification, create_test_store,
//   admin_exception, reveal_cnpj)
export const AUDIT_ACTION_LABELS: Record<string, string>
// Target types
export const TARGET_TYPE_LABELS: Record<string, string>
// Entitlement benefit types
export const BENEFIT_TYPE_LABELS: Record<string, string>
// Verification reasons
export const VERIFICATION_REASON_LABELS: Record<string, string>
// Document types
export const DOCUMENT_TYPE_LABELS: Record<string, string>
// Campaign status
export const CAMPAIGN_STATUS_LABELS: Record<string, string>
```

### `src/lib/credit/labels.ts` — Labels de crédito (usado no admin e no extrato cliente)
```typescript
import { getLabel } from "@/lib/labels";

// Credit transaction types (7: bonus_onboarding, bonus_monthly, admin_grant,
//   purchase, deduction, refund, adjustment)
export const CREDIT_TYPE_LABELS: Record<string, string>
// Credit badge variant mapping
export const CREDIT_TYPE_BADGE: Record<string, "ready" | "error">
```

### Estratégia
- **Server components:** chamar helpers diretamente
- **Client components:** mesma central, sem hydration mismatch se data vem do servidor
- **Fallback:** `getLabel(map, value)` retorna o label ou `humanizeLabel(value)` como fallback textual. `humanizeLabel` faz snake_case → "Snake Case" para valores desconhecidos. Sem informação de "fallback visual discreto" embutida — o calling code decide se aplica estilo diferente.
- `src/lib/credit/labels.ts` importa getLabel/humanizeLabel de `@/lib/labels` (neutro), não de admin
- `src/lib/labels.ts` contém apenas os helpers genéricos, sem conhecimento de domínio

## 3. Arquivos a Alterar

| Arquivo | Mudança |
|---------|---------|
| `src/lib/formatters.ts` | Adicionar `formatDateBR`, `formatDateTimeBR`, `formatDateTimeFullBR` |
| `src/lib/labels.ts` | **Criar** — helpers neutros: `getLabel()`, `humanizeLabel()` |
| `src/lib/admin/labels.ts` | **Criar** — labels admin: audit actions, target types, benefit types, reasons, doc types, campaign status (importa `getLabel` de `@/lib/labels`) |
| `src/lib/credit/labels.ts` | **Criar** — labels crédito: CREDIT_TYPE_LABELS, CREDIT_TYPE_BADGE (importa `getLabel` de `@/lib/labels`) |
| `src/app/(app)/admin/audit-log/page.tsx` | Remover `ACTION_LABELS`/`TARGET_LABELS` locais, usar central; corrigir datas |
| `src/app/(app)/admin/page.tsx` | Remover `ACTION_LABELS` local, usar central; corrigir datas |
| `src/app/(app)/admin/users/[id]/page.tsx` | Remover `REASON_LABELS` local; humanizar tx.type, benefit_type, document_type, campaign status; corrigir datas |
| `src/app/(app)/admin/users/page.tsx` | Corrigir datas |
| `src/app/(app)/admin/reviews/page.tsx` | Remover `REASON_LABELS` local, usar central; corrigir datas |
| `src/app/(app)/admin/campaigns/errors/page.tsx` | Corrigir datas |
| `src/components/credit/transaction-history.tsx` | Remover `TYPE_LABEL`/`TYPE_BADGE` local, importar de `@/lib/credit/labels`; corrigir datas |

## 4. Lista de Tarefas (Ordem)

1. **Adicionar helpers de data** em `src/lib/formatters.ts` — `formatDateBR`, `formatDateTimeBR`, `formatDateTimeFullBR` com `timeZone: "America/Sao_Paulo"`
2. **Criar `src/lib/labels.ts`** — `getLabel()`, `humanizeLabel()` (neutros, sem domínio)
3. **Criar `src/lib/credit/labels.ts`** — `CREDIT_TYPE_LABELS` (7 tipos), `CREDIT_TYPE_BADGE` (importa `getLabel` de `@/lib/labels`)
4. **Criar `src/lib/admin/labels.ts`** — `AUDIT_ACTION_LABELS` (9 valores), `TARGET_TYPE_LABELS`, `BENEFIT_TYPE_LABELS`, `VERIFICATION_REASON_LABELS`, `DOCUMENT_TYPE_LABELS`, `CAMPAIGN_STATUS_LABELS` (importa `getLabel` de `@/lib/labels`)
4. **Atualizar admin/audit-log/page.tsx** — remover labels duplicados, datas com `formatDateTimeBR`
5. **Atualizar admin/page.tsx** — remover ACTION_LABELS duplicado, datas com `formatDateTimeBR`
6. **Atualizar admin/users/[id]/page.tsx** — humanizar tx.type, benefit_type, document_type, campaign status; datas com `formatDateTimeBR`/`formatDateBR`
7. **Atualizar admin/users/page.tsx** — datas com `formatDateBR`
8. **Atualizar admin/reviews/page.tsx** — remover REASON_LABELS duplicado, datas com `formatDateBR`
9. **Atualizar admin/campaigns/errors/page.tsx** — datas com `formatDateTimeBR`
10. **Atualizar components/credit/transaction-history.tsx** — importar de `@/lib/credit/labels`, datas com `formatDateBR`
11. **Typecheck + lint + build**

## 5. Testes Automatizados

- `src/lib/__tests__/labels.test.ts`:
  - `humanizeLabel("unknown_value")` → `"Unknown value"` (fallback)
  - `getLabel({ a: "Label A" }, "a")` → `"Label A"`
  - `getLabel({ a: "Label A" }, "b")` → `"B"` (fallback via `humanizeLabel`)
- `src/lib/admin/__tests__/labels.test.ts`:
  - `getLabel(AUDIT_ACTION_LABELS, "credit_grant")` → `"Concessão de Créditos"`
  - `getLabel(AUDIT_ACTION_LABELS, "reveal_cnpj")` → `"Revelar CNPJ"`
  - Contém entrada para todos os valores conhecidos em cada mapa
- `src/lib/credit/__tests__/labels.test.ts`:
  - `getLabel(CREDIT_TYPE_LABELS, "adjustment")` → `"Ajuste"`
  - `getLabel(CREDIT_TYPE_LABELS, "bonus_onboarding")` → `"Bônus de Boas-Vindas"`
  - Cobre todos os 7 tipos
- `src/lib/__tests__/formatters.test.ts` (criar):
  - `formatDateBR("2026-07-30T12:00:00Z")` → `"30/07/2026"` (timezone conversion)

## 6. UAT Manual

| Cenário | Como testar |
|---------|-------------|
| Audit log mostra "Concessão de Créditos" (não "credit_grant") | Navegar /admin/audit-log |
| Horários em Brasília | Verificar qualquer data no admin com UTC-3 |
| Extrato admin mostra "Bônus de Boas-Vindas" | Navegar /admin/users/{id} seção extrato |
| Campaign status mostra "Pronto" / "Erro" / "Gerando" | Navegar /admin/users/{id} tabela campanhas |
| Valor desconhecido não quebra | Simular via manipulação de resposta |

## 7. Riscos e Cuidados

- **Nomes de arquivo:** `admin/labels.ts` convive com `admin/schemas.ts` — nomes distintos evitam confusão
- **Client vs Server:** `formatDateBR` pode causar hydration mismatch se o componente cliente renderizar data diferente do server. Solução: usar datas pré-formatadas do servidor.
- **Regressão de layout:** usar estilos inline existentes, não mudar estrutura DOM
- **Labels duplicados removidos:** verificar se nenhum import quebra com a mudança

## 8. Critério de Aceite

- [ ] Datas admin exibem horário Brasília (UTC-3)
- [ ] Todo label raw do banco tem versão humanizada PT-BR
- [ ] Fallback seguro para valores desconhecidos (não quebra, exibe fallback humanizado)
- [ ] Nenhuma label map duplicado no código (tudo centralizado)
- [ ] Mobile (sm:hidden) também reflete as mesmas correções
- [ ] Nenhuma regra de negócio alterada
- [ ] TypeScript/lint/build clean
