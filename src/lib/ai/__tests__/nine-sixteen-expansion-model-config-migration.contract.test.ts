// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato ESTATICO da migration F60.6 (autorada, NAO aplicada).
 *
 * Le apenas o texto do arquivo: nenhum banco, Docker, Supabase CLI ou provider.
 * As assercoes normalizam espacos/quebras e ignoram comentarios de linha para
 * nao depender de indentacao.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const MIGRATION_NAME_PATTERN =
  /^\d{14}_f60_6_nine_sixteen_expansion_model_config\.sql$/;

const matches = readdirSync(MIGRATIONS_DIR).filter((name) =>
  name.endsWith("_f60_6_nine_sixteen_expansion_model_config.sql"),
);
const FILE_NAME = matches.length === 1 ? matches[0] : "";
const RAW = FILE_NAME ? readFileSync(path.join(MIGRATIONS_DIR, FILE_NAME), "utf8") : "";

/** Remove comentarios de linha (o conteudo SQL autorado nao usa `--` em literais). */
function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

const CODE = stripLineComments(RAW);
const SQL = CODE.replace(/\s+/g, " ").trim();
/** Codigo sem `DO UPDATE SET` para separar o upsert do UPDATE de colunas. */
const SQL_WITHOUT_CONFLICT_UPDATE = SQL.replace(/DO\s+UPDATE\s+SET/gi, "DO __conflict_set__");

