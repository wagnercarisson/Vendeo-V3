# Phase 58: F58 — Composição operacional do dashboard - Pattern Map

**Mapped:** 2026-11-02
**Files analyzed:** 38 (21 implementation + 17 tests)
**Analogs found:** 36 / 38

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/dashboard/campaigns.ts` | service (server-only data) | CRUD (scoped read) + storage signing | `src/lib/campaign/metrics.ts` + `src/lib/campaign/list.ts` | exact (role + flow) |
| `src/lib/dashboard/credits.ts` | service (server-only data) | request-response | `src/app/(app)/conta/page.tsx` (isolated credit read) | role-match |
| `src/lib/dashboard/greeting.ts` | utility (pure) | transform | `src/lib/formatters.ts` (Intl + timeZone) | partial |
| `src/lib/dashboard/sections.ts` (optional) | service (orchestration) | request-response (batch/isolation) | `src/app/(app)/conta/page.tsx` | role-match |
| `src/lib/changelog/excerpt.ts` | utility (pure) | transform | `src/lib/changelog/format-date.ts` | role-match |
| `src/lib/i18n/dashboard/messages.ts` | config (types) | — | `src/lib/i18n/messages.ts` | exact |
| `src/lib/i18n/dashboard/catalogs/pt-BR.ts` | config (catalog) | — | `src/lib/i18n/catalogs/pt-BR.ts` | exact |
| `src/lib/i18n/dashboard/catalogs/es-419.ts` | config (catalog) | — | `src/lib/i18n/catalogs/es-419.ts` | exact |
| `src/lib/i18n/dashboard/get-messages.ts` | utility (resolver) | transform | `src/lib/i18n/get-catalog.ts` | exact |
| `src/lib/i18n/dashboard/index.ts` | config (barrel) | — | `src/lib/i18n/index.ts` | exact |
| `src/components/dashboard/dashboard-header.tsx` | component (server) | request-response | `src/app/(app)/configuracoes/page.tsx` + current dashboard header/actions | role-match |
| `src/components/dashboard/dashboard-campaigns.tsx` | component (server) | request-response | `src/app/(app)/campanhas/client.tsx` (card grid/empty) + current dashboard section | role-match |
| `src/components/dashboard/available-campaign-card.tsx` | component (client) | event-driven (image error) | `src/app/(app)/campanhas/client.tsx` `CampaignCard` + `src/components/campaign/campaign-renderer.tsx` | role-match |
| `src/components/dashboard/dashboard-credits.tsx` | component (server) | request-response | `src/components/credit/balance-display.tsx` (visual states) | role-match |
| `src/components/dashboard/dashboard-news.tsx` | component (server) | request-response | current dashboard `ChangelogAnnouncement` usage | role-match |
| `src/app/(app)/dashboard/page.tsx` | page (server) | request-response / batch | itself + `src/app/(app)/conta/page.tsx` | role-match |
| `src/app/(app)/dashboard/loading.tsx` | page (server) | streaming (suspense/loading) | itself + `src/components/ui/skeleton.tsx` | exact |
| `src/components/changelog/changelog-announcement.tsx` | component (client) | event-driven | itself | exact |
| `src/components/verification/verification-banners.tsx` | component (client) | event-driven | itself | exact |
| `src/components/readiness/readiness-banner.tsx` | component (server) | request-response | itself | exact |
| `src/components/readiness/readiness-check-banner.tsx` | component (server async) | request-response | itself | exact |
| `src/lib/credit/credit-service.ts` | service (shared) | CRUD (read) | itself | exact |
| `src/lib/dashboard/__tests__/campaigns.test.ts` | test | CRUD read | `src/__tests__/lib/campaign/list.test.ts` | exact |
| `src/lib/dashboard/__tests__/credits.test.ts` | test | request-response | `src/lib/credit/__tests__/demo-services.test.ts` | role-match |
| `src/lib/dashboard/__tests__/greeting.test.ts` | test | transform | `src/lib/i18n/__tests__/translate.test.ts` | partial |
| `src/lib/changelog/__tests__/excerpt.test.ts` | test | transform | `src/lib/changelog/__tests__/format-date.test.ts` | role-match |
| `src/lib/i18n/dashboard/__tests__/catalogs.test.ts` | test | — | `src/lib/i18n/__tests__/catalogs.test.ts` | exact |
| `src/lib/i18n/dashboard/__tests__/isolation.test.ts` | test (static/import) | — | `src/__tests__/app/layout-i18n.test.tsx` + `src/__tests__/components/shell/shell-localization.test.tsx` | role-match |
| `src/components/dashboard/__tests__/available-campaign-card.test.tsx` | test | event-driven | `src/__tests__/app/minhas-campanhas-client.test.tsx` | exact |
| `src/components/dashboard/__tests__/dashboard-credits.test.tsx` | test | request-response | `src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx` | role-match |
| `src/__tests__/app/dashboard/dashboard-loading.test.tsx` | test | streaming | `src/__tests__/components/ui/skeleton.test.tsx` | role-match |
| `src/__tests__/app/dashboard/dashboard-localization.test.tsx` | test | request-response | `src/__tests__/app/configuracoes/configuracoes-page.test.tsx` | role-match |
| `src/__tests__/app/dashboard/dashboard-layout-order.test.tsx` | test | — | `src/__tests__/app/dashboard/dashboard-page.test.tsx` | role-match |
| `src/__tests__/app/dashboard/dashboard-page.test.tsx` (modify) | test | request-response/batch | itself | exact |
| `src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx` (modify) | test | request-response | itself | exact |
| `src/components/changelog/__tests__/changelog-announcement.test.tsx` (modify) | test | event-driven | itself | exact |
| `src/components/readiness/__tests__/readiness-banner.test.tsx` (modify) | test | request-response | itself | exact |
| `src/components/verification/__tests__/verification-banners.test.ts` (modify) | test | event-driven | itself | exact |

---

## Pattern Assignments

### `src/lib/dashboard/campaigns.ts` (service, CRUD read + storage)

**Analog A:** `src/lib/campaign/metrics.ts`

**Module boundary + client pattern** (lines 1-5, 21-33):
```ts
import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import type { CampaignStatus } from "./types";

