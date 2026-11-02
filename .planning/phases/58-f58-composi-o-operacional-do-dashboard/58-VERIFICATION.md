---
phase: 58-f58-composi-o-operacional-do-dashboard
verified: 2026-11-02T18:38:35Z
status: passed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 15/16
  gaps_closed:
    - "Human visual/functional validation now covers all 14 checklist items (58-05-human-visual.md), with only the documented instrumental caveats"
    - "Thumbnail fallback now handles images that fail before hydration; the campaign open action remains available"
  gaps_remaining: []
  regressions: []
---

# Phase 58: F58 - Composição operacional do dashboard — Verification Report

**Phase Goal:** Recompose the dashboard into an operational composition: compact greeting with subtitle, available (`ready`-only) campaigns in a single recent-campaigns panel with explicit open actions, credits available/zero/unavailable, compact dismissible news, isolated partial failures, full pt-BR/es-419 localization through a dashboard-only namespace, localized warnings, precise per-block `lang`, DOM order credits -> campaigns -> news -> fixed creation band, and preserved shell/admin/accessibility. No recommendations, migrations, APIs, dependencies, deploy or production changes.

**Verified:** 2026-11-02T18:38:35Z
**Status:** passed (with documented limitations; publication not authorized)
**Re-verification:** Yes — after UAT completion and the pre-hydration thumbnail fallback fix

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | Campaign queries return only `status = "ready"`, max 3, `created_at desc`; error/generating never enter dashboard queries, rows or counts; `/campanhas` remains the full list | ✓ VERIFIED | `src/lib/dashboard/campaigns.ts:43-49` applies `.eq("store_id", storeId)`, `.eq("status","ready")`, `.order("created_at", {ascending:false})`, `.limit(limit)`; `DASHBOARD_CAMPAIGN_LIMIT = 3`; count from `countReadyCampaigns` (`campaigns.ts:78-81`); no `countCampaigns`/`getRecentCampaigns` imports. UAT item 9: dashboard showed 59 available campaigns while `/campanhas?status=error` showed the 3 error campaigns from homolog. |
| 2 | Campaign DTO exposes `id`, `productName`, `createdAt`, `thumbnailUrl` only (never `storagePath`); signed thumbnails via `generateBatchThumbnailUrls` | ✓ VERIFIED | `campaigns.ts:13-18,45,55-68` selects 4 columns and maps to a DTO without `storage_path`; tests in `src/lib/dashboard/__tests__/campaigns.test.ts` pass. |
| 3 | Credits represent available/zero/unavailable; read failure is never converted to zero | ✓ VERIFIED | `src/lib/dashboard/credits.ts:12-39` returns `{state:"unavailable"}` on catch with no balance key; `src/lib/credit/credit-service.ts` additive `throwOnError`, `PGRST116` stays zero; `dashboard-credits.tsx:69-85` renders distinct states. UAT items 11: real zero (`0 créditos`, no “indisponível”) and unavailable (amber icon, no 0) observed. |
| 4 | Greeting resolves by store `timeZone` with neutral fallback on null/invalid/failure; missing store yields welcome; never assumes Brasília | ✓ VERIFIED | `src/lib/dashboard/greeting.ts:46-90` uses injected `now` and `Intl.DateTimeFormat(locale,{timeZone,hourCycle:"h23"})`, catches → `neutral`; no `getHours`; page passes store settings timeZone (`page.tsx:87-98`). UAT items 7-8: server `TZ=Asia/Tokyo` kept store-period greeting; neutral fallback observed in harness. |
| 5 | Campaign and credit failures are isolated per section without crashing the page | ✓ VERIFIED | `src/lib/dashboard/sections.ts:13-35` returns `{ok:false}`; `page.tsx:71-90` uses `Promise.allSettled`; `dashboard-campaigns` failure panel has `role="status"`; page tests cover both partial failures. |
| 6 | Dashboard-only i18n namespace exists with complete pt-BR/es-419 parity (keys and placeholders), frozen, no index signature/any | ✓ VERIFIED | `src/lib/i18n/dashboard/messages.ts` explicit readonly interfaces; `catalogs/pt-BR.ts` (`Object.freeze` at all levels) and `catalogs/es-419.ts` (`satisfies DashboardMessages`); placeholder parity tests pass. |
| 7 | Dashboard namespace is isolated from global barrel, shell, layout and admin; no parallel resolver | ✓ VERIFIED | `src/lib/i18n/dashboard/get-messages.ts` reuses `SupportedUiLocale`; no `i18n/dashboard` or dashboard catalog import in `src/lib/i18n/index.ts`, `messages.ts`, `get-catalog.ts`, `(app)/layout.tsx`, `app-shell.tsx`; `isolation.test.ts` passes; admin diff empty. |
| 8 | VerificationBanners and ReadinessBanner accept optional localized messages while preserving pt-BR defaults | ✓ VERIFIED | `verification-banners.tsx:55-77` and `readiness-banner.tsx:14-62` optional message props with pt-BR defaults; `readiness-check-banner.tsx:9-15` forwards; page passes namespace messages (`page.tsx:124-141`). UAT item 12 observed pending readiness in pt-BR/es-419. |
| 9 | Compact news uses existing editorial excerpt as plain text, dismissible, without full markdown body or IA; complete mode preserved | ✓ VERIFIED | `src/lib/changelog/excerpt.ts:37-95` deterministic extractor (no IA/network); `changelog-announcement.tsx:63-126` compact branch renders React text only (no `renderMarkdown`/`dangerouslySetInnerHTML`); `dashboard-news.tsx` sends only `{frontmatter}` plus excerpt; full branch still uses `renderMarkdown` (line 156). |
| 10 | Precise per-block `lang`: root es-419 only in es-419, dynamic names `lang=""`, editorial title/excerpt `lang="pt-BR"`; actions in UI language | ✓ VERIFIED | `page.tsx:46,116` root lang; `dashboard-header.tsx` store name `lang=""`; `available-campaign-card.tsx:66-71` product `lang=""`; `changelog-announcement.tsx:75,94` title/excerpt `lang="pt-BR"`; localization tests assert root es-419, `lang=""` names and exactly 2 `lang="pt-BR"` editorial nodes. UAT item 2 confirmed mixed-language composition. |
| 11 | DOM order is credits → campaigns → news → fixed creation band; desktop uses explicit placements, no CSS `order`; no technical metrics or recommendations | ✓ VERIFIED | `page.tsx:143-174`: credits div, campaigns div, conditional news div, then `DashboardShortcut`; explicit `lg:col-start-*`/`lg:row-start-*`; `dashboard-layout-order.test.tsx` asserts order, placements, no `order-*`, no positive `tabindex`, and no “Taxa de Sucesso”/“Total de Campanhas”/“Campanhas Prontas”/“Próximo passo”/“Recomenda”. UAT item 13 real Tab order: créditos → campanhas → novidades. |
| 12 | States no-store/no-eligible/has-eligible and localized server-first loading are implemented; loading has skeletons in final order without `StatsSkeleton count={4}` | ✓ VERIFIED | `page.tsx:48-69` early no-store return (no credit/campaign/timezone/news queries); `dashboard-campaigns.tsx:68-120` failure vs empty vs list; `loading.tsx:14-60` async server component resolving render context/messages, `role="status"`, localized `aria-label`, 3 `CardSkeleton`; loading tests pass. |
| 13 | Shell, admin, navigation, identity and accessibility preserved; no migrations, APIs, dependencies, deploy or production changes; only authorized shared-service change is additive `throwOnError` | ✓ VERIFIED | `git diff --name-only 77cc9413..HEAD` empty for `supabase/migrations`, `src/app/api`, `package.json`, `package-lock.json`, `(app)/admin`, `components/shell`, `(app)/layout.tsx`, `campaign/metrics.ts`, `campaign/list.ts`, `onboarding/state.ts`, `balance-display.tsx`; only `credit-service.ts` additive opt-in; 44 px/focus-visible classes present; UAT item 14 opened `/admin` manually under es-419 and it stayed pt-BR. Local branch has no upstream configured (no push). |
| 14 | Local tests/gates executed with real results and are not declared production proof; publish gates separated | ✓ VERIFIED | Independent re-run: focused suite 30 files / 176 tests PASS; `npm.cmd run typecheck` exit 0; `npm.cmd run build` exit 0 with 95/95 pages and `/dashboard` 4.55 kB / 110 kB; `openspec validate ... --strict` valid; working-tree `git diff --check` exit 0. `58-05-PUBLISH-GATES.md` separates local/homolog/publication and declares production not proven. See WARNING 3 for the committed-range whitespace nuance. |
| 15 | Additive `CreditService.getBalanceBreakdown({throwOnError})` keeps default behavior, rejects only on strict mode except `PGRST116` (zero) | ✓ VERIFIED | `src/lib/credit/credit-service.ts:30-42`; tests `credit-service-throw-on-error.test.ts` cover default, false, true, PGRST116 and success; included in the passing focused suite. |
| 16 | Human visual validation covers pt-BR/es-419, mobile/tablet/desktop, slow network, timezone, thumbnails, credits and mixed-language, with explicit acceptance | ✓ VERIFIED | `evidence/58-05-human-visual.md` now records all 14 checklist items as PASS/PASS com ressalva (items 5/6b performance caveat; item 13 screen-reader caveat), with captures for pt-BR/es-419 desktop/mobile and a 768 px tablet check. `58-05-PUBLISH-GATES.md §b` matches. UAT item 10 also documents the pre-hydration thumbnail defect found and its correction. |

