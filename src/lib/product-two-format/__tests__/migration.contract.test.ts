// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato ESTÁTICO da migration F60.7 (autorada e NÃO aplicada).
 *
 * Limitação explícita: testes estáticos de texto não comprovam atomicidade,
 * isolamento, deadlock nem concorrência no PostgreSQL. Essa validação é o Gate
 * de banco futuro, posterior à Subfatia B, com autorização separada. Aqui não
 * há conexão, execução de SQL, Docker, Supabase CLI, homolog, Storage ou
 * provider: o arquivo é lido apenas como texto.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const MIGRATION_NAME_PATTERN = /^\d{14}_f60_7_two_format_foundation\.sql$/;

const matches = readdirSync(MIGRATIONS_DIR).filter((name) =>
  name.endsWith("_f60_7_two_format_foundation.sql"),
);
const FILE_NAME = matches.length === 1 ? matches[0] : "";
const RAW = FILE_NAME ? readFileSync(path.join(MIGRATIONS_DIR, FILE_NAME), "utf8") : "";

/** Remove comentários de linha (a migration não usa `--` em literais). */
function stripLineComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** Normaliza um SQL qualquer: remove comentários de linha e colapsa espaços. */
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

function functionText(name: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}(`;
  const start = SQL.indexOf(marker);
  if (start < 0) return "";
  const end = SQL.indexOf("$$;", start);
  return end < 0 ? SQL.slice(start) : SQL.slice(start, end + 3);
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

function writeTargets(): WriteTarget[] {
  const targets: WriteTarget[] = [];
  for (const { kind, pattern } of WRITE_PATTERNS) {
    for (const match of SQL.matchAll(pattern)) {
      targets.push({ kind, table: match[1].toLowerCase() });
    }
  }
  return targets;
}

const ALLOWED_WRITE_TARGETS = new Set([
  "public.product_two_format_deliveries",
  "public.campaigns",
]);

const LEGACY_COLUMNS = [
  "approval_status",
  "render_snapshot",
  "generation_metadata",
  "publication_copy_snapshot",
];

const functionBodyWithCampaignLockFirst = (
  name: string,
  specificTables: readonly string[],
): void => {
  const body = functionText(name);
  expect(body, `${name}: função ausente`).not.toBe("");

  const lock = body.search(/FROM public\.campaigns[^;]*FOR UPDATE/);
  expect(lock, `${name}: lock da campanha ausente`).toBeGreaterThan(-1);

  for (const table of specificTables) {
    const index = body.indexOf(table);
    if (index >= 0) {
      expect(index, `${name}: ${table} antes do lock da campanha`).toBeGreaterThan(lock);
    }
  }
};

describe("grupo 1 — arquivo autorado, forward-only e NÃO aplicado", () => {
  it("existe exatamente uma migration com timestamp UTC de 14 dígitos", () => {
    expect(matches).toHaveLength(1);
    expect(FILE_NAME).toMatch(MIGRATION_NAME_PATTERN);
  });

  it("o prefixo de 14 dígitos é único no diretório de migrations", () => {
    const prefix = FILE_NAME.slice(0, 14);
    const collisions = readdirSync(MIGRATIONS_DIR).filter((file) => file.startsWith(prefix));
    expect(collisions).toEqual([FILE_NAME]);
  });

  it("declara autoria local e ausência de aplicação", () => {
    expect(RAW).toContain("LOCAL-ONLY");
    expect(RAW).toContain("NAO APLICADA");
  });
});

describe("grupo 2 — tabela de vínculo com oito colunas e sem estado financeiro", () => {
  const rawColumnBlock = textBetween(
    SQL,
    "CREATE TABLE public.product_two_format_deliveries (",
    "CONSTRAINT ck_p2f_format",
  );
  const columnBlock = rawColumnBlock.slice(rawColumnBlock.indexOf("(") + 1);
  const columnDefs = columnBlock
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const expectedColumns = [
    "id UUID",
    "campaign_id UUID",
    "operation_id UUID",
    "store_id UUID",
    "format TEXT",
    "delivery_operation_id UUID",
    "artifact_role TEXT",
    "created_at TIMESTAMPTZ",
  ];

  it("tem exatamente as oito colunas contratadas", () => {
    expect(columnDefs).toHaveLength(8);
    for (const column of expectedColumns) {
      expect(
        columnDefs.some((definition) => definition.startsWith(column)),
        `coluna ausente: ${column}`,
      ).toBe(true);
    }
  });

  it("declara as constraints com os nomes exatos", () => {
    const tableBlock = textBetween(
      SQL,
      "CREATE TABLE public.product_two_format_deliveries",
      "CREATE INDEX",
    );
    for (const constraint of [
      "ck_p2f_format",
      "ck_p2f_role",
      "ck_p2f_format_role",
      "ck_p2f_identity",
      "uq_p2f_campaign_operation_format",
      "uq_p2f_delivery_operation",
    ]) {
      expect(tableBlock).toContain(constraint);
    }
  });

  it("não duplica estado financeiro na tabela", () => {
    const tableBlock = textBetween(
      SQL,
      "CREATE TABLE public.product_two_format_deliveries",
      "CREATE INDEX",
    );
    for (const forbidden of ["status", "amount", "credit_tx_id", "refund_tx_id"]) {
      expect(tableBlock).not.toContain(forbidden);
    }
  });
});

describe("grupo 3 — identidade entrega ↔ formato ↔ crédito", () => {
  it("9:16 reutiliza a identidade de controle e 1:1 exige identidade própria", () => {
    expect(SQL).toContain("format = '9:16' AND delivery_operation_id = operation_id");
    expect(SQL).toContain("format = '1:1' AND delivery_operation_id <> operation_id");
  });

  it("delivery_operation_id é único", () => {
    expect(SQL).toContain("uq_p2f_delivery_operation UNIQUE (delivery_operation_id)");
  });
});

describe("grupo 4 — FKs compostas para as autoridades existentes", () => {
  it("referencia a operação de controle com ON DELETE RESTRICT", () => {
    expect(SQL).toContain(
      "fk_p2f_control_operation FOREIGN KEY (campaign_id, operation_id) REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id) ON DELETE RESTRICT",
    );
  });

  it("referencia a operação financeira com ON DELETE RESTRICT", () => {
    expect(SQL).toContain(
      "fk_p2f_credit_operation FOREIGN KEY (campaign_id, delivery_operation_id) REFERENCES public.product_1_1_campaign_credit_operations (campaign_id, operation_id) ON DELETE RESTRICT",
    );
  });
});

describe("grupo 5 — RLS e grants somente leitura", () => {
  it("habilita RLS e cria policy apenas FOR SELECT", () => {
    expect(SQL).toContain(
      "ALTER TABLE public.product_two_format_deliveries ENABLE ROW LEVEL SECURITY",
    );
    expect(SQL).toContain('CREATE POLICY "Service role reads two format deliveries"');
    expect(SQL).toMatch(
      /CREATE POLICY "Service role reads two format deliveries" ON public\.product_two_format_deliveries FOR SELECT TO service_role/i,
    );
    expect(SQL).not.toMatch(
      /CREATE POLICY "Service role reads two format deliveries"[^;]*FOR ALL/i,
    );
  });

  it("service_role recebe apenas SELECT na tabela", () => {
    expect(SQL).toContain(
      "REVOKE ALL ON TABLE public.product_two_format_deliveries FROM PUBLIC, anon, authenticated",
    );
    expect(SQL).toContain(
      "REVOKE ALL ON TABLE public.product_two_format_deliveries FROM service_role",
    );
    expect(SQL).toContain(
      "GRANT SELECT ON TABLE public.product_two_format_deliveries TO service_role",
    );
    expect(SQL).not.toMatch(
      /GRANT\s+(INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*public\.product_two_format_deliveries/i,
    );
  });
});

describe("grupo 6 — abertura conjunta atômica e replay congelado", () => {
  const open = functionText("product_two_format_open_delivery");
  const openCount = (open.match(/INSERT INTO public\.product_two_format_deliveries/g) ?? [])
    .length;

  it("valida as quatro chaves do contrato conjunto persistido", () => {
    expect(open).toContain("'campaignFormat'");
    expect(open).toContain("'formatContractVersion'");
    expect(open).toContain("'generationOrigin'");
    expect(open).toContain("'generationContractVersion'");
    expect(open).toContain("'1:1+9:16'");
    expect(open).toContain("'f60.7-two-format-v1'");
    expect(open).toContain("'two_format_two_stage'");
    expect(open).toContain("joint_contract_required");
  });

  it("serializa e reserva o quadrado com uma unidade", () => {
    expect(open).toContain("pg_advisory_xact_lock");
    expect(open).toContain("public.product_9_16_open_operation_v2(");
    expect(open).toContain("public.product_1_1_reserve_credit_operation(");
    expect(open).toContain(", 1,");
  });

  it("rejeita uma segunda operação conjunta na campanha antes de reservar", () => {
    expect(open).toContain("COUNT(DISTINCT operation_id)");
    expect(open).toContain("operation_origin_conflict");

    const guard = open.indexOf("COUNT(DISTINCT operation_id)");
    const reserve = open.indexOf("public.product_1_1_reserve_credit_operation(");
    const openV2 = open.indexOf("public.product_9_16_open_operation_v2(");
    expect(guard).toBeGreaterThan(-1);
    expect(reserve).toBeGreaterThan(guard);
    expect(openV2).toBeGreaterThan(guard);
  });

  it("insere exatamente os dois vínculos e não insere steps", () => {
    expect(openCount).toBe(2);
    expect(open).toContain("'square_original'");
    expect(open).toContain("'vertical'");
    expect(open).not.toContain("INSERT INTO public.product_9_16_two_stage_steps");
  });

  it("compara a seleção CONGELADA e nunca lê catálogo/configuração no replay", () => {
    for (const field of [
      "expansion_model",
      "expansion_quality",
      "expansion_config_version_id",
      "expansion_selection_origin",
    ]) {
      expect(open).toContain(field);
    }
    expect(open).toContain("operation_config_conflict");
    expect(open).not.toContain("nine_sixteen_expansion_model_config");
    expect(open).not.toContain("image_model_pair_config");
    expect(open).not.toContain("ai_model_catalog");
  });

  it("falhas pós-v2 levantam exceção, nunca retornam JSON parcial", () => {
    expect(open).toContain("RAISE EXCEPTION 'operation_origin_conflict'");
    expect(open).toContain("RAISE EXCEPTION 'square_credit_reservation_failed'");
    expect(open).toContain("RAISE EXCEPTION 'delivery_identity_conflict'");
    expect(open).not.toContain("WHEN unique_violation");
  });
});

describe("grupo 7 — entrega por formato com artefato canônico e token", () => {
  const deliver = functionText("product_two_format_deliver_format");

  it("exige token e recusa arte incompatível", () => {
    expect(deliver).toContain("p_publication_token");
    expect(deliver).toContain("missing_publication_token");
    expect(deliver).toContain("artifact_incompatible");
    expect(deliver).toContain("image/jpeg");
    expect(deliver).toContain("1024");
    expect(deliver).toContain("1920");
  });

  it("chama mark + deliver + projeção na mesma função", () => {
    expect(deliver).toContain("product_1_1_mark_campaign_credit_art_uploaded");
    expect(deliver).toContain("product_1_1_deliver_campaign_credit_operation");
    expect(deliver).toContain("product_two_format_project_campaign");
  });

  it("não entrega o artefato preparado interno", () => {
    expect(deliver).not.toContain("square_prepared");
  });
});

describe("grupo 8 — estorno por formato com evidência de ausência", () => {
  const refund = functionText("product_two_format_refund_format");

  it("exige ausência comprovada e recusa formato entregue", () => {
    expect(refund).toContain("delivered_not_refundable");
    expect(refund).toContain("artifact_present");
    expect(refund).toContain("insufficient_evidence");
    expect(refund).toContain("p_art_kind");
    expect(refund).toContain("p_observed_epoch");
  });

  it("usa a autoridade de falha e reprojeta na mesma função", () => {
    expect(refund).toContain("product_1_1_close_failed_operation");
    expect(refund).toContain("product_two_format_project_campaign");
    expect(
      (refund.match(/product_1_1_close_failed_operation\(/g) ?? []).length,
    ).toBe(1);
    expect(refund).toContain(
      "product_1_1_close_failed_operation( p_campaign_id, v_delivery_operation_id, 'absent', p_observed_epoch, p_reason )",
    );
  });

  it("verifica a execução ativa da operação compartilhada antes do estorno", () => {
    expect(refund).toContain("product_9_16_two_stage_attempt_claims");
    expect(refund).toContain("operation_in_progress");
    const check = refund.indexOf("product_9_16_two_stage_attempt_claims");
    const close = refund.indexOf("product_1_1_close_failed_operation(");
    expect(check).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(check);
  });

  it("nunca usa o atalho de estorno direto", () => {
    expect(RAW).not.toContain("product_1_1_refund_campaign_credit_operation");
    expect(refund).not.toContain("p_square_delivery_id");
  });
});

describe("grupo 9 — projeção prefere o quadrado e preserva ready", () => {
  const project = functionText("product_two_format_project_campaign");

  it("prefere square_original antes de vertical", () => {
    const firstSquare = project.indexOf("'square_original'");
    const firstVertical = project.indexOf("'vertical'");
    expect(firstSquare).toBeGreaterThan(-1);
    expect(firstVertical).toBeGreaterThan(firstSquare);
  });

  it("exige dois vínculos coerentes da mesma operação, sem LIMIT 1", () => {
    expect(project).toContain("COUNT(DISTINCT operation_id)");
    expect(project).toContain("delivery_links_inconsistent");
    expect(project).toContain("v_link_count <> 2");
    expect(project).not.toMatch(/ORDER BY\s+format\s+LIMIT\s+1/i);
    expect(project).toContain("AND operation_id = v_operation_id");
  });

  it("usa mensagem segura e nunca entrega square_prepared", () => {
    expect(project).toContain("two_format_delivery_failed");
    expect(project).not.toContain("square_prepared");
  });

  it("atualiza somente as colunas de projeção permitidas", () => {
    const update = textBetween(project, "UPDATE public.campaigns", "WHERE id = p_campaign_id");
    expect(update).not.toBe("");
    for (const column of ["status", "error_message", "storage_path", "updated_at"]) {
      expect(update).toContain(column);
    }
  });

  it("não reinterpreta campos legados no arquivo", () => {
    for (const column of LEGACY_COLUMNS) {
      expect(RAW).not.toContain(column);
    }
  });

  it("toma o lock da campanha antes dos locks específicos", () => {
    functionBodyWithCampaignLockFirst("product_two_format_project_campaign", [
      "public.product_two_format_deliveries",
      "public.product_1_1_campaign_credit_operations",
      "public.campaign_composition_artifacts",
    ]);
  });
});

describe("grupo 10 — preservação das autoridades existentes", () => {
  it("não contém DDL/DML destrutivo nem reescreve a tabela de crédito", () => {
    // Comentários podem citar TRUNCATE/REVOKE; o contrato vale para o SQL ativo.
    expect(SQL).not.toMatch(/DROP\s+TABLE/i);
    expect(SQL).not.toMatch(/TRUNCATE/i);
    expect(SQL).not.toMatch(/DELETE\s+FROM/i);
    expect(SQL).not.toMatch(
      /ALTER\s+TABLE\s+public\.product_1_1_campaign_credit_operations/i,
    );
  });

  it("não menciona o CHECK de amount nem amount 2", () => {
    expect(RAW).not.toContain("chk_p1_1_campaign_credit_operations_amount");
    expect(RAW).not.toContain("amount = 2");
  });

  it("a autoridade de crédito mantém amount 1, identidade e assinatura de reserva", () => {
    const credit = normalize(
      readFileSync(
        path.join(MIGRATIONS_DIR, "20261008000002_f56_2b1a_product_1_1_campaign_credit.sql"),
        "utf8",
      ),
    );
    expect(credit).toContain("CHECK (amount = 1)");
    expect(credit).toContain("UNIQUE (campaign_id, operation_id)");
    expect(credit).toContain("public.product_1_1_reserve_credit_operation(");
    expect(credit).toContain("p_amount INTEGER");
    expect(credit).toContain("p_metadata JSONB DEFAULT '{}'::jsonb");
  });

  it("a fence mantém mark/deliver de 3 argumentos, refund com motivo e close_failed de 5", () => {
    const fence = normalize(
      readFileSync(
        path.join(MIGRATIONS_DIR, "20261016000001_f56_2b2b_publication_fence.sql"),
        "utf8",
      ),
    );
    expect(fence).toContain(
      "public.product_1_1_mark_campaign_credit_art_uploaded( p_campaign_id UUID, p_operation_id UUID, p_publication_token UUID )",
    );
    expect(fence).toContain(
      "public.product_1_1_deliver_campaign_credit_operation( p_campaign_id UUID, p_operation_id UUID, p_publication_token UUID )",
    );
    expect(fence).toContain(
      "public.product_1_1_refund_campaign_credit_operation( p_campaign_id UUID, p_operation_id UUID, p_reason TEXT DEFAULT 'refund' )",
    );
    expect(fence).toContain(
      "public.product_1_1_close_failed_operation( p_campaign_id UUID, p_operation_id UUID, p_art_kind TEXT, p_observed_epoch INTEGER, p_reason TEXT )",
    );
  });
});

describe("grupo 11 — superfície de escrita limitada à tabela nova e à projeção", () => {
  it("a allowlist de escrita é exatamente a tabela de vínculo e campaigns", () => {
    const targets = writeTargets();
    expect(targets.length).toBeGreaterThan(0);

    for (const target of targets) {
      expect(
        ALLOWED_WRITE_TARGETS.has(target.table),
        `escrita não permitida (${target.kind}) em ${target.table}`,
      ).toBe(true);
    }

    const written = new Set(targets.map((target) => target.table));
    expect(written).toEqual(ALLOWED_WRITE_TARGETS);
  });

  it("o extrator realmente detecta um alvo proibido", () => {
    const synthetic = normalize(
      "INSERT INTO public.product_1_1_campaign_credit_operations (a) VALUES (1);",
    );
    const match = /INSERT\s+INTO\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/i.exec(
      synthetic,
    );
    expect(match?.[1]).toBe("public.product_1_1_campaign_credit_operations");
  });
});

describe("grupo 12 — assinaturas, SECURITY DEFINER, search_path e locks", () => {
  const signatures = [
    {
      name: "product_two_format_project_campaign",
      declaration:
        "CREATE OR REPLACE FUNCTION public.product_two_format_project_campaign( p_campaign_id UUID ) RETURNS JSONB",
      grant: "public.product_two_format_project_campaign(UUID)",
    },
    {
      name: "product_two_format_open_delivery",
      declaration:
        "CREATE OR REPLACE FUNCTION public.product_two_format_open_delivery( p_store_id UUID, p_campaign_id UUID, p_operation_id UUID, p_square_delivery_id UUID, p_expansion_model TEXT, p_expansion_quality TEXT, p_expansion_config_version_id UUID ) RETURNS JSONB",
      grant:
        "public.product_two_format_open_delivery(UUID, UUID, UUID, UUID, TEXT, TEXT, UUID)",
    },
    {
      name: "product_two_format_deliver_format",
      declaration:
        "CREATE OR REPLACE FUNCTION public.product_two_format_deliver_format( p_store_id UUID, p_campaign_id UUID, p_operation_id UUID, p_format TEXT, p_publication_token UUID ) RETURNS JSONB",
      grant: "public.product_two_format_deliver_format(UUID, UUID, UUID, TEXT, UUID)",
    },
    {
      name: "product_two_format_refund_format",
      declaration:
        "CREATE OR REPLACE FUNCTION public.product_two_format_refund_format( p_store_id UUID, p_campaign_id UUID, p_operation_id UUID, p_format TEXT, p_art_kind TEXT, p_observed_epoch INTEGER, p_reason TEXT DEFAULT 'two_format_refund' ) RETURNS JSONB",
      grant:
        "public.product_two_format_refund_format(UUID, UUID, UUID, TEXT, TEXT, INTEGER, TEXT)",
    },
  ] as const;

  it("as quatro funções têm assinatura exata e SECURITY DEFINER", () => {
    for (const signature of signatures) {
      expect(SQL).toContain(signature.declaration);
      const body = functionText(signature.name);
      expect(body, `${signature.name}: corpo ausente`).not.toBe("");
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path = ''");
    }
  });

  it("EXECUTE é revogado de PUBLIC/anon/authenticated e concedido só a service_role", () => {
    for (const signature of signatures) {
      expect(SQL).toContain(
        `REVOKE EXECUTE ON FUNCTION ${signature.grant} FROM PUBLIC, anon, authenticated`,
      );
      expect(SQL).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature.grant} TO service_role`,
      );
    }
  });

  it("a abertura contém advisory lock, conflitos e comparação congelada", () => {
    const open = functionText("product_two_format_open_delivery");
    for (const token of [
      "pg_advisory_xact_lock",
      "operation_origin_conflict",
      "delivery_identity_conflict",
      "delivery_link_incomplete",
      "operation_config_conflict",
      "expansion_model",
    ]) {
      expect(open).toContain(token);
    }
  });

  it("as quatro RPCs adquirem o lock da campanha antes dos locks específicos", () => {
    const specificTables = [
      "public.product_two_format_deliveries",
      "public.product_1_1_campaign_credit_operations",
      "public.campaign_composition_artifacts",
    ];
    for (const name of [
      "product_two_format_open_delivery",
      "product_two_format_deliver_format",
      "product_two_format_refund_format",
      "product_two_format_project_campaign",
    ]) {
      functionBodyWithCampaignLockFirst(name, specificTables);
    }
  });
});

describe("grupo 13 — nenhuma RPC existente é redefinida", () => {
  it("não recria funções product_1_1_* nem product_9_16_*", () => {
    expect(SQL).not.toMatch(/CREATE OR REPLACE FUNCTION public\.product_1_1_/);
    expect(SQL).not.toMatch(/CREATE OR REPLACE FUNCTION public\.product_9_16_/);
  });
});

describe("grupo 14 — suíte offline sem acesso a banco", () => {
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