export async function countReadyCampaigns(storeId: string): Promise<number> {
  const supabase = await createServerClient();

  const { count, error } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "ready");

  if (error) throw new Error(error.message);

  return count ?? 0;
}
```

**Explicit DTO mapping** (metrics.ts lines 64-77) — copy the "map rows to camelCase DTO, no raw row" discipline:
```ts
return (data ?? []).map((row) => ({
  id: row.id,
  productName: row.product_name,
  status: row.status as CampaignStatus,
  createdAt: row.created_at,
}));
```

**Analog B:** `src/lib/campaign/list.ts`

**Batch signed URL reuse** (lines 173-201) — call this, do not re-implement:
```ts
export async function generateBatchThumbnailUrls(
  items: Pick<CampaignListItem, "id" | "status" | "storagePath">[],
): Promise<Record<string, string | null>> {
  const readyItems = items.filter(
    (item) => item.status === "ready" && item.storagePath,
  );
  // ...
  const results = await Promise.allSettled(
    readyItems.map((item) =>
      supabaseAdmin.storage
        .from("campaign-images")
        .createSignedUrl(item.storagePath, 3600)
        .then((res) => ({ id: item.id, url: res.data?.signedUrl ?? null })),
    ),
  );
  // ...
}
```

**Required query shape for F58** (derived; not yet in repo):
```ts
supabase
  .from("campaigns")
  .select("id, product_name, created_at, storage_path")
  .eq("store_id", storeId)
  .eq("status", "ready")
  .order("created_at", { ascending: false })
  .limit(3);
```
Map to `{ id, productName, createdAt, thumbnailUrl }`; **omit `storagePath` from the returned DTO** (list.ts keeps `storagePath`; F58 must not).

**Error handling:** throw `new Error(error.message)` on Supabase error, exactly like metrics.ts/list.ts — the page/section wrapper converts it into `{ ok: false }` (see `sections.ts`).

**Testing pattern:** `src/__tests__/lib/campaign/list.test.ts` (node env, `vi.mock("server-only", () => ({}))`, mocked `createServerClient`/`supabaseAdmin.storage`) — reuse its chain-mock builder for `.select().eq().eq().order().limit()`.

---

### `src/lib/dashboard/credits.ts` (service, request-response)

**Analog:** `src/app/(app)/conta/page.tsx` (isolated credit read, lines 42-61)

**Isolation pattern** (conta/page.tsx):
```ts
let balance = 0;
let breakdown: import("@/lib/credit/credit-service").CreditBalanceBreakdown | null = null;
// ...
let creditError = false;

