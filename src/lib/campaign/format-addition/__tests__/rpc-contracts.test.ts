// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contrato ESTÁTICO das RPCs da F62/62-02. Autoradas, NÃO aplicadas.
 *
 * Não há conexão, execução de SQL, Docker, Supabase CLI, homolog, Storage ou
 * provider. Locks reais, deadlocks, isolamento e concorrência só podem ser
 * provados no Gate de banco do 62-08, com autorização separada.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const matches = readdirSync(MIGRATIONS_DIR).filter((name) =>
  name.endsWith("_campaign_format_addition.sql"),
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

function functionText(name: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}(`;
  const start = SQL.indexOf(marker);
  if (start < 0) return "";
  const end = SQL.indexOf("$$;", start);
  return end < 0 ? SQL.slice(start) : SQL.slice(start, end + 3);
}

function occurrences(text: string, token: string): number {
  return (text.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? [])
    .length;
}

const OPEN = functionText("campaign_format_add_open");
const DELIVER = functionText("campaign_format_add_deliver");
const REFUND = functionText("campaign_format_add_refund");

describe("F62-02 RPC grupo 1 — assinaturas, SECURITY DEFINER e grants", () => {
  it("as três RPCs existem com assinatura contratada", () => {
    expect(SQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.campaign_format_add_open\( p_store_id UUID, p_campaign_id UUID, p_operation_id UUID, p_request_id UUID, p_source_origin TEXT, p_source_operation_id UUID, p_source_registration_operation_id UUID, p_source_artifact_id UUID, p_source_checksum_sha256 TEXT, p_selection JSONB, p_frozen_economics JSONB \)\s+RETURNS JSONB/,
    );
    expect(SQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.campaign_format_add_deliver\( p_store_id UUID, p_campaign_id UUID, p_operation_id UUID, p_publication_token UUID \)\s+RETURNS JSONB/,
    );
    expect(SQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.campaign_format_add_refund\( p_store_id UUID, p_campaign_id UUID, p_operation_id UUID, p_observed_epoch INTEGER, p_reason TEXT \)\s+RETURNS JSONB/,
    );
  });

  it("todas são SECURITY DEFINER com search_path vazio", () => {
    for (const [name, body] of [
      ["campaign_format_add_open", OPEN],
      ["campaign_format_add_deliver", DELIVER],
      ["campaign_format_add_refund", REFUND],
    ] as const) {
      expect(body, `${name}: corpo ausente`).not.toBe("");
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path = ''");
    }
  });

  it("EXECUTE é revogado de PUBLIC/anon/authenticated e só de service_role", () => {
    const grants = [
      "public.campaign_format_add_open(UUID, UUID, UUID, UUID, TEXT, UUID, UUID, UUID, TEXT, JSONB, JSONB)",
      "public.campaign_format_add_deliver(UUID, UUID, UUID, UUID)",
      "public.campaign_format_add_refund(UUID, UUID, UUID, INTEGER, TEXT)",
    ];
    for (const grant of grants) {
      expect(SQL).toContain(
        `REVOKE ALL ON FUNCTION ${grant} FROM PUBLIC, anon, authenticated`,
      );
      expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION ${grant} TO service_role`);
    }
  });
});

