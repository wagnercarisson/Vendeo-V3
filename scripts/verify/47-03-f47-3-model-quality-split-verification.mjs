#!/usr/bin/env node
// F47.3 — verificação OFFLINE/ESTÁTICA da migration corretiva que separa
// modelo e qualidade na persistência da Assinatura Visual.
//
// Este script NÃO usa rede, banco, Docker, Supabase CLI, `pg`,
// `@supabase/supabase-js` nem qualquer processo externo. Lê apenas arquivos
// locais com módulos nativos do Node e falha com exit != 0 em qualquer
// divergência.
//
// Uso: node scripts/verify/47-03-f47-3-model-quality-split-verification.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const F47_1_FILE = path.join(
  MIGRATIONS_DIR,
  "20261024141422_f47_1_visual_signature_model_config.sql",
);
const F47_2_FILE = path.join(
  MIGRATIONS_DIR,
  "20261024141452_f47_2_visual_signature_release_state.sql",
);

const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

function readTextOrFail(label, filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`✗ não foi possível ler ${label}: ${filePath}`);
    console.error(`  motivo: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
    return null;
  }
}

function findF47_3Migration() {
  let entries = [];
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch (error) {
    console.error(`✗ não foi possível listar ${MIGRATIONS_DIR}`);
    console.error(`  motivo: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
    return null;
  }
  const matches = entries.filter((name) => /_f47_3_.*\.sql$/i.test(name)).sort();
  if (matches.length === 0) {
    console.error(
      "✗ migration corretiva F47.3 não encontrada em supabase/migrations (padrão *_f47_3_*.sql)",
    );
    process.exitCode = 1;
    return null;
  }
  if (matches.length > 1) {
    console.error(
      `✗ mais de uma migration F47.3 encontrada: ${matches.join(", ")} — esperado exatamente uma`,
    );
    process.exitCode = 1;
    return null;
  }
  return path.join(MIGRATIONS_DIR, matches[0]);
}

const migrationPath = findF47_3Migration();
if (!migrationPath) {
  console.log("\nResults: 0 passed / 1 failed / 1 total");
  process.exit(1);
}

const migration = readTextOrFail("migration F47.3", migrationPath);
const f47_1 = readTextOrFail("migration F47.1", F47_1_FILE);
const f47_2 = readTextOrFail("migration F47.2", F47_2_FILE);
if (migration === null || f47_1 === null || f47_2 === null) {
  console.log("\nResults: 0 passed / 1 failed / 1 total");
  process.exit(1);
}

console.log("\nF47.3 — modelo/qualidade separados (verificação offline)\n");
console.log(`migration: ${path.relative(REPO_ROOT, migrationPath)}\n`);

// Bloco do CASE de derivação (recortado para evitar falsos positivos fora dele).
const caseStart = migration.search(/CASE\s+WHEN\s+p_image_model/);
const caseEnd = caseStart === -1 ? -1 : migration.indexOf("END CASE", caseStart);
const derivationCase =
  caseStart !== -1 && caseEnd !== -1 ? migration.slice(caseStart, caseEnd) : "";

// -----------------------------------------------------------------------------
// Bloco A — as quatro combinações derivam o preset correto
// -----------------------------------------------------------------------------
const TUPLE_ASSERTS = [
  {
    label: "flare_low",
    model: "gpt-image-2\\.5-flare",
    quality: "low",
    preset: "flare_low",
  },
  {
    label: "flare_medium",
    model: "gpt-image-2\\.5-flare",
    quality: "medium",
    preset: "flare_medium",
  },
  {
    label: "sunburst_low",
    model: "gpt-image-2\\.5-sunburst",
    quality: "low",
    preset: "sunburst_low",
  },
  {
    label: "sunburst_medium",
    model: "gpt-image-2\\.5-sunburst",
    quality: "medium",
    preset: "sunburst_medium",
  },
];

