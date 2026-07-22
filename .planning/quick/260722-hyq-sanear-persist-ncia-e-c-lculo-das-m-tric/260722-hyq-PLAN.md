---
phase: quick
plan: 260722-hyq
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/campaign/generate-image/route.ts
  - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
  - src/lib/metrics/pipeline-metrics.ts
  - src/lib/metrics/__tests__/pipeline-metrics.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "getCreditsGranted returns SUM of grant amounts, not row count"
    - "getRefundRate reflects campaign-only refund rate, ignoring Visual Signature"
    - "getRefundRate classifies legacy campaign deductions via campaign_id when metadata.feature is absent"
    - "getRefundRate classifies refunds via reference column to inherit original deduction's classification"
    - "Campaign reserveCredit records metadata.feature='campaign_pipeline'"
    - "Campaign refundCredit calls record metadata.feature='campaign_pipeline'"
    - "VS refundCredit records metadata.feature='visual_signature' with mode and operationId"
  artifacts:
    - path: src/app/api/campaign/generate-image/route.ts
      provides: "Campaign credit operations with feature metadata"
      contains: 'metadata: { feature: "campaign_pipeline" }'
    - path: src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
      provides: "VS credit operations with feature metadata"
      contains: 'feature: "visual_signature"'
    - path: src/lib/metrics/pipeline-metrics.ts
      provides: "Corrected metric functions"
      exports: ["getCreditsGranted", "getRefundRate"]
    - path: src/lib/metrics/__tests__/pipeline-metrics.test.ts
      provides: "Updated tests covering all new behaviors"
      min_lines: 200
  key_links:
    - from: pipeline-metrics.ts (getCreditsGranted)
      to: credit_transactions
      via: "supabaseAdmin.from('credit_transactions').select('amount') ... eq('type','grant')"
      pattern: "select.*amount.*sum"
    - from: pipeline-metrics.ts (getRefundRate)
      to: credit_transactions
      via: "Query deductions with metadata/campaign_id, classify, then refunds via reference"
      pattern: "metadata.*feature|campaign_id"
    - from: generate-image/route.ts
      to: CreditService.reserveCredit
      via: "metadata: { feature: 'campaign_pipeline' }"
    - from: generate-without-logo/route.ts
      to: CreditService.refundCredit
      via: "metadata: { feature: 'visual_signature', mode, operationId }"
---

<objective>
Sanear a persistência e o cálculo das métricas de crédito no pipeline.

**Purpose:** A métrica "Taxa de Estorno" (`getRefundRate`) no dashboard admin foi contaminada após a Assinatura Visual começar a consumir/estornar créditos. Atualmente ela lê `credit_transactions` sem distinguir campaign de VS, podendo marcar health state como crítico mesmo sem geração de campanha. Paralelamente, "Créditos Concedidos" conta linhas em vez de somar montantes.

**Output:**
- `getCreditsGranted` corrigida para SUM(amount) em vez de COUNT
- `getRefundRate` corrigida para filtrar apenas campanhas (feature="campaign_pipeline" ou legacy campaign_id), excluindo VS
- `reserveCredit`/`refundCredit` de campanha persistem `metadata.feature = "campaign_pipeline"`
- `refundCredit` de VS persiste `metadata.feature = "visual_signature"`
- Testes atualizados cobrindo todos os cenários
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
<interfaces>
From: src/lib/credit/credit-service.ts
```typescript
export class CreditService {
  async reserveCredit(storeId: string, amount: number, opts?: CreditOperationOptions): Promise<string>
  async refundCredit(txId: string, reason: string, opts?: CreditOperationOptions): Promise<string>
}
```

From: src/lib/credit/types.ts
```typescript
export interface CreditOperationOptions {
  campaignId?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}
```

From: src/lib/credit/credit-service.ts (mapRowToCamelCase)
- `metadata` field stored as `Record<string, unknown> | null`
- `reference` field stores original deduction UUID as string for refund transactions
- `campaign_id` column stores campaign UUID for deduction transactions (legacy classification signal)

SQL refund_credit stores `p_tx_id::text` as `reference` (line 373 of migration):
```sql
INSERT INTO public.credit_transactions (...) reference, ... VALUES (..., p_tx_id::text, ...)
```

From: src/lib/metrics/pipeline-metrics.ts
- All existing function signatures: `async function(hours: number): Promise<number | null>`
</interfaces>

**Current getRefundRate (broken):** Queries `.neq("type", "grant")` and calculates `refundCount / data.length * 100`. This includes VS deductions and refunds in denominator and numerator, contaminating the campaign-only metric.