if (store) {
  try {
    [breakdown, /* ... */] = await Promise.all([/* ... */]);
    balance = breakdown.availableBalance;
  } catch {
    creditError = true;
  }
}
```

**Authoritative source:** `src/lib/credit/credit-service.ts` `getBalanceBreakdown` (lines 21-37). Do not recompute `availableBalance`.

**F58 target shape** (derived from D-04 / RESEARCH §3):
```ts
export type DashboardCreditState =
  | { state: "available"; availableBalance: number }
  | { state: "zero"; availableBalance: 0 }
  | { state: "unavailable" };

// with the additive service option:
const breakdown = await new CreditService(supabase)
  .getBalanceBreakdown(storeId, { throwOnError: true });
```
Catch → `{ state: "unavailable" }`; never coerce to `0`.

**Testing pattern:** `src/lib/credit/__tests__/demo-services.test.ts` — mocks `@/lib/supabase/server` at module top and builds a minimal `{ from }` chain:
```ts
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
}));
mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) });
```

---

### `src/lib/dashboard/greeting.ts` (utility, transform, pure)

**Analog:** `src/lib/formatters.ts` (lines 1-10) — the only existing `Intl` + explicit `timeZone` usage:
```ts
export const BR_TIMEZONE = "America/Sao_Paulo";

export function formatDateBR(date: string | Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    timeZone: BR_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
```

**F58 pattern to copy** (from RESEARCH §4; no exact existing analog):
```ts
type GreetingPeriod = "morning" | "afternoon" | "evening" | "neutral" | "welcome";

resolveDashboardGreeting({
  storeName: string | null,
  timeZone: string | null,
  now: Date,
  messages: DashboardMessages,
}): { period: GreetingPeriod; storeName: string | null }

const hour = Number(
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).find((p) => p.type === "hour")?.value,
);
```
Rules to preserve: `"24"` → `0`; invalid/null TZ or `RangeError` → `neutral`; `storeName === null` → `welcome`; **never** `new Date().getHours()`; never silently default to `America/Sao_Paulo`.

**Testing:** deterministic `now` vectors (RESEARCH §4). No pure-greeting test analog exists; follow the table style of `src/lib/i18n/__tests__/translate.test.ts` (pure function + explicit inputs/outputs).

---

### `src/lib/dashboard/sections.ts` (optional orchestration, request-response)

**Analog:** `src/app/(app)/conta/page.tsx` (lines 42-61) for isolation; shape from RESEARCH §Pattern 1.

```ts
type SectionResult<T> = { ok: true; data: T } | { ok: false };

async function loadCampaignSection(storeId: string): Promise<SectionResult<EligibleCampaignOverview>> {
  try {
    const [count, items] = await Promise.all([
      countReadyCampaigns(storeId),
      queryEligibleCampaigns(storeId, 3),
    ]);
    return { ok: true, data: { count, items } };
  } catch {
    return { ok: false };
  }
}
```
Never let a section rejection reach the page (D-10 / RESEARCH anti-pattern "`Promise.all` único para tudo").

---

### `src/lib/changelog/excerpt.ts` (utility, transform, pure)

**Analog:** `src/lib/changelog/format-date.ts` — pure, fail-safe, no throw:
```ts
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * ... PROIBIDO usar ... fail-safe, sem lançar.
 */
