---
phase: 50
slug: demonstracao-gratuita-validade-creditos
status: pending_review
shadcn_initialized: false
preset: none
created: 2026-09-20
source: openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/ (design D10/D11/D12/D18/D20 + specs demo-status-ui / balance-card / balance-display / conta-page / credit-cta / credit-notifications / beta-access-request / admin-user-directory) + openspec/design-system/MASTER.md
---

# Phase 50 — UI Design Contract (Demonstração Gratuita e Validade dos Créditos)

> Contrato visual e de interação dos estados de prazo da demonstração, saldo disponível, suporte honesto e notificações in-app. Consolidado a partir dos artefatos OpenSpec; **não introduz novas decisões de produto nem redesign**. A fonte da verdade do projeto prevalece: **dark OLED, Poppins/Open Sans, lucide-react, sem emojis, sem light mode**.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Tailwind + `src/components/` primitives) |
| Preset | not applicable |
| Component library | nenhuma nova — reutiliza primitivos existentes (`badge`, `button`, `card`, `input`, `empty-state`, `error-state`, `page-header`) |
| Icon library | `lucide-react` (obrigatório; proibido emoji) |
| Font | Poppins (headings/labels), Open Sans (body) |

**Novas superfícies mínimas (D10/D11):** status/prazo da demonstração no `BalanceCard`/`BalanceDisplay`; seção de demonstração + lista de notificações na `/conta`; badge/bell de notificações na nav; modal de solicitação de créditos sem SLA; campo WhatsApp opcional/rotulado no `access-request-form`. **Sem redesign.**

---

## Spacing Scale

Valores declarados (múltiplos de 4), conforme MASTER §4: 2xs 4px · xs 8px · sm 12px · md 16px · lg 24px · xl 32px · 2xl 48px · 3xl 64px. Exceptions: none. Touch targets ≥ 44×44px (F22).

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14–16px (`text-sm`/`text-base`) | Open Sans 400/500 | 1.5 |
| Label | 12px (`text-xs`) | Poppins 500 | 1.4 |
| Heading (seção) | 16–20px | Poppins 600 | 1.3 |
| Hint / feedback | 12–13px | Open Sans 400 | 1.4 |
| Estado (badge) | 11–12px | Poppins 500, uppercase tracking-wide | 1.3 |

Regras: hint/feedback em `text-text-secondary` (`#94A3B8`); erro em `accent.red` + `AlertCircle`; estado "expirando" usa `accent.amber` (orientação, não erro).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#020617` (`bg.deep`) | Fundo de página |
| Secondary (30%) | `#0F172A` (`bg.surface`) / `#1E293B` (`bg.elevated`) | Cards, seções |
| Accent (10%) | `#22C55E` (`accent.green`) | CTA principal |
| Info | `#3B82F6` (`accent.blue`) | Links, foco |
| Warning | `#F59E0B` (`accent.amber`) | Prazo "expirando em breve" |
| Destructive | `#EF4444` (`accent.red`) | Erros existentes |

Texto: `#F8FAFC` primary, `#94A3B8` secondary, `#64748B` muted, `#475569` disabled. Contraste mínimo 7:1.

---

## Screens & States (inventário)

| Rota/Componente | Papel | Estados obrigatórios |
|------|-------|----------------------|
| `BalanceCard` / `BalanceDisplay` | saldo disponível + status/prazo da demo | `active`; `expiring_soon` (≤24h); `exhausted` (demo ativa, saldo 0); `expired`; `none`; saldo total insuficiente × bônus/comprado pós-demo |
| `/conta` | seção de demonstração + notificações + saldo/extrato | demo ativa; demo expirada; lista de notificações lidas/não-lidas |
| Nav (badge/bell) | indicador de notificações não-lidas | badge presente (não-lidas) / ausente |
| `CreditCta` (modal) | solicitar créditos sem SLA | sem "24h"; orientação "Entre em contato com o time do Vendeo para solicitar mais créditos"; sem "Comprar/Adquirir" |
| `access-request-form` | solicitação de acesso | WhatsApp opcional/rotulado; aviso de privacidade + links; `privacy_notice_version` |
| `/admin/users/[id]` | resumo demo | `demo_balance`/`demo_expires_at`/status |

**Prazo:** data/hora **local do usuário** (`Intl.DateTimeFormat` com timezone do client) + texto relativo ("expira em X dias/horas"). Fonte: `demo_expires_at` (TIMESTAMPTZ absoluto).

---

## Interaction Contract

- **Status da demo (D11):** derivado de `getDemoStatus` — estados mutuamente exclusivos (`none`/`active`/`expiring_soon`/`exhausted`/`expired`); `expired` também quando `demo_expires_at IS NULL` pós-materialização com `origin_demo_grant_tx_id` presente.
- **Saldo disponível (D4/D24):** toda superfície de saldo exibe o **saldo disponível** (nunca `balance` bruto).
- **Suporte honesto (D12):** sem promessa de prazo; CTA orienta contato com o suporte.
- **Notificações in-app (D10):** badge/bell + lista; marcação de leitura idempotente.
- **WhatsApp (D18):** opcional, rótulo explícito de finalidade, sem vínculo ao consentimento de marketing.
- **Feedback visual:** transições 150–300ms; `cursor-pointer`; erros inalterados.
- **Proibido:** "Comprar créditos"/"Adquirir créditos"; promessa de resposta em "24 horas"; emojis; depender de cor como único diferenciador.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Prazo relativo | "expira em X dias" / "expira em X horas" (derivado de `demo_expires_at`) |
| Estado expiring_soon | "Expira em breve" (orientação, não erro) |
| CTA sem saldo | "Entre em contato com o time do Vendeo para solicitar mais créditos." |
| Notificações (kinds) | concessão / prazo / expiração / esgotamento (texto operacional, sem marketing) |
| WhatsApp (form) | campo opcional, "usado somente para contato sobre esta solicitação" |

Tom: PT-BR, operacional e sem promessas. Sem emojis.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable |
| third-party | none | not applicable |

Sem dependências novas de UI; primitivos existentes + `lucide-react`.

---

## Non-Change Contract (fences)

- **Não muda:** prompts, `src/lib/ai/**`, snapshot, domínio, contrato de geração (402 `saldo_insuficiente`), `requireLegalClearance`.
- Exibição de saldo usa **saldo disponível** (não `balance` bruto) — é a mudança de apresentação; o backend (RLS/serviços) é a fonte.
- URL assinada de assets **nunca persistida**; `storage_path` canônico (D20).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending_review
- [ ] Dimension 2 Visuals: pending_review
- [ ] Dimension 3 Color: pending_review
- [ ] Dimension 4 Typography: pending_review
- [ ] Dimension 5 Spacing: pending_review
- [ ] Dimension 6 Registry Safety: pending_review

**Approval:** consolidado da base OpenSpec em 2026-09-20 (autorizado pelo usuário) — **pendente de revisão humana final** junto com os demais artefatos da F50. Status `pending_review` até aprovação real.