**Current getCreditsGranted (wrong):** Uses `.select("id", { count: "exact", head: true })` — counts rows instead of summing the `amount` column.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix metadata persistence in reserveCredit/refundCredit calls</name>
  <files>
    src/app/api/campaign/generate-image/route.ts
    src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
  </files>
  <action>
    **File 1: `src/app/api/campaign/generate-image/route.ts`**

    **Line 291-294 — reserveCredit call (inside `if (config.creditsChargingEnabled)` block):**
    Add `metadata: { feature: "campaign_pipeline" }` to the `CreditOperationOptions` object. This ensures new deductions are tagged for campaign classification.
    Current: `{ campaignId, idempotencyKey: \`reserve_${campaignId}\` }`
    Target: `{ campaignId, idempotencyKey: \`reserve_${campaignId}\`, metadata: { feature: "campaign_pipeline" } }`

    **Lines 446, 596, 615, 652 — four refundCredit calls:**
    Each currently passes an object with only `idempotencyKey`. Add `metadata: { feature: "campaign_pipeline" }` to each. Do NOT remove the existing idempotencyKey. Example transformation:
    Current: `{ idempotencyKey: \`refund_${creditTxId}\` }`
    Target: `{ idempotencyKey: \`refund_${creditTxId}\`, metadata: { feature: "campaign_pipeline" } }`
    Apply to ALL four call sites (lines 446, 596, 615, 652).

    **File 2: `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`**

    **Line 394 — VS refundCredit call:**
    Currently called with only `(creditTxId, reason)` — no opts at all. The variables `mode` (line 88) and `operationId` (line 164) are in scope.
    Change to: `creditService.refundCredit(creditTxId, isTimeout ? 'timeout' : (isStorageError ? 'storage_error' : 'generation_error'), { metadata: { feature: "visual_signature", mode, operationId } })`
  </action>
  <verify>
    <automated>
      npx grep -c "metadata: { feature: \"campaign_pipeline\" }" src/app/api/campaign/generate-image/route.ts | ForEach-Object { $_ -eq "5" }
    </automated>
  </verify>
  <done>
    - campaign reserveCredit has metadata.feature = "campaign_pipeline"
    - All 4 campaign refundCredit calls have metadata.feature = "campaign_pipeline"
    - VS refundCredit call has metadata.feature = "visual_signature" with mode and operationId
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix getCreditsGranted and getRefundRate + update tests</name>
  <files>
    src/lib/metrics/pipeline-metrics.ts
    src/lib/metrics/__tests__/pipeline-metrics.test.ts
  </files>
  <action>
    **Part A: Rewrite `getCreditsGranted` (pipeline-metrics.ts, lines 62-71)**

    Replace the current implementation that does a COUNT query with a SUM query:
    ```typescript
    export async function getCreditsGranted(hours: number): Promise<number | null> {
      const { data, error } = await supabaseAdmin
        .from("credit_transactions")
        .select("amount")
        .eq("type", "grant")
        .gte("created_at", hoursAgo(hours));

      if (error || !data) return null;
      if (data.length === 0) return 0;
      return data.reduce((sum, row) => sum + (row.amount ?? 0), 0);
    }
    ```
    This selects the `amount` column for grant-type transactions in the time window and sums them.

    **Part B: Rewrite `getRefundRate` (pipeline-metrics.ts, lines 73-84)**

    Classification rules for deductions (type="deduction"):
    - `metadata.feature = "campaign_pipeline"` => campaign deduction
    - `metadata` is null/empty OR `metadata.feature` is null/empty AND `campaign_id IS NOT NULL` => legacy campaign deduction
    - `metadata.feature = "visual_signature"` => VS deduction, exclude
    - `metadata` is null/empty OR `metadata.feature` is null/empty AND `campaign_id IS NULL` => anomaly, exclude

    For refunds: refund has `reference` = original deduction UUID. Refund inherits classification from the deduction it references. If the referenced deduction is a campaign deduction → refund counts as campaign refund. If referenced deduction is VS or anomaly → exclude.

    Edge: if a refund has no matching reference deduction (orphan), exclude it.

    Implementation approach (all in one query, classification in JS):
    1. Fetch last N hours of credit_transactions with relevant columns: `id, type, amount, campaign_id, metadata, reference`
    2. Separate deductions and refunds into two arrays
    3. Classify deductions by the rules above:
       - `campaignDeductionIds` set for campaign-eligible deductions
       - campaign deduction count for denominator
    4. Build a `Map<referenceId, isCampaignRefund>` from deductions
    5. Classify refunds: refund qualifies as campaign if its `reference` is in campaignDeductionIds
    6. Calculate: `return campaignRefundCount > 0 ? Math.round((campaignRefundCount / campaignDeductionCount) * 100) : 0`
    7. Return `null` only if `data` is null or error (not if empty — empty returns 0)

    Use a single query to get all transactions:
    ```typescript
    const { data, error } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, type, amount, campaign_id, metadata, reference")
      .gte("created_at", hoursAgo(hours));
    ```

    Then classify in JS. This is simpler and more maintainable than complex SQL filters.

    **Part C: Update tests (pipeline-metrics.test.ts)**

    Replace current `mockSelect` and `mockCount` helpers with a richer mock that supports the new column selection.

    New mock helper:
    ```typescript
    function mockSelect(data: Record<string, unknown>[]) {
      const chain = {
        not: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        gte: vi.fn(() => Promise.resolve({ data, error: null })),
        is: vi.fn(() => chain),
        in: vi.fn(() => chain),
      };
      mockFrom.mockImplementation(() => ({ select: vi.fn(() => chain) }));
    }
    ```

    Test cases for `getCreditsGranted`:
    1. **Sums amounts correctly:** 3 grant transactions with amounts [100, 50, 25] → returns 175
    2. **Returns 0 when no data:** empty array → returns 0
    3. **Handles negative amounts (grants are positive, but handle generally):** [-10, 20] → returns 10

    Test cases for `getRefundRate`:
    4. **Ignores VS deductions/refunds completely:**
       - 8 campaign deductions, 2 campaign refunds (reference matches campaign deductions)
       - 5 VS deductions, 1 VS refund (reference matches VS deductions)
       - Expected: (2/8)*100 = 25
       - Should NOT include VS in either numerator or denominator
    5. **Includes campaign deductions with metadata.feature="campaign_pipeline":**
       - 10 deductions with feature="campaign_pipeline", 1 refund referencing one of them
       - 0 VS deductions
       - Expected: (1/10)*100 = 10
    6. **Includes legacy campaign deductions (null metadata + campaign_id set):**
       - 5 deductions with metadata=null and campaign_id="abc-123"
       - 1 refund referencing a legacy deduction
       - 0 VS
       - Expected: (1/5)*100 = 20
    7. **Refund classified via reference inherits deduction classification:**
       - 10 campaign deductions (feature="campaign_pipeline")
       - 3 refunds: 2 reference campaign deductions, 1 references a VS deduction
       - Expected: (2/10)*100 = 20
    8. **Anomalies excluded:**
       - 10 campaign deductions, 2 anomaly deductions (null metadata, null campaign_id)
       - 2 campaign refunds referencing campaign deductions, 1 orphan refund (reference not in data)
       - Expected: (2/10)*100 = 20
    9. **Returns 0 when only VS transactions exist:**
       - 5 VS deductions, 1 VS refund
       - Expected: 0
    10. **Returns 0 when empty data:** empty array → returns 0

    All tests must use `await` on the metric functions and verify via `expect().toBe()`.

    Remove the old `mockCount` helper (no longer used) — or keep it if other tests in the file still reference it. The existing tests for `getSuccessRate`, `getErrorRate`, `getAvgCost`, `getAvgDuration`, `getActiveUsers` should remain unchanged.

    Update the `describe("getCreditsGranted")` and `describe("getRefundRate")` blocks. The old test bodies for these two describe blocks should be replaced entirely.
  </action>
  <verify>
    <automated>
      cd C:\Projetos\Vendeo\ V3; npx vitest run src/lib/metrics/__tests__/pipeline-metrics.test.ts --reporter=verbose 2>&1
    </automated>
  </verify>
  <done>
    - getCreditsGranted sums amounts instead of counting rows
    - getRefundRate excludes Visual Signature transactions
    - getRefundRate includes campaign deductions via metadata.feature
    - getRefundRate includes legacy campaign deductions via campaign_id
    - getRefundRate classifies refunds via reference column
    - getRefundRate excludes anomaly deductions and orphan refunds
    - All 10+ new test cases pass
    - Existing tests for other metrics remain passing
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→API | Campaign and VS generate routes accept untrusted input |
| API→credit_transactions | Credit service writes metadata based on caller — untrusted input could reach metadata if not validated server-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260722-01 | Tampering | reserveCredit/refundCredit metadata | mitigate | metadata is server-side constant (`"campaign_pipeline"` or `"visual_signature"`), not derived from user input |
| T-260722-02 | Information Disclosure | getRefundRate via health state | accept | Refund rate is admin-only; no PII exposed |
| T-260722-03 | Tampering | refundCredit via reference spoofing | accept | reference column is set by the `refund_credit` RPC from the original tx_id, not from user-controlled input |
| T-260722-SC | Tampering | npm/pip/cargo installs | mitigate | No new packages in this plan |
</threat_model>

<verification>
1. `npx vitest run src/lib/metrics/__tests__/pipeline-metrics.test.ts` — all tests pass
2. `npm run typecheck` — TypeScript clean
3. `grep` confirm: all 5 campaign credit calls have metadata.feature="campaign_pipeline"
4. `grep` confirm: VS refundCredit call has metadata.feature="visual_signature"
</verification>

<success_criteria>
1. getCreditsGranted returns SUM of grant amounts (e.g., 3 grants of [100,50,25] → 175, not 3)
2. getRefundRate returns 0 when only Visual Signature transactions exist in the period
3. getRefundRate correctly calculates campaign-only refund rate including legacy rows
4. All 10+ new test cases pass alongside existing metric tests
5. TypeScript and build clean
</success_criteria>

<output>
Create `.planning/quick/260722-hyq-sanear-persist-ncia-e-c-lculo-das-m-tric/260722-hyq-SUMMARY.md` when done
</output>