describe("F62-02 RPC grupo 2 — abertura/replay atômica", () => {
  it("serializa por campanha/alvo e trava a campanha", () => {
    expect(OPEN).toContain("pg_advisory_xact_lock");
    expect(OPEN).toContain("hashtext('cfa_open:' || p_campaign_id::text || ':9:16')");
    expect(OPEN).toMatch(/FROM public\.campaigns c[^;]*FOR UPDATE/);
  });

  it("rejeita origem/fonte/contrato inválidos e formato não quadrado", () => {
    for (const token of [
      "source_origin_invalid",
      "source_operation_required",
      "legacy_source_operation_forbidden",
      "source_checksum_invalid",
      "campaign_not_found",
      "campaign_not_ready",
      "format_not_square",
      "source_artifact_missing",
      "source_artifact_invalid",
      "primary_operation_missing",
      "primary_operation_not_delivered",
      "source_identity_conflict",
    ]) {
      expect(OPEN, `motivo ausente: ${token}`).toContain(token);
    }
  });

  it("valida a ponte square_original 1024 JPEG com checksum e origem de reuso", () => {
    for (const token of [
      "square_original",
      "delivered_campaign_reuse",
      "1024",
      "image/jpeg",
      "checksum_sha256",
      "source_campaign_id",
      "source_registration_operation_id",
    ]) {
      expect(OPEN, `validação ausente: ${token}`).toContain(token);
    }
  });

  it("legado não exige operação financeira original", () => {
    expect(OPEN).toContain("legacy_source_operation_forbidden");
    expect(OPEN).toContain("source_origin = 'legacy_campaign'");
    expect(OPEN).not.toMatch(
      /source_origin = 'legacy_campaign'[\s\S]{0,2000}product_1_1_campaign_credit_operations[\s\S]{0,400}source_operation_id/,
    );
  });

  it("replay por request_id e adição ativa retornam estado sem cobrar", () => {
    expect(OPEN).toContain("request_id = p_request_id");
    expect(OPEN).toContain("'idempotent', true");
    expect(OPEN).toContain("status IN ('open', 'delivered')");
    expect(OPEN).toContain("'state', v_active.status");
    expect(OPEN).toContain("'state', v_link.status");
  });

  it("abre pelo motor v2 e reutiliza a base sem gerar imagem", () => {
    expect(OPEN).toContain("public.product_9_16_open_operation_v2(");
    expect(OPEN).toContain("stage = 'base'");
    expect(OPEN).toContain("status = 'pending'");
    expect(OPEN).toContain("artifact_evidence_ref = p_source_artifact_id::text");
    expect(OPEN).toContain("format_addition_base_step_conflict");
  });

  it("reserva exatamente 1 crédito via v2 e rejeita idempotência inesperada", () => {
    expect(OPEN).toContain("'credits', 1");
    expect(OPEN).toContain("operation_origin_conflict");
    expect(OPEN).toContain("(v_open_result->>'idempotent') = 'true'");
    expect(OPEN).not.toContain("public.product_1_1_reserve_credit_operation(");
    expect(OPEN).not.toContain("INSERT INTO public.product_9_16_two_stage_steps");
    expect(OPEN).not.toMatch(/credit_balances|available_credit|available_balance/i);
  });

  it("insere exatamente um vínculo na mesma função", () => {
    expect(occurrences(OPEN, "INSERT INTO public.campaign_format_additions")).toBe(1);
    expect(OPEN).toContain("'open', p_request_id, p_selection, p_frozen_economics");
  });

  it("não chama o orquestrador/fluxo conjunto", () => {
    for (const forbidden of [
      "product_two_format",
      "product_two_format_open_delivery",
      "product_two_format_deliver_format",
    ]) {
      expect(SQL).not.toContain(forbidden);
    }
  });
});

describe("F62-02 RPC grupo 3 — entrega restrita à adição", () => {
  it("exige token e trava campanha, vínculo e crédito", () => {
    expect(DELIVER).toContain("missing_publication_token");
    expect(DELIVER).toMatch(/FROM public\.campaigns c[^;]*FOR UPDATE/);
    expect(DELIVER).toMatch(/FROM public\.campaign_format_additions[\s\S]*FOR UPDATE/);
    expect(DELIVER).toMatch(
      /FROM public\.product_1_1_campaign_credit_operations[\s\S]*FOR UPDATE/,
    );
  });

  it("valida o vertical canônico 1080×1920 JPEG da operação", () => {
    for (const token of [
      "role = 'vertical'",
      "vertical_artifact_missing",
      "vertical_artifact_invalid",
      "1080",
      "1920",
      "image/jpeg",
    ]) {
      expect(DELIVER, `validação ausente: ${token}`).toContain(token);
    }
  });

  it("usa mark + deliver existentes uma vez cada", () => {
    expect(
      occurrences(DELIVER, "public.product_1_1_mark_campaign_credit_art_uploaded("),
    ).toBe(1);
    expect(
      occurrences(DELIVER, "public.product_1_1_deliver_campaign_credit_operation("),
    ).toBe(1);
  });

  it("marca o vínculo delivered e não projeta a campanha", () => {
    expect(DELIVER).toContain("status = 'delivered'");
    expect(DELIVER).toContain("delivery_identity_conflict");
    expect(DELIVER).toContain("stale_publication");
    expect(DELIVER).not.toMatch(/UPDATE\s+public\.campaigns/i);
    expect(DELIVER).not.toContain("storage_path");
    expect(DELIVER).not.toContain("product_two_format");
  });
});