for (const tuple of TUPLE_ASSERTS) {
  const pattern = new RegExp(
    `${tuple.model}[\\s\\S]{0,80}['\"]${tuple.quality}['\"][\\s\\S]{0,80}${tuple.preset}`,
  );
  assert(
    `A: par ${tuple.label} deriva o preset '${tuple.preset}'`,
    pattern.test(derivationCase),
    "sequência modelo+qualidade→preset não encontrada no CASE de derivação",
  );
}

// -----------------------------------------------------------------------------
// Bloco B — rejeição explícita de valores inválidos
// -----------------------------------------------------------------------------
assert(
  "B: modelo inválido rejeitado com 'invalid_image_model'",
  /RAISE\s+EXCEPTION\s+'invalid_image_model'/.test(migration),
  "RAISE EXCEPTION 'invalid_image_model' ausente",
);
assert(
  "B: qualidade inválida rejeitada com 'invalid_image_quality'",
  /RAISE\s+EXCEPTION\s+'invalid_image_quality'/.test(migration),
  "RAISE EXCEPTION 'invalid_image_quality' ausente",
);
assert(
  "B: par fora da matriz rejeitado com 'invalid_preset_tuple'",
  /RAISE\s+EXCEPTION\s+'invalid_preset_tuple'/.test(migration),
  "RAISE EXCEPTION 'invalid_preset_tuple' ausente",
);
assert(
  "B: CASE de derivação tem ELSE explícito (sem ELSE silencioso)",
  derivationCase.length > 0 && /\bELSE\b/.test(derivationCase.slice(-200)),
  "ELSE ausente no fim do CASE de derivação",
);
assert(
  "B: não existe 'ELSE NULL' nem atribuição nula silenciosa",
  !/ELSE\s+NULL/i.test(derivationCase) &&
    !/ELSE\s+v_image_preset\s*:=\s*NULL/i.test(migration),
  "derivação silenciosa para NULL encontrada",
);

// -----------------------------------------------------------------------------
// Bloco C — remoção do bloqueio de avaliação e da RPC v2
// -----------------------------------------------------------------------------
assert(
  "C: migration F47.3 não contém o bloqueio de avaliação",
  !migration.includes("preset" + "_not" + "_evaluated"),
  "bloqueio de avaliação ainda presente na migration corretiva",
);
assert(
  "C: F47.2 (alvo) ainda contém o bloqueio de avaliação — alvo correto",
  f47_2.includes("preset" + "_not" + "_evaluated"),
  "F47.2 não contém o bloqueio esperado — arquivo alvo divergente",
);
assert(
  "C: RPC v2 é removida com DROP FUNCTION IF EXISTS",
  /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.admin_set_visual_signature_model_config_v2\s*\(\s*UUID\s*,\s*TEXT\s*,\s*TEXT\s*,\s*TEXT\s*,\s*TEXT\s*,\s*UUID\s*,\s*TEXT\s*,\s*TEXT\s*\)/i.test(
    migration,
  ),
  "DROP FUNCTION IF EXISTS ...admin_set_visual_signature_model_config_v2(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) ausente",
);

