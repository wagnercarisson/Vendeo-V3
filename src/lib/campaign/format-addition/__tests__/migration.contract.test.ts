// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contrato ESTÁTICO da migration F62/62-02 (autorada e NÃO aplicada).
 *
 * Limitação explícita: testes de texto não provam atomicidade, locks,
 * isolamento, deadlock, RLS efetiva nem concorrência no PostgreSQL. Essas
 * provas pertencem ao Gate de banco do 62-08, com autorização separada.
 * Este arquivo apenas lê o SQL como texto; não conecta em banco, não executa
 * `psql`, Docker, Supabase CLI, Storage ou provider.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const MIGRATION_SUFFIX = "_campaign_format_addition.sql";
const MIGRATION_PATTERN = /^\d{14}_campaign_format_addition\.sql$/;

const matches = readdirSync(MIGRATIONS_DIR).filter((name) =>
  name.endsWith(MIGRATION_SUFFIX),
);
const FILE_NAME = matches.length === 1 ? matches[0] : "";
const RAW = FILE_NAME
  ? readFileSync(path.join(MIGRATIONS_DIR, FILE_NAME), "utf8")
  : "";

function stripLineComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function normalize(sql: string): string {
  return stripLineComments(sql).replace(/\s+/g, " ").trim();
}

const SQL = normalize(RAW);

function textBetween(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker);
  if (start < 0) return "";
  const end = text.indexOf(endMarker, start);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

describe("F62-02 grupo 1 — arquivo autorado, forward-only e NÃO aplicado", () => {
  it("existe exatamente uma migration com timestamp UTC de 14 dígitos", () => {
    expect(matches).toHaveLength(1);
    expect(FILE_NAME).toMatch(MIGRATION_PATTERN);
  });

  it("o prefixo de 14 dígitos é único no diretório de migrations", () => {
    const prefix = FILE_NAME.slice(0, 14);
    const collisions = readdirSync(MIGRATIONS_DIR).filter((file) =>
      file.startsWith(prefix),
    );
    expect(collisions).toEqual([FILE_NAME]);
  });

  it("declara autoria local, ausência de aplicação e REVERT", () => {
    expect(RAW).toContain("LOCAL-ONLY");
    expect(RAW).toMatch(/N[ÃA]O APLICADA/);
    expect(RAW).toContain("-- REVERT");
  });

  it("não contém comandos de aplicação remota nem mutação destrutiva ativa", () => {
    for (const forbidden of [
      /supabase\s+db\s+push/i,
      /supabase\s+db\s+reset/i,
      /supabase\s+link/i,
      /migration\s+up/i,
      /\bTRUNCATE\b/i,
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
    ]) {
      expect(SQL, `comando proibido: ${forbidden}`).not.toMatch(forbidden);
    }
  });
});

describe("F62-02 grupo 2 — tabela de vínculo durável", () => {
  const table = textBetween(
    SQL,
    "CREATE TABLE IF NOT EXISTS public.campaign_format_additions (",
    ");",
  );

  it("declara todas as colunas contratadas", () => {
    expect(table).not.toBe("");
    for (const column of [
      "id UUID PRIMARY KEY",
      "store_id UUID NOT NULL",
      "campaign_id UUID NOT NULL",
      "operation_id UUID NOT NULL",
      "source_origin TEXT NOT NULL",
      "source_operation_id UUID NULL",
      "source_registration_operation_id UUID NOT NULL",
      "source_artifact_id UUID NOT NULL",
      "source_checksum_sha256 TEXT NOT NULL",
      "source_format TEXT NOT NULL",
      "target_format TEXT NOT NULL",
      "status TEXT NOT NULL",
      "request_id UUID NOT NULL",
      "selection JSONB NOT NULL",
      "frozen_economics JSONB NOT NULL",
      "created_at TIMESTAMPTZ NOT NULL",
      "updated_at TIMESTAMPTZ NOT NULL",
    ]) {
      expect(table, `coluna ausente: ${column}`).toContain(column);
    }
  });

  it("tem identidade composta, request único e formatos 1:1 → 9:16", () => {
    expect(table).toContain("uq_cfa_identity UNIQUE (campaign_id, operation_id)");
    expect(table).toContain("uq_cfa_request UNIQUE (campaign_id, request_id)");
    expect(table).toContain("ck_cfa_source_format CHECK (source_format = '1:1')");
    expect(table).toContain("ck_cfa_target_format CHECK (target_format = '9:16')");
  });

  it("fecha origem, operação-fonte e transições de status", () => {
    expect(table).toContain(
      "ck_cfa_source_origin CHECK (source_origin IN ('new_flow_1_1', 'legacy_campaign'))",
    );
    expect(table).toContain("source_origin = 'new_flow_1_1' AND source_operation_id IS NOT NULL");
    expect(table).toContain("source_origin = 'legacy_campaign' AND source_operation_id IS NULL");
    expect(table).toContain(
      "ck_cfa_status CHECK (status IN ('open', 'delivered', 'refunded'))",
    );
    expect(table).toContain("ck_cfa_checksum CHECK (source_checksum_sha256 ~ '^[0-9a-f]{64}$')");
    expect(table).toContain("ck_cfa_selection_object CHECK (jsonb_typeof(selection) = 'object')");
    expect(table).toContain(
      "ck_cfa_frozen_economics_object CHECK (jsonb_typeof(frozen_economics) = 'object')",
    );
  });

  it("liga campanha/loja, controle, crédito da adição, operação-fonte e artefato", () => {
    for (const constraint of [
      "fk_cfa_campaign_store",
      "fk_cfa_control_operation",
      "fk_cfa_credit_operation",
      "fk_cfa_source_operation",
      "fk_cfa_source_artifact",
    ]) {
      expect(table).toContain(constraint);
    }
    expect(table).toContain(
      "REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id)",
    );
    expect(table).toContain(
      "REFERENCES public.product_1_1_campaign_credit_operations (campaign_id, operation_id)",
    );
    expect(table).toContain(
      "REFERENCES public.campaign_composition_artifacts (id)",
    );
  });

  it("não duplica estado financeiro terminal na tabela", () => {
    for (const forbidden of [
      "amount",
      "credit_tx_id",
      "refund_tx_id",
      "publication_state",
      "publication_token",
    ]) {
      expect(table).not.toContain(forbidden);
    }
  });
});

