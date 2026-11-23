// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contrato ESTÁTICO do filtro da operação primária (F62/62-02).
 * A migration é autorada e NÃO aplicada. Nenhuma conexão de banco é feita.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const matches = readdirSync(MIGRATIONS_DIR).filter((name) =>
  name.endsWith("_campaign_format_addition.sql"),
);
const FILE_NAME = matches.length === 1 ? matches[0] : "";
const RAW = FILE_NAME
  ? readFileSync(path.join(MIGRATIONS_DIR, FILE_NAME), "utf8")
  : "";

function normalize(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

const SQL = normalize(RAW);

function functionText(name: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}(`;
  const start = SQL.indexOf(marker);
  if (start < 0) return "";
  const end = SQL.indexOf("$$;", start);
  return end < 0 ? SQL.slice(start) : SQL.slice(start, end + 3);
}

const FILTER = functionText("product_1_1_get_campaign_operation_by_campaign");

describe("F62-02 filtro da operação primária", () => {
  it("redefine a RPC com a mesma identidade de leitura", () => {
    expect(SQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.product_1_1_get_campaign_operation_by_campaign\( p_campaign_id UUID \)\s+RETURNS JSONB/,
    );
    expect(FILTER).toContain("LANGUAGE plpgsql");
    expect(FILTER).toContain("STABLE");
    expect(FILTER).toContain("SECURITY DEFINER");
    expect(FILTER).toContain("SET search_path = ''");
  });

  it("exclui operações presentes em campaign_format_additions", () => {
    expect(FILTER).toContain("NOT EXISTS");
    expect(FILTER).toContain("FROM public.campaign_format_additions a");
    expect(FILTER).toContain("a.campaign_id = c.campaign_id");
    expect(FILTER).toContain("a.operation_id = c.operation_id");
  });

  it("mantém a busca da operação primária mais recente", () => {
    expect(FILTER).toContain("FROM public.product_1_1_campaign_credit_operations c");
    expect(FILTER).toContain("WHERE c.campaign_id = p_campaign_id");
    expect(FILTER).toContain("ORDER BY c.created_at DESC");
    expect(FILTER).toContain("LIMIT 1");
    expect(FILTER).not.toContain("JOIN public.campaign_format_additions");
  });

  it("preserva o envelope histórico de leitura", () => {
    for (const token of [
      "'success'",
      "'status'",
      "'campaign_id'",
      "'operation_id'",
      "'amount'",
      "'credit_tx_id'",
      "'refund_tx_id'",
      "'consumed_definitive'",
      "'terminal'",
      "'unknown'",
      "'outcome'",
      "'support_reference'",
    ]) {
      expect(FILTER, `campo ausente: ${token}`).toContain(token);
    }
  });

  it("mantém grants e não concede a anon/authenticated", () => {
    expect(SQL).toContain(
      "REVOKE ALL ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID) FROM PUBLIC, anon, authenticated",
    );
    expect(SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.product_1_1_get_campaign_operation_by_campaign(UUID) TO service_role",
    );
  });
});