describe("F62-02 RPC grupo 4 — estorno restrito à adição", () => {
  it("exige motivo, epoch, vínculo e crédito travados", () => {
    expect(REFUND).toContain("missing_observed_epoch");
    expect(REFUND).toContain("missing_reason");
    expect(REFUND).toMatch(/FROM public\.campaigns c[^;]*FOR UPDATE/);
    expect(REFUND).toMatch(/FROM public\.campaign_format_additions[\s\S]*FOR UPDATE/);
    expect(REFUND).toMatch(
      /FROM public\.product_1_1_campaign_credit_operations[\s\S]*FOR UPDATE/,
    );
  });

  it("recusa entrega e exige ausência/falha/epoch/claim", () => {
    for (const token of [
      "delivered_not_refundable",
      "vertical_artifact_present",
      "operation_unknown",
      "finality_not_recorded",
      "operation_in_progress",
      "evidence_stale",
    ]) {
      expect(REFUND, `guarda ausente: ${token}`).toContain(token);
    }
    expect(REFUND).toContain("role = 'vertical'");
    expect(REFUND).toContain("outcome = 'failed'");
    expect(REFUND).toContain("product_generation_active_claims_v");
  });

  it("usa somente o fechamento existente e nunca o estorno direto", () => {
    expect(
      occurrences(REFUND, "public.product_1_1_close_failed_operation("),
    ).toBe(1);
    expect(REFUND).not.toContain("public.product_1_1_refund_campaign_credit_operation(");
    expect(REFUND).not.toContain("product_two_format");
  });

  it("marca o vínculo refunded e não projeta a campanha", () => {
    expect(REFUND).toContain("status = 'refunded'");
    expect(REFUND).not.toMatch(/UPDATE\s+public\.campaigns/i);
    expect(REFUND).not.toContain("storage_path");
  });
});

describe("F62-02 RPC grupo 5 — ordem de locks e limites", () => {
  function campaignLockIndex(body: string): number {
    return body.search(/FROM public\.campaigns[^;]*FOR UPDATE/);
  }

  it("campanha é travada antes de vínculo/crédito/artefato nas três RPCs", () => {
    for (const [name, body, tables] of [
      [
        "campaign_format_add_open",
        OPEN,
        [
          "public.campaign_format_additions",
          "public.product_1_1_campaign_credit_operations",
          "public.campaign_composition_artifacts",
        ],
      ],
      [
        "campaign_format_add_deliver",
        DELIVER,
        [
          "public.campaign_format_additions",
          "public.product_1_1_campaign_credit_operations",
          "public.campaign_composition_artifacts",
        ],
      ],
      [
        "campaign_format_add_refund",
        REFUND,
        [
          "public.campaign_format_additions",
          "public.product_1_1_campaign_credit_operations",
          "public.campaign_composition_artifacts",
        ],
      ],
    ] as const) {
      const lock = campaignLockIndex(body);
      expect(lock, `${name}: lock da campanha ausente`).toBeGreaterThan(-1);
      for (const table of tables) {
        const index = body.indexOf(`FROM ${table}`);
        if (index >= 0) {
          expect(index, `${name}: ${table} antes do lock da campanha`).toBeGreaterThan(
            lock,
          );
        }
      }
    }
  });

  it("a abertura serializa antes de abrir a operação no motor", () => {
    const advisory = OPEN.indexOf("pg_advisory_xact_lock");
    const openV2 = OPEN.indexOf("public.product_9_16_open_operation_v2(");
    expect(advisory).toBeGreaterThan(-1);
    expect(openV2).toBeGreaterThan(advisory);
  });

  it("não escreve em tabelas financeiras/ledger diretamente", () => {
    for (const forbidden of [
      "INSERT INTO public.credit_transactions",
      "UPDATE public.credit_transactions",
      "INSERT INTO public.credit_balances",
      "UPDATE public.credit_balances",
      "INSERT INTO public.product_1_1_campaign_credit_operations",
      "UPDATE public.product_1_1_campaign_credit_operations",
    ]) {
      expect(SQL).not.toContain(forbidden);
    }
  });
});

describe("F62-02 RPC grupo 6 — suíte offline sem acesso a banco", () => {
  it("não importa cliente de banco nem executa processos", () => {
    const selfSource = readFileSync(new URL(import.meta.url), "utf8");
    const quote = String.fromCharCode(34);
    const banned = [
      `from ${quote}p${quote}`,
      ["@sup", "abase"].join(""),
      ["child_", "process"].join(""),
      ["exec", "Sync"].join(""),
    ];
    for (const token of banned) {
      expect(selfSource).not.toContain(token);
    }
    expect(selfSource).toContain('from "node:fs"');
    expect(selfSource).toContain('from "vitest"');
  });
});