function functionText(name: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}(`;
  const start = SQL.indexOf(marker);
  if (start < 0) return "";
  const end = SQL.indexOf("$$;", start);
  return end < 0 ? SQL.slice(start) : SQL.slice(start, end + 3);
}

function jsonbBuildObjects(text: string): string[] {
  const found: string[] = [];
  const marker = "jsonb_build_object(";
  let index = text.indexOf(marker);
  while (index >= 0) {
    let depth = 0;
    let cursor = index + "jsonb_build_object".length;
    for (; cursor < text.length; cursor += 1) {
      if (text[cursor] === "(") depth += 1;
      if (text[cursor] === ")") {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      }
    }
    found.push(text.slice(index, cursor));
    index = text.indexOf(marker, cursor);
  }
  return found;
}

function textBetween(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker);
  if (start < 0) return "";
  const end = text.indexOf(endMarker, start);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

type WriteTarget = { kind: string; table: string };

const WRITE_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  {
    kind: "CREATE TABLE",
    pattern: /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
  {
    kind: "ALTER TABLE",
    pattern: /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
  {
    kind: "GRANT",
    pattern: /\bGRANT\b[^;]*?\bON\s+TABLE\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
  {
    kind: "REVOKE",
    pattern: /\bREVOKE\b[^;]*?\bON\s+TABLE\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
  {
    kind: "INSERT INTO",
    pattern: /INSERT\s+INTO\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
  {
    kind: "UPDATE",
    pattern: /\bUPDATE\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\s+SET\b/gi,
  },
  {
    kind: "DELETE FROM",
    pattern: /DELETE\s+FROM\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
  {
    kind: "CREATE POLICY",
    pattern: /CREATE\s+POLICY[^;]*?\sON\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
  {
    kind: "CREATE TRIGGER",
    pattern: /CREATE\s+TRIGGER[^;]*?\sON\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi,
  },
];

function writeTargets(input: string = SQL_WITHOUT_CONFLICT_UPDATE): WriteTarget[] {
  const targets: WriteTarget[] = [];
  for (const { kind, pattern } of WRITE_PATTERNS) {
    for (const match of input.matchAll(pattern)) {
      targets.push({ kind, table: match[1].toLowerCase() });
    }
  }
  return targets;
}

const ALLOWED_WRITE_TARGETS = new Set([
  "public.nine_sixteen_expansion_model_config",
  "public.product_9_16_two_stage_operations",
  "public.product_9_16_two_stage_steps",
  "public.admin_audit_log",
]);

const AUDIT_ACTIONS = [
  "credit_grant",
  "credit_adjustment",
  "store_create_invite",
  "manual_refund",
  "approve_verification",
  "reject_verification",
  "create_test_store",
  "admin_exception",
  "reveal_cnpj",
  "access_request_approve",
  "access_request_reject",
  "feature_flag_update",
  "ai_model_selection_update",
  "ai_model_selection_reset",
  "support_credit_request_update",
  "data_subject_request_received",
  "data_subject_request_in_progress",
  "data_subject_request_completed",
  "data_subject_request_cancelled",
  "data_subject_request_cancel_rejected",
  "image_model_pair_config_update",
  "product_1_1_pending_resolution",
  "access_request_invite",
  "visual_signature_model_config_update",
  "visual_signature_model_config_reset",
  "visual_signature_model_config_publish",
  "visual_signature_model_config_activation",
];

const AUDIT_TARGET_TYPES = [
  "store",
  "user",
  "campaign",
  "access_request",
  "feature_flag",
  "ai_model_selection",
  "support_credit_request",
  "data_subject_request",
  "image_model_pair_config",
  "visual_signature_model_config",
];

describe("migration F60.6 — arquivo autorado e NAO aplicado", () => {
  it("existe exatamente um arquivo com timestamp UTC de 14 digitos", () => {
    expect(matches).toHaveLength(1);
    expect(FILE_NAME).toMatch(MIGRATION_NAME_PATTERN);
    expect(FILE_NAME).toMatch(/^\d{14}_/);
  });

  it("declara LOCAL-ONLY / NAO APLICADA e autorizacao separada", () => {
    expect(RAW).toContain("LOCAL-ONLY");
    expect(RAW).toContain("NAO APLICADA");
    expect(RAW).toContain("gate");
  });
});

describe("tabela singleton da configuracao", () => {
  const table = textBetween(
    SQL,
    "CREATE TABLE IF NOT EXISTS public.nine_sixteen_expansion_model_config",
    "COMMENT ON TABLE",
  );

  it("cria a tabela singleton com escopo 'expansion'", () => {
    expect(table).toContain("scope TEXT PRIMARY KEY DEFAULT 'expansion'");
    expect(table).toContain("model TEXT NOT NULL");
    expect(table).toContain("quality TEXT NOT NULL");
    expect(table).toContain("config_version_id UUID NOT NULL DEFAULT gen_random_uuid()");
    expect(table).toContain("reason TEXT");
    expect(table).toContain("updated_by UUID REFERENCES auth.users(id)");
    expect(table).toContain("updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    expect(table).toContain("created_at TIMESTAMPTZ NOT NULL DEFAULT now()");
  });

  it("restringe escopo, modelo e qualidade pelas listas fechadas", () => {
    expect(table).toContain("chk_nsec_scope CHECK (scope = 'expansion')");
    expect(table).toContain("chk_nsec_quality CHECK (quality IN ('low', 'medium'))");

    const modelCheck = textBetween(table, "chk_nsec_model CHECK (", ")");
    expect(modelCheck).toContain("'gpt-image-2.5-flare'");
    expect(modelCheck).toContain("'gpt-image-2.5-sunburst'");
    expect(modelCheck).not.toContain("'gpt-image-2'");
  });

  it("habilita RLS service-only e grants sem DELETE", () => {
    expect(SQL).toContain(
      "ALTER TABLE public.nine_sixteen_expansion_model_config ENABLE ROW LEVEL SECURITY",
    );
    expect(SQL).toContain(
      'CREATE POLICY "Service role manages nine sixteen expansion config"',
    );
    expect(SQL).toContain(
      "REVOKE ALL ON TABLE public.nine_sixteen_expansion_model_config FROM PUBLIC, anon, authenticated",
    );
    expect(SQL).toContain(
      "GRANT SELECT, INSERT, UPDATE ON TABLE public.nine_sixteen_expansion_model_config TO service_role",
    );
    expect(SQL).not.toMatch(
      /GRANT[^;]*DELETE[^;]*ON TABLE public\.nine_sixteen_expansion_model_config/i,
    );
  });
});

describe("provisionamento inicial explicito", () => {
  it("insere Sunburst low com ON CONFLICT (scope) DO NOTHING (nunca DO UPDATE)", () => {
    const provisioning = textBetween(
      SQL,
      "INSERT INTO public.nine_sixteen_expansion_model_config (",
      ";",
    );

    expect(provisioning).toContain("'gpt-image-2.5-sunburst'");
    expect(provisioning).toContain("'low'");
    expect(provisioning).toContain("provisionamento inicial F60.6");
    expect(provisioning).toContain("ON CONFLICT (scope) DO NOTHING");
    expect(provisioning).not.toContain("DO UPDATE");
  });
});

describe("RPC administrativa auditada", () => {
  const rpc = functionText("admin_set_nine_sixteen_expansion_model_config");

  it("declara a assinatura, SECURITY DEFINER e search_path vazio", () => {
    expect(rpc).toContain(
      "p_actor_id UUID, p_model TEXT, p_quality TEXT, p_reason TEXT, p_operation_id UUID",
    );
    expect(rpc).toContain("SECURITY DEFINER");
    expect(rpc).toContain("SET search_path = ''");
    expect(SQL).toContain(
      "REVOKE EXECUTE ON FUNCTION public.admin_set_nine_sixteen_expansion_model_config(UUID, TEXT, TEXT, TEXT, UUID)",
    );
    expect(SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.admin_set_nine_sixteen_expansion_model_config(UUID, TEXT, TEXT, TEXT, UUID) TO service_role",
    );
  });

  it("valida motivo, operationId, ator e revalida o ator em admin_users", () => {
    expect(rpc).toContain("RAISE EXCEPTION 'missing_reason'");
    expect(rpc).toContain("RAISE EXCEPTION 'missing_operation_id'");
    expect(rpc).toContain("RAISE EXCEPTION 'missing_actor_id'");
    expect(rpc).toContain("FROM public.admin_users WHERE user_id = p_actor_id");
    expect(rpc).toContain("RAISE EXCEPTION 'actor_not_admin'");
    expect(rpc).toContain("RAISE EXCEPTION 'invalid_model'");
    expect(rpc).toContain("RAISE EXCEPTION 'invalid_quality'");
    expect(rpc).toContain("capability = 'campaign_product_image'");
    expect(rpc).toContain("status = 'active'");
    expect(rpc).toContain("RAISE EXCEPTION 'model_not_in_catalog'");
  });

  it("revalida o ator antes de qualquer escrita ou auditoria", () => {
    const adminCheck = rpc.indexOf("actor_not_admin");
    const firstWrite = rpc.indexOf("INSERT INTO public.nine_sixteen_expansion_model_config");
    const audit = rpc.indexOf("INSERT INTO public.admin_audit_log");
    expect(adminCheck).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(adminCheck);
    expect(audit).toBeGreaterThan(firstWrite);
  });

  it("idempotencia estrita por conteudo, com conflito ANTES do upsert", () => {
    expect(rpc).toContain("WHERE operation_id = p_operation_id");
    expect(rpc).toContain("action = 'nine_sixteen_expansion_model_config_update'");
    expect(rpc).toContain("RAISE EXCEPTION 'operation_id_conflict'");
    expect(rpc).toContain("'idempotent', true");
    expect(rpc).toContain("v_existing_metadata ->> 'model' IS DISTINCT FROM btrim(p_model)");
    expect(rpc).toContain("v_existing_metadata ->> 'quality' IS DISTINCT FROM p_quality");

    const conflict = rpc.indexOf("operation_id_conflict");
    const upsert = rpc.indexOf("ON CONFLICT (scope) DO UPDATE");
    expect(conflict).toBeGreaterThan(-1);
    expect(upsert).toBeGreaterThan(conflict);
  });

  it("grava versao nova e audita na mesma transacao com acao/target proprios", () => {
    expect(rpc).toContain("config_version_id = gen_random_uuid()");
    expect(rpc).toContain("RETURNING config_version_id INTO v_config_version_id");
    expect(rpc).toContain("'nine_sixteen_expansion_model_config_update'");
    expect(rpc).toContain("'nine_sixteen_expansion_model_config'");
    expect(rpc).toContain("v_config_version_id,");
    expect(rpc).toContain("p_operation_id,");
  });
});

describe("auditoria — uniao completa preservada", () => {
  it("cita a autoridade da uniao vigente", () => {
    expect(RAW).toContain("20261024141452");
  });

  it("admin_audit_log_action_check contem todos os 27 valores e o novo valor ao final", () => {
    const block = textBetween(
      SQL,
      "ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (",
      "));",
    );
    const values = [...block.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);

    for (const action of AUDIT_ACTIONS) {
      expect(values, `acao ausente: ${action}`).toContain(action);
    }
    expect(values).toContain("nine_sixteen_expansion_model_config_update");
    expect(values).toHaveLength(AUDIT_ACTIONS.length + 1);
    expect(values[values.length - 1]).toBe("nine_sixteen_expansion_model_config_update");
  });

  it("admin_audit_log_target_type_check contem todos os 10 valores e o novo valor ao final", () => {
    const block = textBetween(
      SQL,
      "ADD CONSTRAINT admin_audit_log_target_type_check CHECK (",
      "));",
    );
    const values = [...block.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);

    for (const targetType of AUDIT_TARGET_TYPES) {
      expect(values, `target_type ausente: ${targetType}`).toContain(targetType);
    }
    expect(values).toContain("nine_sixteen_expansion_model_config");
    expect(values).toHaveLength(AUDIT_TARGET_TYPES.length + 1);
    expect(values[values.length - 1]).toBe("nine_sixteen_expansion_model_config");
  });
});

describe("congelamento da selecao na operacao", () => {
  it("adiciona as quatro colunas nullable sem backfill", () => {
    for (const column of [
      "expansion_model TEXT",
      "expansion_quality TEXT",
      "expansion_config_version_id UUID",
      "expansion_selection_origin TEXT",
    ]) {
      expect(SQL).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(SQL).not.toMatch(/expansion_model TEXT NOT NULL/);
  });

  it("relaxa contract_version para 1|2 e adiciona o CHECK cruzado", () => {
    expect(SQL).toContain("DROP CONSTRAINT IF EXISTS ck_p916_contract_version");
    expect(SQL).toContain("CHECK (contract_version IN (1, 2))");
    expect(SQL).toContain("ck_p916_expansion_selection CHECK");
    expect(SQL).toContain("contract_version = 1");
    expect(SQL).toContain("contract_version = 2");
    expect(SQL).toContain("expansion_config_version_id IS NOT NULL");
    expect(SQL).toContain("expansion_selection_origin = 'configured'");
    expect(SQL).toContain("expansion_model IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst')");
  });

  it("service_role permanece apenas com SELECT na tabela de operacoes", () => {
    expect(SQL).toContain(
      "REVOKE ALL ON TABLE public.product_9_16_two_stage_operations FROM service_role",
    );
    expect(SQL).toContain(
      "GRANT SELECT ON TABLE public.product_9_16_two_stage_operations TO service_role",
    );
    expect(SQL).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE)[^;]*product_9_16_two_stage_operations/i,
    );
    expect(SQL).not.toMatch(
      /GRANT[^;]*ON TABLE public\.product_9_16_two_stage_operations[^;]*(INSERT|UPDATE|DELETE)/i,
    );
  });

  it("instala trigger BEFORE UPDATE imutavel para os cinco campos", () => {
    expect(SQL).toContain(
      "CREATE OR REPLACE FUNCTION public.trg_p916_expansion_selection_immutable_fn()",
    );
    expect(SQL).toContain(
      "CREATE TRIGGER trg_p916_expansion_selection_immutable BEFORE UPDATE ON public.product_9_16_two_stage_operations",
    );
    expect(SQL).toContain("RAISE EXCEPTION 'product_9_16_expansion_selection_immutable'");
    for (const field of [
      "NEW.expansion_model IS DISTINCT FROM OLD.expansion_model",
      "NEW.expansion_quality IS DISTINCT FROM OLD.expansion_quality",
      "NEW.expansion_config_version_id IS DISTINCT FROM OLD.expansion_config_version_id",
      "NEW.expansion_selection_origin IS DISTINCT FROM OLD.expansion_selection_origin",
      "NEW.contract_version IS DISTINCT FROM OLD.contract_version",
    ]) {
      expect(SQL).toContain(field);
    }
  });
});

describe("product_9_16_open_operation_v2 — abertura atomica com selecao", () => {
  const v2 = functionText("product_9_16_open_operation_v2");

  it("cria a v2 com exatamente seis parametros e NAO toca a v1", () => {
    expect(v2).not.toBe("");
    expect(v2).toContain("p_store_id UUID");
    expect(v2).toContain("p_campaign_id UUID");
    expect(v2).toContain("p_operation_id UUID");
    expect(v2).toContain("p_expansion_model TEXT");
    expect(v2).toContain("p_expansion_quality TEXT");
    expect(v2).toContain("p_expansion_config_version_id UUID");
    expect(SQL).not.toContain("CREATE OR REPLACE FUNCTION public.product_9_16_open_operation(");
    expect(v2).not.toContain("p_actor_id");
  });

  it("rejeita selecao ausente/invalida antes de escrever", () => {
    expect(v2).toContain("RAISE EXCEPTION 'invalid_expansion_model'");
    expect(v2).toContain("RAISE EXCEPTION 'invalid_expansion_quality'");
    expect(v2).toContain("RAISE EXCEPTION 'missing_expansion_config_version_id'");

    const missingVersion = v2.indexOf("missing_expansion_config_version_id");
    const insertOp = v2.indexOf("INSERT INTO public.product_9_16_two_stage_operations");
    expect(missingVersion).toBeGreaterThan(-1);
    expect(insertOp).toBeGreaterThan(missingVersion);
  });

  it("preserva a paridade de leitura/trava da v1 e a reserva existente", () => {
    expect(v2).toContain("FROM public.product_1_1_campaign_credit_operations");
    expect(v2).toContain("FOR UPDATE");
    expect(v2).toContain("FROM public.product_9_16_two_stage_steps");
    expect(v2).toContain("FROM public.ai_model_catalog");
    expect(v2).toContain("public.product_1_1_reserve_credit_operation(");
    expect(v2).not.toContain("public.admin_users");

    const lock = v2.indexOf("FOR UPDATE");
    const insertOp = v2.indexOf("INSERT INTO public.product_9_16_two_stage_operations");
    expect(lock).toBeGreaterThan(-1);
    expect(insertOp).toBeGreaterThan(lock);
  });

  it("grava contract_version 2 e as quatro colunas no MESMO INSERT", () => {
    const insert = textBetween(
      v2,
      "INSERT INTO public.product_9_16_two_stage_operations (",
      ";",
    );

    expect(insert).toContain("contract_version");
    expect(insert).toContain("expansion_model");
    expect(insert).toContain("expansion_quality");
    expect(insert).toContain("expansion_config_version_id");
    expect(insert).toContain("expansion_selection_origin");
    expect(insert).toContain("'9_16_two_stage', 2");
    expect(insert).toContain("'configured'");
    expect(insert).toContain("ON CONFLICT (campaign_id, operation_id) DO NOTHING");
  });

  it("recusa selecao divergente e linha v1/origem divergente sem sobrescrever", () => {
    expect(v2).toContain("'operation_config_conflict'");
    expect(v2).toContain("'operation_origin_conflict'");
    expect(v2).toContain("v_op.expansion_model IS DISTINCT FROM p_expansion_model");
    expect(v2).toContain("v_op.expansion_quality IS DISTINCT FROM p_expansion_quality");
    expect(v2).toContain(
      "v_op.expansion_config_version_id IS DISTINCT FROM p_expansion_config_version_id",
    );
    expect(v2).toContain("v_op.contract_version IS DISTINCT FROM 2");
    expect(v2).not.toMatch(
      /UPDATE public\.product_9_16_two_stage_operations\s+SET\s+expansion_model/i,
    );
  });

  it("cria exatamente os dois steps base/expansion em pending, apos a operacao e antes da reserva", () => {
    const occurrences = SQL.match(/INSERT INTO public\.product_9_16_two_stage_steps/g) ?? [];
    expect(occurrences).toHaveLength(1);

    const stepsInsert = textBetween(
      SQL,
      "INSERT INTO public.product_9_16_two_stage_steps (",
      ";",
    );
    expect(stepsInsert).toContain("(p_campaign_id, p_operation_id, 'base', 'pending')");
    expect(stepsInsert).toContain("(p_campaign_id, p_operation_id, 'expansion', 'pending')");
    expect(stepsInsert).toContain(
      "ON CONFLICT (campaign_id, operation_id, stage) DO NOTHING",
    );
    expect(stepsInsert).not.toContain("DO UPDATE");
    expect(stepsInsert).not.toContain("'in_progress'");
    expect(stepsInsert).not.toContain("'done'");

    const operationInsert = v2.indexOf(
      "INSERT INTO public.product_9_16_two_stage_operations",
    );
    const stepsIndex = v2.indexOf("INSERT INTO public.product_9_16_two_stage_steps");
    const reserve = v2.indexOf("public.product_1_1_reserve_credit_operation(");
    expect(operationInsert).toBeGreaterThan(-1);
    expect(stepsIndex).toBeGreaterThan(operationInsert);
    expect(reserve).toBeGreaterThan(stepsIndex);
  });

  it("devolve o envelope explicito de doze chaves em todo caminho de sucesso", () => {
    const successObjects = jsonbBuildObjects(v2).filter((block) =>
      block.includes("'success', true"),
    );
    expect(successObjects.length).toBeGreaterThanOrEqual(3);

    const expectedKeys = [
      "success",
      "idempotent",
      "status",
      "campaign_id",
      "operation_id",
      "origin",
      "steps",
      "contract_version",
      "expansion_model",
      "expansion_quality",
      "expansion_config_version_id",
      "expansion_selection_origin",
    ];

    for (const block of successObjects) {
      for (const key of expectedKeys) {
        expect(block, `chave ausente no envelope: ${key}`).toContain(`'${key}'`);
      }
      expect(block).toContain("'contract_version', 2");
      expect(block).toContain("'expansion_model', v_op.expansion_model");
      expect(block).toContain("'expansion_quality', v_op.expansion_quality");
      expect(block).toContain(
        "'expansion_config_version_id', v_op.expansion_config_version_id",
      );
      expect(block).toContain(
        "'expansion_selection_origin', v_op.expansion_selection_origin",
      );
    }
  });

  it("caminhos de falha devolvem apenas success/reason, sem chaves de selecao", () => {
    const failureObjects = jsonbBuildObjects(v2).filter((block) =>
      block.includes("'success', false"),
    );
    expect(failureObjects.length).toBeGreaterThan(0);

    for (const block of failureObjects) {
      expect(block).toContain("'reason'");
      expect(block).not.toContain("'expansion_model'");
      expect(block).not.toContain("'contract_version'");
      expect(block).not.toContain("'steps'");
    }
  });
});

describe("superficie de escrita e rollback", () => {
  it("escreve somente nos quatro alvos permitidos", () => {
    const targets = writeTargets();
    expect(targets.length).toBeGreaterThan(0);

    // O extrator precisa enxergar cada tipo de escrita usado no arquivo.
    expect(
      targets.some(
        (target) =>
          target.kind === "CREATE TABLE" &&
          target.table === "public.nine_sixteen_expansion_model_config",
      ),
    ).toBe(true);
    expect(
      targets.some(
        (target) =>
          target.kind === "ALTER TABLE" && target.table === "public.admin_audit_log",
      ),
    ).toBe(true);
    expect(
      targets.some(
        (target) =>
          target.kind === "GRANT" &&
          target.table === "public.nine_sixteen_expansion_model_config",
      ),
    ).toBe(true);
    expect(
      targets.some(
        (target) =>
          target.kind === "UPDATE" &&
          target.table === "public.product_9_16_two_stage_operations",
      ),
    ).toBe(true);

    for (const target of targets) {
      expect(
        ALLOWED_WRITE_TARGETS.has(target.table),
        `escrita nao permitida (${target.kind}) em ${target.table}`,
      ).toBe(true);
    }

    const written = new Set(targets.map((target) => target.table));
    expect(written).toEqual(ALLOWED_WRITE_TARGETS);
  });

  it("o extrator de escrita realmente detecta alvos proibidos", () => {
    const synthetic = writeTargets(
      "ALTER TABLE public.campaigns ADD COLUMN x TEXT; INSERT INTO public.ai_model_selection (a) VALUES (1);",
    );

    expect(synthetic).toEqual([
      { kind: "ALTER TABLE", table: "public.campaigns" },
      { kind: "INSERT INTO", table: "public.ai_model_selection" },
    ]);
  });

  it("nao escreve nas tabelas do 1:1, base quadrada, campanhas ou credito", () => {
    const forbidden = [
      "public.campaigns",
      "public.image_model_pair_config",
      "public.ai_model_selection",
      "public.image_generation_config_snapshots",
      "public.product_1_1_campaign_credit_operations",
      "public.credit_transactions",
      "public.stores",
      "auth.users",
    ];

    for (const table of forbidden) {
      expect(
        writeTargets().some((target) => target.table === table),
        `escrita indevida em ${table}`,
      ).toBe(false);
    }
  });

  it("documenta rollback operacional nao destrutivo sem remocao estrutural", () => {
    expect(RAW).toContain("ROLLBACK OPERACIONAL");
    expect(RAW).toContain("nao destrutivo");
    expect(RAW).toContain("contract_version = 2");
    expect(RAW).not.toMatch(/DROP\s+TABLE/i);
    expect(RAW).not.toMatch(/DROP\s+COLUMN/i);
    expect(RAW).not.toMatch(/TRUNCATE/i);
    expect(RAW).not.toMatch(
      /DELETE\s+FROM\s+public\.(nine_sixteen_expansion_model_config|product_9_16_two_stage_operations|product_9_16_two_stage_steps|admin_audit_log)/i,
    );
  });
});