**Score:** 16/16 truths verified

### Deferred Items

None. Publication (push/merge/deploy/production smoke) is deliberately out of scope and not authorized; it is not a later-phase deliverable of F58.

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/lib/dashboard/campaigns.ts` | Ready-only query, signed thumbnails, count | ✓ VERIFIED | 4-column select, limit 3, DTO without storage path |
| `src/lib/dashboard/credits.ts` | available/zero/unavailable | ✓ VERIFIED | Failure never yields zero |
| `src/lib/dashboard/greeting.ts` | Pure timezone greeting | ✓ VERIFIED | No clock, no fixed timezone fallback |
| `src/lib/dashboard/sections.ts` | Section isolation | ✓ VERIFIED | Discriminated `SectionResult` |
| `src/lib/dashboard/format.ts` | Locale + timezone date | ✓ VERIFIED | Explicit timezone handling |
| `src/lib/credit/credit-service.ts` | Additive `throwOnError` | ✓ VERIFIED | Default false, PGRST116 zero |
| `src/lib/i18n/dashboard/**` | Dashboard namespace | ✓ VERIFIED | Types, frozen catalogs, resolver, parity/isolation tests |
| `src/components/dashboard/*` | Composition components | ✓ VERIFIED | Header, credits, campaigns, card, news, shortcut |
| `src/components/dashboard/available-campaign-card.tsx` | Thumbnail fallback incl. pre-hydration failure | ✓ VERIFIED | `useState` + `useRef` + `useEffect` checks `complete && naturalWidth === 0` on mount and per URL change; `onError` keeps runtime coverage; `ImageOff` fallback swaps only the image box; the `/campanhas/[id]` Link is rendered unconditionally. **Working tree only — not yet committed.** |
| `src/components/changelog/changelog-announcement.tsx` | Retrocompatible compact mode | ✓ VERIFIED | Full branch preserved; compact is text-only |
| `src/lib/changelog/excerpt.ts` | Pure excerpt builder | ✓ VERIFIED | Returns null without text, no IA |
| `src/app/(app)/dashboard/page.tsx` | Operational composition | ✓ VERIFIED | `Promise.allSettled`, localized, lang, DOM order, fixed band |
| `src/app/(app)/dashboard/loading.tsx` | Localized ordered skeleton | ✓ VERIFIED | Async server-first, no StatsSkeleton |
| Evidence + publish gates | Gate evidence and local/homolog/production separation | ✓ VERIFIED | Real commands/results, publication explicitly not executed/authorized |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/dashboard/campaigns.ts` | `lib/campaign/list.ts` | `generateBatchThumbnailUrls` | ✓ WIRED | Imported and called with ready rows |
| `lib/dashboard/campaigns.ts` | `campaigns.status` | `.eq("status","ready")` | ✓ WIRED | Filter at source; limit/order present |
| `lib/dashboard/credits.ts` | `CreditService.getBalanceBreakdown` | `throwOnError` | ✓ WIRED | Called with `{throwOnError:true}`, catch → unavailable |
| `lib/dashboard/sections.ts` | `dashboard/page.tsx` | `loadCampaignSection`/`loadCreditSection` | ✓ WIRED | Consumed in `Promise.allSettled` |
| `dashboard/page.tsx` | `lib/i18n/dashboard` | `getDashboardMessages` | ✓ WIRED | Locale resolved server-side |
| `dashboard/page.tsx` | `lib/dashboard/greeting.ts` | `resolveDashboardGreeting` | ✓ WIRED | Receives timeZone + locale |
| `components/dashboard/dashboard-news.tsx` | `ChangelogAnnouncement` | `compact` + excerpt + labels | ✓ WIRED | `{frontmatter}` only; no body/slug |
| `components/changelog/changelog-announcement.tsx` | `use-changelog-state` | `dismissAnnouncement` | ✓ WIRED | Dismiss does not touch lastSeen |
| `components/dashboard/dashboard-campaigns.tsx` | `AvailableCampaignCard` | row render | ✓ WIRED | One explicit “Abrir campanha” link per row |
| `AvailableCampaignCard` image | `ImageOff` fallback | `onError` + mount `useEffect`/`ref` | ✓ WIRED | Handles post- and pre-hydration load failure without affecting the link |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `DashboardCampaigns` | `items`/`count` | `loadCampaignSection` → Supabase `.eq(status,"ready")` + `countReadyCampaigns` | Yes — DB query, signed URLs | ✓ FLOWING |
| `DashboardCredits` | `state` | `loadCreditSection` → `CreditService.getBalanceBreakdown` | Yes — canonical balance breakdown; failure distinct | ✓ FLOWING |
| `DashboardNews` | `entry`/`excerpt` | `getLatestAnnouncement` → `buildAnnouncementExcerpt(entry.body)` | Yes — real changelog content; null-safe | ✓ FLOWING |
| `AvailableCampaignCard` | `thumbnailUrl` | `generateBatchThumbnailUrls` per row | Yes — signed URL or explicit null/failed fallback | ✓ FLOWING |
| `DashboardHeader` | `greeting`/`storeName` | `resolveDashboardGreeting` with store name + canonical timeZone | Yes — store settings; neutral fallback | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Focused F58 suites pass (page states, localization, lang, DOM order, loading, components, lib, credit, changelog, banners, i18n) | `npx vitest run src/lib/dashboard src/lib/credit/__tests__/credit-service-throw-on-error.test.ts src/lib/i18n/dashboard src/lib/changelog src/components/dashboard src/components/changelog src/components/verification src/components/readiness src/__tests__/app/dashboard` | 30 files / 176 tests passed, 0 failed (independent run) | ✓ PASS |
| TypeScript compiles | `npm.cmd run typecheck` | exit 0, no diagnostics | ✓ PASS |
| Production build | `npm.cmd run build` | exit 0; compiled successfully; 95/95 pages; `/dashboard` 4.55 kB / 110 kB; shared 102 kB | ✓ PASS |
| OpenSpec strict | `npx openspec validate fase-58-composicao-o-operacional-do-dashboard --strict` | exit 0, “Change ... is valid” | ✓ PASS |
| Working-tree diff check | `git diff --check` | exit 0 | ✓ PASS |
| Scope preserved | `git diff --name-only 77cc9413..HEAD -- <forbidden paths>` | empty for migrations, API, deps, shell/admin/layout/BalanceDisplay/contracts | ✓ PASS |

The build result is local evidence only; it does not prove production, latency, or external integration.

### Probe Execution

Probe execution: SKIPPED — no `scripts/*/tests/probe-*.sh` or probe-based verification is declared for this UI phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REQ-58-01 | 58-01, 58-04 | Ready-only campaigns; error/generation excluded; `/campanhas` preserved; shared services intact | ✓ SATISFIED | Query filter/count/page tests; UAT item 9; no changes to shared campaign services |
| REQ-58-02 | 58-03, 58-04 | Up to 3 available campaigns, signed thumbnail, fallback, `/campanhas/[id]` and `/campanhas` | ✓ SATISFIED | `campaigns.ts`, `available-campaign-card.tsx`, page/component tests; UAT item 10 |
| REQ-58-03 | 58-01, 58-03, 58-04 | Readable credit balance in UI locale, `/conta`, zero vs available vs unavailable | ✓ SATISFIED | `credits.ts`, `dashboard-credits.tsx`, credit tests; UAT item 11 |
| REQ-58-04 | 58-03, 58-04 | Compact dismissible news with existing excerpt, `/novidades`, no IA | ✓ SATISFIED | Excerpt builder + compact announcement; boundary tests |
| REQ-58-05 | 58-01, 58-04 | Compact greeting with store name, canonical timeZone, uiLocale, neutral fallback | ✓ SATISFIED | `greeting.ts`, header subtitle, unit tests; UAT items 7-8 |
| REQ-58-06 | 58-02, 58-05 | Dashboard namespace pt-BR/es-419, structural/placeholder parity, no shell payload growth, no parallel resolver | ✓ SATISFIED | Parity/isolation tests; build shared JS unchanged at 102 kB (JS only; RSC not measured) |
| REQ-58-07 | 58-02, 58-04 | Verification/readiness warnings localized via optional props, pt-BR default elsewhere | ✓ SATISFIED | Banners optional messages; dashboard passes namespace; tests; UAT item 12 |
| REQ-58-08 | 58-03, 58-04 | `lang` on smallest block; actions in UI language; commercial content intact | ✓ SATISFIED | Localization tests assert root es-419, `lang=""` names, exactly 2 `lang="pt-BR"`; UAT item 2 |
| REQ-58-09 | 58-01, 58-04 | No-store, no-eligible, loading, failure and isolated partial states | ✓ SATISFIED | `sections.ts`, page early return, EmptyState, failure panels, loading |
| REQ-58-10 | 58-03, 58-04, 58-05 | Mobile/tablet/desktop responsiveness, mobile priority, touch targets, safe truncation | ✓ SATISFIED | DOM order/placements and 44 px verified by tests; UAT items 3-4 (tablet 768 px, long names, no overlap) and 13 (zoom/truncation) |
| REQ-58-11 | 58-02, 58-04, 58-05 | Shell, identity, navigation, existing actions, accessibility and admin preserved; no recommendations/metrics | ✓ SATISFIED | Forbidden-path diff empty; admin isolation test; layout-order test; static creation band; UAT item 14 |
| REQ-58-12 | 58-05 | Automated validation, human visual validation and publication gates separated; local ≠ production | ✓ SATISFIED | Automated gates independently re-run; complete 14-item UAT in `58-05-human-visual.md`; publication explicitly not executed/authorized |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/i18n/dashboard/messages.ts` / catalogs | 25-26 | `unitSingular`/`unitPlural` declared but no longer read by `dashboard-credits.tsx` | ℹ️ Info | Dead catalog keys only; no user-visible defect, no stub |
| `eslint.config.mjs` | — | Lint exit 0 does not analyze `.ts/.tsx` (preexisting) | ℹ️ Info | Lint is not TypeScript evidence; typecheck independently passed |
| `evidence/58-05-automated-gates.md` | 6.1 | RSC payload not measured | ℹ️ Info | Only JS/shared payload and static isolation proven; documented limitation |

