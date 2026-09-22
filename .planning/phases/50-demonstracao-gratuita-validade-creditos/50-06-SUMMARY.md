---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 06
status: complete
---

# 50-06 Summary

- Added the `demo-credits` reconciler, daily Hobby-safe Vercel cron, durable support request endpoint, admin API/page, and transactional support-request RPC migration.
- The reconciler materializes expired demo balances, repairs evidence-derived notifications/events, queues expiring notifications, and processes email claims.
- Support requests return a durable protocol and timestamp; request, `support_ack`, and `support_notice` are committed atomically and are idempotent by `operationId`.
- `npm run typecheck` passed. Focused ESLint completed without errors; these paths are ignored by the repository ESLint configuration.
- No Vercel Pro plan is confirmed in the repository, so the cron remains daily with a 48-hour lookahead.