export function formatChangelogDate(dateIso: string): string {
  const match = ISO_DATE_REGEX.exec(dateIso);
  if (!match) return dateIso;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
```

**Target behavior** (RESEARCH §6 / Open Question 2): first non-empty *textual block*, including the first list item; skip headings (`## `); strip `- ` and `**`; collapse whitespace; cut ~200 chars at a word boundary + `…`; return `null` when no text. Real body fixture: `content/changelog/2026-10-19-campanhas-mais-qualidade-novos-cenarios.md` (starts with `## O que mudou` then a list).

**Testing:** `src/lib/changelog/__tests__/format-date.test.ts` style (pure assertions, edge cases, no mocks).

---

### `src/lib/i18n/dashboard/*` (config + resolver, isolated namespace)

**Analog:** `src/lib/i18n/messages.ts`, `catalogs/pt-BR.ts`, `catalogs/es-419.ts`, `get-catalog.ts`, `index.ts`.

**Type parity pattern** — explicit interfaces, no index signature (messages.ts lines 8-12):
```ts
export interface CommonMessages {
  readonly save: string;
  readonly retry: string;
  readonly loading: string;
}
```

**pt-BR source of truth, frozen at all levels** (catalogs/pt-BR.ts lines 9-16):
```ts
import type { Messages } from "../messages";

export const ptBRMessages: Messages = Object.freeze({
  common: Object.freeze({
    save: "Salvar",
    retry: "Tentar novamente",
    loading: "Carregando...",
  }),
  // ...
});
```

**es-419 structural parity** (catalogs/es-419.ts lines 9-11, 71):
```ts
import type { Messages } from "../messages";

export const es419Messages = Object.freeze({
  // same keys...
}) satisfies Messages;
```

**Resolver pattern** (get-catalog.ts lines 1-12):
```ts
import { es419Messages } from "./catalogs/es-419";
import { ptBRMessages } from "./catalogs/pt-BR";
import type { SupportedUiLocale } from "./locales";
import type { Messages } from "./messages";

export function getCatalog(locale: SupportedUiLocale): Messages {
  return locale === "es-419" ? es419Messages : ptBRMessages;
}
```

**Barrel isolation** — `src/lib/i18n/index.ts` (lines 8-23) currently re-exports `ptBRMessages`, `es419Messages`, `getCatalog`; the dashboard barrel must **not** be added here, and must not be imported by `AppShell`/layout/admin (D-07).

**Namespace shape to define** (from UI-SPEC copy table): `greeting`, `header`, `credits`, `campaigns`, `news`, `banners` (verification/readiness), `loading`. `satisfies DashboardMessages` covers structure only; placeholders require the test below.

**Testing:** copy `src/lib/i18n/__tests__/catalogs.test.ts` (lines 8-108) — `flatten`, `placeholders`, same-key equality, non-empty values, same placeholder set, `Object.isFrozen` at root and each namespace, exact key list.

---

### `src/components/dashboard/dashboard-header.tsx` (server component)

**Analog:** `src/app/(app)/configuracoes/page.tsx` (lines 19-24) for the `lang` scope:
```tsx
const locale = ui.ok ? ui.locale : "pt-BR";
const { settings, common } = getCatalog(locale);
const lang = locale === "es-419" ? "es-419" : undefined;

return (
  <div lang={lang}>
    <PageHeader ... />
  </div>
);
```
Plus the existing dashboard action classes (`src/app/(app)/dashboard/page.tsx` lines 43-44):
```tsx
const ctaClass =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200";
```

**F58 specifics (UI-SPEC):** `h1` greeting with `storeName` in `<span lang="">`; primary link `/campanhas/nova` green 44px; secondary `/loja` bordered 44px; **no `PageHeader`**, no duplicate `h1`. In `no_store`, header renders no actions (CTA lives in the EmptyState).

---

### `src/components/dashboard/dashboard-campaigns.tsx` (server component)

**Analog A:** current dashboard section (`src/app/(app)/dashboard/page.tsx` lines 215-264) for heading + "Ver todas" link:
```tsx
<section>
  <h2 className="text-lg font-semibold text-text-primary mb-4">
    Campanhas Recentes
  </h2>
  <Card className="p-0">
    <ul className="divide-y divide-border">...</ul>
  </Card>
  <div className="mt-2 text-right">
    <Link href="/campanhas" className="text-sm font-medium text-accent-green hover:underline">
      Ver todas as campanhas →
    </Link>
  </div>
</section>
```

**Analog B:** `src/app/(app)/campanhas/client.tsx` (lines 188-201) for `EmptyState` usage with CTA:
```tsx
<EmptyState
  icon={CAMPAIGNS_NO_CAMPAIGNS.icon}
  title={CAMPAIGNS_NO_CAMPAIGNS.title}
  description={CAMPAIGNS_NO_CAMPAIGNS.description}
  action={
    <Link href={CAMPAIGNS_NO_CAMPAIGNS.ctaHref!} className="... bg-accent-green ...">
      {CAMPAIGNS_NO_CAMPAIGNS.ctaLabel}
    </Link>
  }
/>
```
`EmptyState` contract (`src/components/ui/empty-state.tsx` lines 3-32): `icon?: LucideIcon`, `title`, `description`, `action?`; `py-20` is inherited — do not add padding.

**F58 render branches:** count chip `aria-hidden`; `has_eligible` grid `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`; `no_eligible` → `EmptyState` with new dashboard copy (do **not** reuse `DASHBOARD_NO_CAMPAIGNS`, which says "primeira campanha"); failure → compact `Card role="status"` + `/campanhas` link. Do not use `Badge`/status labels.

---

### `src/components/dashboard/available-campaign-card.tsx` (client component, image error)

**Analog A:** `src/app/(app)/campanhas/client.tsx` `CampaignCard` (lines 246-263) — plain `<img>`, no `next/image`:
```tsx
<div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
  {campaign.thumbnailUrl ? (
    <img
      src={campaign.thumbnailUrl}
      alt={campaign.productName}
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="h-full w-full bg-bg-elevated" />
  )}
</div>
```

**Analog B:** `src/components/campaign/campaign-renderer.tsx` (lines 126-134) — the existing `onError` fallback pattern:
```tsx
const [showInitialsFallback, setShowInitialsFallback] = useState(false);
// ...
{storeIdentity.signature.type === 'logo' && storeIdentity.signature.url && !showInitialsFallback ? (
  <img
    src={storeIdentity.signature.url}
    alt={storeIdentity.storeName}
    className="w-[40px] h-[40px] rounded-full object-cover"
    onError={() => setShowInitialsFallback(true)}
  />
) : ( /* fallback */ )}
```

**F58 specifics (UI-SPEC):** whole card is one `<Link href={`/campanhas/${id}`}>` with localized `aria-label`; `<img alt="" ... onError={() => setFailed(true)}>`; fallback `ImageOff` (`lucide-react`) `text-text-disabled`, `aria-hidden`; product name is a `<span lang="">` (not `h3`), `line-clamp-2`; date string passed from server; `aspect-square` wrapper.

**Testing:** `src/__tests__/app/minhas-campanhas-client.test.tsx` (lines 89-101: "shows placeholder when thumbnailUrl is null", "renders image when thumbnailUrl is provided"). Add `fireEvent.error(img)` for the `onError` branch.

---

### `src/components/dashboard/dashboard-credits.tsx` (server component)

**Analog:** `src/components/credit/balance-display.tsx` — visual state model and value/unit rendering:
```tsx
function getState(balance: number, hasStore: boolean) {
  if (!hasStore) return "no_store";
  if (balance >= 3) return "normal";
  if (balance > 0) return "low";
  return "zero";
}

<p className="text-sm font-medium text-text-secondary">Créditos</p>
<p className="text-3xl font-bold text-text-primary mt-1">{balance}</p>
```
**Do not modify `BalanceDisplay`.** The dashboard block is separate: `available` → number + unit + `/conta`; `zero` → `0` + plural unit (no warning tone); `unavailable` → `AlertCircle` amber + "Saldo indisponível" + `/conta`; never `0`/`—` for failure.

**Testing analog:** existing `src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx` (node env, `renderToString`, mocks `CreditService` class with `getBalanceBreakdown`).

---

### `src/components/dashboard/dashboard-news.tsx` (server component)

**Analog:** the current dashboard usage (`src/app/(app)/dashboard/page.tsx` lines 86, 161):
```tsx
const latestAnnouncement = await getLatestAnnouncement();
// ...
<ChangelogAnnouncement entry={latestAnnouncement} />
```
F58 wraps it with server-derived `excerpt` + localized `labels`, and renders nothing when entry/excerpt is absent. Never pass `storage_path`/markdown body; never render markdown in compact mode.

---

### `src/app/(app)/dashboard/page.tsx` (server page, rewrite)

**Analog A:** itself (lines 46-305) — auth, `getCurrentStore`, current banner/announcement order, `ctaClass`, 44px patterns.
**Analog B:** `src/app/(app)/conta/page.tsx` (lines 42-61) — independent reads with isolated failure.

**Orchestration shape** (RESEARCH flow):
```ts
const user = await requirePageUser();
const [store, ui, latestAnnouncement] = await Promise.all([
  getCurrentStore(user.userId),
  getUiRenderContext(user.userId),
  getLatestAnnouncement().catch(() => null),
]);
// no store -> no_store early return (no credit/campaign queries)
// store -> Promise.allSettled([campaigns, credits, marketSettings])
```

**Preserved bits:** `requirePageUser()` (line 47), `VerificationBanners`/`ReadinessCheckBanner` placement after header (lines 84-85 / 159-160), 44px links, `EmptyState` CTA to `/loja` and `/campanhas/nova` (lines 55-64, 98-110), no `PageHeader`.

**Removed:** `getUserOnboardingState`, `countCampaigns` (total), `getRecentCampaigns`, `getCampaignSuccessRate`, metrics grid, `Próximo passo` card, `BalanceDisplay`, `Badge`, local `getGreeting`.

**`lang`:** root `<div lang={locale === "es-419" ? "es-419" : undefined}>`; store name `<span lang="">`; product `<span lang="">`; announcement title/excerpt `lang="pt-BR"`. Never touch `document.documentElement.lang`.

**Testing:** rewrite `src/__tests__/app/dashboard/dashboard-page.test.tsx` — keep the node env + `renderToString` + `vi.mock` harness, but replace `getUserOnboardingState`/metrics assertions with the state matrix (no_store, no_eligible, has_eligible, campaign failure, credit failure, zero vs unavailable, limit 3, links, absence of technical metrics).

---

### `src/app/(app)/dashboard/loading.tsx` (rewrite)

**Analog:** itself (lines 1-11) + `src/components/ui/skeleton.tsx`:
```tsx
import { StatsSkeleton, CardSkeleton } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-bg-elevated" />
      <StatsSkeleton count={4} />
      <CardSkeleton />
    </div>
  );
}
```
Keep `Skeleton`/`CardSkeleton` primitives; remove `StatsSkeleton count={4}`. New order: header → credits → campaigns → news, with the **identical grid classes** as the final page (`grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8`), `role="status" aria-label={loading}` and `aria-hidden` skeletons (UI-SPEC "Skeleton contract").

---

### `src/components/changelog/changelog-announcement.tsx` (extend, backward compatible)

**Analog:** itself (lines 11-88). Preserve the full mode byte-for-byte:
- `if (!entry || entry.frontmatter.announcement === "none") return null;`
- `isAnnouncementVisible(...)`, `dismissAnnouncement(id)`
- close button 44px `aria-label="Fechar anúncio"`
- `formatChangelogDate(entry.frontmatter.date)`
- `renderMarkdown(entry.body)` + `dangerouslySetInnerHTML` (full mode only)
- modal overlay/dialog tokens (lines 68-81)
- `Card className="mb-6 p-4 sm:p-6"` (full mode)

**Additive props** (RESEARCH §6):
```ts
interface ChangelogAnnouncementProps {
  entry: ChangelogEntry | null;
  compact?: boolean;
  excerpt?: string | null;
  labels?: { view?: string; close?: string; dialogLabel?: string };
}
```
Compact branch: title/date/`excerpt` as React text (no `renderMarkdown`, no `dangerouslySetInnerHTML`), `lang="pt-BR"` only on title + excerpt, card without `mb-6`, modal preserved. Dismiss must not call `markChangelogAsViewed`.

**Testing:** keep the 5 existing tests; add compact cases (excerpt visible, body markdown absent, `lang`, labels, compact modal, dismiss doesn't write `CHANGELOG_SEEN_KEY`).

---

### `src/components/verification/verification-banners.tsx` (additive props)

**Analog:** itself (lines 6-57). Keep `"use client"`, `sessionStorage` dismissal, and current Portuguese defaults:
```tsx
export function ReviewBanner() {
  return (
    <div className="mb-6 ...">
      <AlertCircle ... />
      <p ...>Seus créditos de boas-vindas estão em verificação cadastral.</p>
    </div>
  );
}

export function ApprovedBanner({ onDismiss }: { onDismiss: () => void }) { /* ... */ }
```

**Additive shape** (RESEARCH §7):
```ts
interface VerificationMessages { review: string; approved: string; dismiss: string; }
export function VerificationBanners({ verificationStatus, messages }: {
  verificationStatus: string | null; messages?: VerificationMessages;
})
```
`ReviewBanner`/`ApprovedBanner` take `message?`/`dismissLabel?`; defaults unchanged; close `aria-label` becomes `messages?.dismiss ?? "Fechar"`. Keep the status logic exactly as lines 39-56.

**Testing:** existing `verification-banners.test.ts` tests pure logic only — keep it, add a jsdom render test for default and localized strings.

---

### `src/components/readiness/readiness-banner.tsx` (additive props)

**Analog:** itself (lines 4-44):
```tsx
function missingToDisplay(item: MissingItem): { label: string; href: string } {
  if (item.item === "cadastro_fiscal") {
    return { label: "CNPJ cadastral", href: "/loja?tab=dados&fiscal=pending&returnTo=/dashboard" };
  }
  return { label: "Direção visual", href: "/loja?tab=direcao-visual&message=needs-visual-direction" };
}
```

**Additive shape** (RESEARCH §7):
```ts
interface ReadinessMessages { title: string; cta: string; cadastroFiscal: string; brandProfile: string; }
export function ReadinessBanner({ missing, messages }: { missing: MissingItem[]; messages?: ReadinessMessages })
```
Defaults unchanged. Also per UI-SPEC alignment: replace the `❌` text glyph with a lucide `X` (`h-4 w-4 text-accent-amber aria-hidden`) in both default and localized rendering — no behavior change.

**Testing:** keep the 6 existing tests (`src/components/readiness/__tests__/readiness-banner.test.tsx`, `react-dom/server` + `next/link` string mock); add default pt-BR and localized `es-419` + CTA/labels assertions.

---

### `src/components/readiness/readiness-check-banner.tsx` (prop passthrough)

**Analog:** itself (lines 1-10):
```tsx
import { getStoreReadiness } from "@/lib/store-readiness";
import { ReadinessBanner } from "./readiness-banner";

export async function ReadinessCheckBanner({ storeId }: { storeId: string }) {
  const readiness = await getStoreReadiness(storeId);
  if (readiness.ready) return null;
  return <ReadinessBanner missing={readiness.missing} />;
}
```
Add `messages?: ReadinessMessages` and forward it. No change to `getStoreReadiness`.

---

### `src/lib/credit/credit-service.ts` (additive option only)

**Analog:** itself (lines 21-37):
```ts
async getBalanceBreakdown(storeId: string): Promise<CreditBalanceBreakdown> {
  const { data } = await this.client
    .from("credit_balances")
    .select("balance, demo_balance, demo_expires_at, origin_demo_grant_tx_id, bonus_balance, purchased_balance")
    .eq("store_id", storeId)
    .single();

  return {
    balance: data?.balance ?? 0,
    // ...
    availableBalance: availableBalance(data),
  };
}
```

**Additive change** (RESEARCH §3, option A recommended):
```ts
async getBalanceBreakdown(storeId: string, opts?: { throwOnError?: boolean }): Promise<CreditBalanceBreakdown> {
  const { data, error } = await this.client/* ... */;
  if (error && opts?.throwOnError) throw error;
  // unchanged zero-default behavior when opts omitted
}
```
Default `false` must keep every existing caller byte-identical. Do not change `availableBalance`/credit rules. The analog for explicit throw-on-error lives in the same file: `getOriginDemoGrantTxId` (lines 39-47) uses `const { data, error } = ...; if (error) throw error;`.

**Testing:** `src/lib/credit/__tests__/credit-service.test.ts` (mock chain + `mockSingle`) and `demo-services.test.ts` (default returns zeros). Add a default-preserved test and a `throwOnError: true` rejection test.

---

## Shared Patterns

### Authentication / authorization
**Source:** `src/app/(app)/dashboard/page.tsx` line 47 (`requirePageUser`), `src/lib/auth/store-ownership.ts` lines 14-31 (`getCurrentStore`).
**Apply to:** `page.tsx` and every server data module entry point.
```ts
const user = await requirePageUser();
const store = await getCurrentStore(user.userId);
```
`storeId` always comes from the session/store record — never from URL/body. RLS on `campaigns` is owner-only.

### Failure isolation
**Source:** `src/app/(app)/conta/page.tsx` lines 42-61; RESEARCH Pattern 1.
**Apply to:** `page.tsx`, `sections.ts`, `credits.ts`.
```ts
try {
  // independent read(s)
} catch {
  // section-specific failure state; never throw to the page
}
```
`getUiRenderContext` unknown errors must still propagate to `src/app/(app)/error.tsx`; `getLatestAnnouncement` failures are swallowed to `null`.

### Server-only data modules
**Source:** `src/lib/campaign/metrics.ts` line 1, `src/lib/credit/credit-service.ts` line 1.
**Apply to:** `src/lib/dashboard/*.ts`.
```ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
```
No new Supabase client; `generateBatchThumbnailUrls` internally uses `supabaseAdmin` — do not duplicate signing.

### Typed i18n catalog + resolver
**Source:** `src/lib/i18n/messages.ts`, `catalogs/*`, `get-catalog.ts`.
**Apply to:** `src/lib/i18n/dashboard/*`.
- `pt-BR` annotated `: DashboardMessages`; `es-419` `satisfies DashboardMessages`.
- `Object.freeze` at every level.
- `getDashboardMessages(locale)` mirrors `getCatalog`.
- Dashboard barrel is local-only; not re-exported from `src/lib/i18n/index.ts`.
- Pass only used sub-objects to client components (`announcement`, `banners`, `card` labels), not the whole catalog.

### `lang` scoping
**Source:** `src/app/(app)/configuracoes/page.tsx` lines 19-24.
**Apply to:** dashboard page and all dashboard components.
```tsx
const lang = locale === "es-419" ? "es-419" : undefined;
<div lang={lang}> ... </div>
```
`lang=""` only on store/product names; `lang="pt-BR"` only on changelog title/excerpt; never on dates/actions/aria-labels; never change `document.documentElement.lang`.

### 44px targets + focus ring
**Source:** `src/app/(app)/dashboard/page.tsx` lines 43-44 and 245-250; `src/components/changelog/changelog-announcement.tsx` line 36.
**Apply to:** all new dashboard links/buttons/cards.
```tsx
"inline-flex min-h-[44px] items-center ... focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep"
```
Whole campaign card is a link; keep the ring on the `<Link>` (offset) so `overflow-hidden` does not clip it.

### Test harness patterns
**Source:** `src/__tests__/app/dashboard/dashboard-page.test.tsx` (node + `renderToString` + `vi.mock`), `src/components/changelog/__tests__/changelog-announcement.test.tsx` (jsdom + testing-library), `src/lib/i18n/__tests__/catalogs.test.ts` (pure catalog assertions).
**Apply to:** all new/modified tests.
- Page/data tests: `// @vitest-environment node`, mock `require-user`, `store-ownership`, `campaign/metrics`, `credit-service`, `supabase/server`, `next/link`.
- Client component tests: `// @vitest-environment jsdom`, `@testing-library/jest-dom/vitest`, `render`/`screen`/`fireEvent`.
- Dynamic route imports after mocks: `const { default: DashboardPage } = await import("@/app/(app)/dashboard/page");`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/dashboard/greeting.ts` | utility (pure) | transform | No pure greeting/period function exists; only `src/lib/formatters.ts` shows the `Intl` + explicit `timeZone` shape. Planner should use RESEARCH §4 vectors. |
| `src/lib/dashboard/campaigns.ts` | service | CRUD read + signed thumbnails | No dashboard-specific composition exists; closest are `metrics.ts`/`list.ts` (use them as the contract, not as the exact module). |
| `src/components/dashboard/*` | components | — | No `src/components/dashboard/` directory exists yet; compose from `campanhas/client.tsx`, `configuracoes/page.tsx`, `empty-state.tsx`, and the current dashboard page. |
| `src/lib/i18n/dashboard/*` | config | — | No per-route namespace exists yet; `src/lib/i18n/*` is the exact structural template. |

## Metadata

**Analog search scope:** `src/app/(app)/dashboard`, `src/app/(app)/campanhas`, `src/app/(app)/configuracoes`, `src/app/(app)/conta`, `src/components/{changelog,readiness,verification,credit,campaign,ui}`, `src/lib/{campaign,credit,i18n,changelog,market-preferences,auth,onboarding}`, `src/__tests__/**`, `src/lib/**/__tests__/**`.
**Files scanned:** ~45 source/test files.
**Pattern extraction date:** 2026-11-02.
**Known limitations:** `getBalanceBreakdown` error swallowing is real (credit-service.ts:21-37); the `throwOnError` option is required for D-04 to be testable. `getCurrentStore` also swallows read errors and returns `null` → `no_store` (pre-existing shared-contract limitation; do not fix in F58). `es-419` copy is a proposal pending human review (RESEARCH A1).
