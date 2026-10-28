import fs from "node:fs";

/**
 * Registra IDs de fixtures persistidas para cleanup pelo orquestrador.
 * Sem F57_2_CLEANUP_MANIFEST (execução isolada do teste), é no-op.
 * O arquivo é JSONL e é persistido antes de qualquer exclusão do orquestrador.
 */
export function registerFixture(kind: "store" | "user", id: string): void {
  const manifest = process.env.F57_2_CLEANUP_MANIFEST;
  if (!manifest) return;
  fs.appendFileSync(manifest, `${JSON.stringify({ kind, id })}\n`, "utf8");
}
