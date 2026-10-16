// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * F56.2b2b — Plano 08 (Recorte 1): contrato ESTÁTICO da Camada 1 do FENCE de
 * publicação. Sem banco/provider: valida a MIGRATION autorada (forward-only),
 * o cliente de crédito (token), o orquestrador (begin antes do upload;
 * disposição de erros) e o serviço de pendência (evidência server-derived).
 */

const MIGRATION = "supabase/migrations/20261016000001_f56_2b2b_publication_fence.sql";
const CLIENT = "src/lib/product-1-1/credit-operation/credit-operation-client.ts";
const ORCH = "src/lib/product-1-1/orchestration/generation-orchestrator.ts";
const RESOLVE = "src/lib/product-1-1/pending/resolve-pending-operation.ts";
const RECOVERY = "src/lib/product-1-1/artifact/artifact-recovery.ts";
const PREV_MIGRATIONS = [
  "supabase/migrations/20261015000001_f56_2b2b_failure_closure.sql",
  "supabase/migrations/20261015000002_f56_2b2b_pending_abandon.sql",
  "supabase/migrations/20261015000003_f56_2b2b_pending_read.sql",
];

const sql = readFileSync(path.resolve(process.cwd(), MIGRATION), "utf8");
const activeSql = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const clientSrc = readFileSync(path.resolve(process.cwd(), CLIENT), "utf8");
const orchSrc = readFileSync(path.resolve(process.cwd(), ORCH), "utf8");
const resolveSrc = readFileSync(path.resolve(process.cwd(), RESOLVE), "utf8");
const recoverySrc = readFileSync(path.resolve(process.cwd(), RECOVERY), "utf8");

describe("F56.2b2b — publication-fence: MIGRATION (forward-only)", () => {
  it("adiciona os 3 campos e o CHECK NÃO inclui delivered/refunded (separado do status)", () => {
    expect(activeSql).toMatch(/publication_state TEXT NOT NULL DEFAULT 'none'/);
    expect(activeSql).toMatch(/publication_token UUID/);
    expect(activeSql).toMatch(/state_epoch INTEGER NOT NULL DEFAULT 0/);
    // O CHECK de publication_state é SEPARADO do status do crédito.
    const check = activeSql.match(/chk_p1_1_credit_publication_state[\s\S]*?CHECK \(([^)]*)\)/);
    expect(check).not.toBeNull();
    const checkBody = check?.[1] ?? "";
    expect(checkBody).toMatch(/'none','in_flight','published','failed_before_upload','result_unknown'/);
    expect(checkBody).not.toMatch(/'delivered'/);
    expect(checkBody).not.toMatch(/'refunded'/);
  });

  it("cria begin/abort/mark_result_unknown/confirm_existing_art e é LOCAL-ONLY", () => {
    for (const fn of [
      "product_1_1_begin_publication",
      "product_1_1_abort_publication",
      "product_1_1_mark_result_unknown",
      "product_1_1_confirm_existing_art",
    ]) {
      expect(activeSql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`));
    }
    expect(sql).toMatch(/migration up --local/);
    expect(activeSql).not.toMatch(/db push/);
  });

  it("`abort` só aceita `before_upload`; confirma objeto existente; nunca reabre terminais", () => {
    expect(activeSql).toMatch(/p_phase IS DISTINCT FROM 'before_upload'/);
    expect(activeSql).toMatch(/abort_not_allowed/);
    expect(activeSql).toMatch(/p_art_kind IS DISTINCT FROM 'integral'[\s\S]*?insufficient_evidence/);
    // confirm_existing_art recusa status terminal.
    expect(activeSql).toMatch(/confirm_existing_art[\s\S]*?IN \('delivered','refunded'\)[\s\S]*?operation_terminal/);
  });

  it("token do dono; fence e frescor no encerramento; exceção administrativa auditada", () => {
    expect(activeSql).toMatch(/publication_token IS DISTINCT FROM p_publication_token/);
    expect(activeSql).toMatch(/publication_not_owner/);
    expect(activeSql).toMatch(/publication_state IN \('in_flight','result_unknown'\)/);
    expect(activeSql).toMatch(/publication_in_progress/);
    expect(activeSql).toMatch(/evidence_stale/);
    // Exceção administrativa: bypass SOMENTE com a marca autorizada.
    expect(activeSql).toMatch(/NOT v_authorized_abandon/);
  });

  it("NÃO edita as migrations 20261015* (forward-only): cada uma preserva o conteúdo original", () => {
    for (const prev of PREV_MIGRATIONS) {
      const src = readFileSync(path.resolve(process.cwd(), prev), "utf8");
      expect(src).toMatch(/^-- F56\.2b2b/);
      expect(src).not.toMatch(/publication_fence/);
    }
  });
});

describe("F56.2b2b — publication-fence: cliente/orquestrador/recuperação/serviço", () => {
  it("cliente de crédito expõe begin/abort/markResultUnknown e passa o token em mark/deliver", () => {
    expect(clientSrc).toMatch(/beginPublication/);
    expect(clientSrc).toMatch(/abortPublication/);
    expect(clientSrc).toMatch(/markResultUnknown/);
    expect(clientSrc).toMatch(/p_publication_token/);
  });

  it("orquestrador anuncia ANTES do upload, usa token e mantém proteção nos erros", () => {
    const beginIdx = orchSrc.indexOf("beginPublication(");
    const storeIdx = orchSrc.indexOf("await artifact.storeArtifact(");
    expect(beginIdx).toBeGreaterThan(-1);
    expect(storeIdx).toBeGreaterThan(-1);
    expect(beginIdx).toBeLessThan(storeIdx);
    expect(orchSrc).toMatch(/markArtUploaded\(campaignId, operationId, publicationToken\)/);
    expect(orchSrc).toMatch(/deliver\(campaignId, operationId, publicationToken\)/);
    expect(orchSrc).toMatch(/markResultUnknown\(campaignId, operationId, publicationToken\)/);
    expect(orchSrc).toMatch(/before_upload/);
  });

  it("recuperação confirma objeto EXISTENTE (sem novo upload / sem token)", () => {
    expect(recoverySrc).toMatch(/confirm_existing_art/);
    expect(recoverySrc).toMatch(/confirmExistingArt/);
    expect(recoverySrc).not.toMatch(/p_publication_token/);
  });

  it("serviço de pendência envia evidência server-derived com state_epoch/publication_state", () => {
    expect(resolveSrc).toMatch(/server-derived/);
    expect(resolveSrc).toMatch(/state_epoch: state\.stateEpoch/);
    expect(resolveSrc).toMatch(/publication_state: state\.publicationState/);
  });
});