describe("F62-02 grupo 3 — índices, guarda e RLS", () => {
  it("permite no máximo uma adição open/delivered por campanha/alvo", () => {
    expect(SQL).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_cfa_active_per_campaign_target");
    expect(SQL).toContain(
      "ON public.campaign_format_additions (campaign_id, target_format) WHERE status IN ('open', 'delivered')",
    );
  });

  it("bloqueia alteração de identidade e saída de terminal", () => {
    expect(SQL).toContain("CREATE OR REPLACE FUNCTION public.trg_cfa_guard_fn()");
    expect(SQL).toContain("campaign_format_addition_identity_immutable");
    expect(SQL).toContain("campaign_format_addition_terminal");
    expect(SQL).toContain("BEFORE UPDATE ON public.campaign_format_additions");
  });

  it("habilita RLS, policy apenas SELECT e service_role sem escrita", () => {
    expect(SQL).toContain(
      "ALTER TABLE public.campaign_format_additions ENABLE ROW LEVEL SECURITY",
    );
    expect(SQL).toContain(
      'CREATE POLICY "Service role reads campaign format additions"',
    );
    expect(SQL).toMatch(
      /CREATE POLICY "Service role reads campaign format additions" ON public\.campaign_format_additions FOR SELECT TO service_role/i,
    );
    expect(SQL).not.toMatch(
      /CREATE POLICY "Service role reads campaign format additions"[^;]*FOR ALL/i,
    );
    expect(SQL).toContain(
      "REVOKE ALL ON TABLE public.campaign_format_additions FROM PUBLIC, anon, authenticated",
    );
    expect(SQL).toContain(
      "REVOKE ALL ON TABLE public.campaign_format_additions FROM service_role",
    );
    expect(SQL).toContain(
      "GRANT SELECT ON TABLE public.campaign_format_additions TO service_role",
    );
    expect(SQL).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE|TRUNCATE)[^;]*public\.campaign_format_additions/i,
    );
  });
});

describe("F62-02 grupo 4 — ponte de proveniência reutilizada", () => {
  it("amplia ck_cca_origin sem remover origens existentes", () => {
    expect(SQL).toContain(
      "origin IN ( 'provider_generation', 'deterministic_preparation', 'ai_expansion', 'delivered_campaign_reuse' )",
    );
  });

  it("restringe delivered_campaign_reuse a square_original", () => {
    expect(SQL).toContain("ck_cca_reuse_role");
    expect(SQL).toContain(
      "origin <> 'delivered_campaign_reuse' OR role = 'square_original'",
    );
  });

  it("não altera o artefato original nem apaga linhas existentes", () => {
    expect(SQL).not.toMatch(/UPDATE\s+public\.campaign_composition_artifacts/i);
    expect(SQL).not.toMatch(/DELETE\s+FROM\s+public\.campaign_composition_artifacts/i);
  });
});

describe("F62-02 grupo 5 — flag dedicada fail-closed", () => {
  it("faz seed desligado e idempotente", () => {
    expect(SQL).toContain("INSERT INTO public.feature_flags (key, enabled, description)");
    expect(SQL).toContain("'campaign_format_addition_enabled', false,");
    expect(SQL).toContain("ON CONFLICT (key) DO NOTHING");
  });

  it("documenta o rollback restrito na descrição", () => {
    expect(RAW).toContain("bloqueia somente novas adicoes");
    expect(RAW).toContain("operacoes abertas continuam consultaveis");
  });
});

describe("F62-02 grupo 6 — limites de escopo", () => {
  it("não projeta campanha, não altera storage_path e não usa o fluxo conjunto", () => {
    expect(SQL).not.toMatch(/UPDATE\s+public\.campaigns/i);
    expect(SQL).not.toContain("storage_path");
    expect(SQL).not.toContain("product_two_format");
    expect(SQL).not.toContain("projectDeliveredCampaign");
    expect(SQL).not.toContain("projectClosedCampaign");
  });
});