// -----------------------------------------------------------------------------
// Bloco D — ciclo de vida não é redefinido
// -----------------------------------------------------------------------------
const LIFECYCLE_FUNCTIONS = [
  "admin_reset_visual_signature_model_config",
  "admin_publish_visual_signature_model_config",
  "admin_activate_visual_signature_model_config",
];
for (const fn of LIFECYCLE_FUNCTIONS) {
  const redefinition = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${fn}\\s*\\(`,
    "i",
  );
  assert(
    `D: ${fn} não é redefinida`,
    !redefinition.test(migration),
    "redefinição de função do ciclo de vida encontrada na migration corretiva",
  );
}

// -----------------------------------------------------------------------------
// Bloco E — CHECK da tabela cobre os quatro pares (F47.1)
// -----------------------------------------------------------------------------
assert(
  "E: F47.1 contém o CHECK chk_vs_preset_tuple",
  f47_1.includes("chk_vs_preset_tuple"),
  "chk_vs_preset_tuple ausente na F47.1",
);
for (const tuple of TUPLE_ASSERTS) {
  const pattern = new RegExp(
    `image_preset\\s*=\\s*'${tuple.preset}'[\\s\\S]{0,80}image_model\\s*=\\s*'${tuple.model.replace(/\\/g, "")}'[\\s\\S]{0,80}image_quality\\s*=\\s*'${tuple.quality}'`,
  );
  assert(
    `E: CHECK da tabela aceita a tupla ${tuple.label}`,
    pattern.test(f47_1),
    `tupla ${tuple.label} não encontrada em chk_vs_preset_tuple`,
  );
}

// -----------------------------------------------------------------------------
// Bloco F — preservação operacional na v3
// -----------------------------------------------------------------------------
const OPERATIONAL_STRINGS = [
  ["pg_advisory_xact_lock", /pg_advisory_xact_lock\s*\(/],
  ["INSERT INTO public.admin_audit_log", /INSERT\s+INTO\s+public\.admin_audit_log/],
  ["operation_id_conflict", /operation_id_conflict/],
  [
    "configuration_replaced_requires_reapproval",
    /configuration_replaced_requires_reapproval/,
  ],
  [
    "visual_signature_model_config_pilot_stores",
    /visual_signature_model_config_pilot_stores/,
  ],
  ["previous_config_version_id", /previous_config_version_id/],
  ["config_published", /config_published/],
  ["config_activated", /config_activated/],
];
for (const [label, pattern] of OPERATIONAL_STRINGS) {
  assert(
    `F: v3 preserva '${label}'`,
    pattern.test(migration),
    `'${label}' ausente na migration corretiva`,
  );
}
assert(
  "F: jsonb_build_object publica 'config_published', false",
  /['"]config_published['"]\s*,\s*false/.test(migration),
  "'config_published', false ausente",
);
for (const key of ["image_preset", "image_model", "image_quality"]) {
  const pattern = new RegExp(`['"]${key}['"]\\s*,`);
  assert(
    `F: jsonb_build_object expõe a chave '${key}'`,
    pattern.test(migration),
    `chave '${key}' ausente no metadata de retorno`,
  );
}

// -----------------------------------------------------------------------------
// Bloco G — assinatura da v3
// -----------------------------------------------------------------------------
const signatureStart = migration.search(
  /FUNCTION\s+public\.admin_set_visual_signature_model_config_v3\s*\(/,
);
const signatureEnd =
  signatureStart === -1 ? -1 : migration.indexOf("RETURNS", signatureStart);
const signature =
  signatureStart !== -1 && signatureEnd !== -1
    ? migration.slice(signatureStart, signatureEnd)
    : "";

assert(
  "G: assinatura da v3 localizada",
  signature.length > 0,
  "declaração de admin_set_visual_signature_model_config_v3 não encontrada",
);
assert(
  "G: v3 declara p_image_model antes de p_image_quality",
  signature.indexOf("p_image_model") !== -1 &&
    signature.indexOf("p_image_quality") !== -1 &&
    signature.indexOf("p_image_model") < signature.indexOf("p_image_quality"),
  "ordem/ausência dos parâmetros p_image_model e p_image_quality incorreta",
);
assert(
  "G: v3 NÃO recebe p_image_preset como parâmetro",
  signature.length > 0 && !/\bp_image_preset\b/.test(signature),
  "p_image_preset ainda é parâmetro da v3",
);
assert(
  "G: v3 é SECURITY DEFINER",
  /SECURITY\s+DEFINER/i.test(migration),
  "SECURITY DEFINER ausente na v3",
);
assert(
  "G: v3 usa SET search_path = ''",
  /SET\s+search_path\s*=\s*''/i.test(migration),
  "SET search_path = '' ausente na v3",
);

// -----------------------------------------------------------------------------
// Resumo
// -----------------------------------------------------------------------------
const failed = results.filter((result) => !result.ok);
console.log(
  `\nResults: ${results.length - failed.length} passed / ${failed.length} failed / ${results.length} total`,
);
if (failed.length > 0) {
  process.exitCode = 1;
}