No `TBD`/`FIXME`/`XXX`, no placeholder components, no empty-return stubs and no hardcoded UI strings were found in the F58 dashboard code. (Matches for “TODO” were substring hits inside the Portuguese word “todos”.)

### Warnings and Limitations

1. **Stale human-UAT tracker.** `58-HUMAN-UAT.md` still shows `status: partial` with 12 items `[pending]`, even though `evidence/58-05-human-visual.md` and `58-05-PUBLISH-GATES.md` record 14/14 PASS with only instrumental caveats. The tracker should be reconciled by the orchestrator; it does not contradict the implementation.
2. **Stale tracking metadata.** `.planning/ROADMAP.md` (Phase 58 status) and `.planning/STATE.md` still describe the phase as `human_needed` / not concluded. They were accurate before this re-verification and need a status update after this report.
3. **Committed-range whitespace check.** `git diff --check` on the working tree is clean, but `git diff --check 77cc9413..HEAD` exits 2 because `58-05-PUBLISH-GATES.md` and `evidence/58-05-human-visual.md` contain Markdown hard-break trailing spaces. This is documentation hygiene, not an implementation defect, but it makes the literal `77cc9413..HEAD` claim in `58-05-SUMMARY.md` inaccurate. The gate recorded in `58-05-automated-gates.md` used plain `git diff --check`, which passes.
4. **Thumbnail fix is uncommitted.** The pre-hydration fallback correction exists only in the working tree (`src/components/dashboard/available-campaign-card.tsx`). It must be committed with the phase artifacts; verification does not commit.
5. **No automated regression test for the pre-hydration path.** The new `useEffect`/`ref` branch is not asserted by `available-campaign-card.test.tsx` (jsdom cannot naturally reproduce a pre-hydration broken image). It was validated by the UAT scenario (aborted campaign images → 3 `ImageOff` fallbacks with actions preserved). Recommend adding a unit test that stubs `complete`/`naturalWidth`.
6. **Instrumental caveats accepted (documented, not failures).** A real screen reader was not executed, and no fine-grained performance measurement was recorded for Slow 4G. The localized skeleton, resolved `lang`/`aria-label`, Tab order, contrast measurements and throttled navigation were observed.
7. **Homolog/local only.** Captures and UAT are local homolog evidence; they do not prove production behavior. Publication (push/merge/deploy/production smoke) was not executed and is explicitly not authorized.

### Human Verification Required

None outstanding. All 14 items of the plan 58-05 human checklist were observed and recorded in `evidence/58-05-human-visual.md`; the only remaining caveats are the instrumental limits listed above.

### Gaps Summary

No implementation gap remains. The operational composition, ready-only data boundary, credit exception handling, dashboard-only localization namespace, localized warnings, per-block `lang`, DOM/keyboard order, fixed creation band, localized loading state, preserved shell/admin and scope boundaries are present in the codebase and covered by passing tests, typecheck and build. The previously missing human validation is now evidenced across all 14 items, including tablet, slow 4G, loading timing, timezone, error campaigns, thumbnails, credits, readiness, contrast/zoom/truncation and admin. The UAT also surfaced and the working tree contains the pre-hydration thumbnail fallback fix with the campaign action preserved.

Publication remains unauthorized and unexecuted; local evidence is not production proof. Status is `passed` with the warnings above.

---

_Verified: 2026-11-02T18:38:35Z_
_Verifier: the agent (gsd-verifier)_
