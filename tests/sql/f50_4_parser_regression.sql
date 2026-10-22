-- =============================================================================
-- F50.4 — REGRESSÃO DO PARSER do Supabase CLI 2.75.0 (SQLSTATE 42601)
-- =============================================================================
--
-- OBJETIVO
--   Reproduzir o incidente da F50.3: um identificador contendo a substring
--   "atomic" faz o tokenizer do CLI 2.75.0 entrar em modo "BEGIN ATOMIC",
--   ignorar os `;` seguintes e enviar vários comandos em um único prepared
--   statement. O `db push` falha com SQLSTATE 42601
--   ("cannot insert multiple commands into a prepared statement").
--
-- PROCEDIMENTO
--   1. Criar um workdir descartável separado (nunca o repo, nunca produção).
--   2. Copiar este arquivo para <workdir>/supabase/migrations/.
--   3. Aplicar com o CLI GLOBAL 2.75.0:
--        supabase db push --db-url "postgresql://postgres:postgres@127.0.0.1:<porta>/postgres"
--   4. Registrar a saída (stdout/stderr) e o exit code.
--
-- RESULTADO ESPERADO
--   - Sob o CLI 2.75.0: falha com 42601 no statement do probe.
--   - No SQL direto (psql/runner `pg`): o mesmo SQL executa com sucesso,
--     provando que o problema é do parser do CLI, não do SQL.
--
-- REGRA OBRIGATÓRIA
--   NENHUMA migration real da F50.4 pode conter "atomic" em identificadores
--   (constraints, índices, triggers, funções, tabelas). Este arquivo é a única
--   exceção, por ser uma fixture de regressão executada apenas manualmente.
--
-- ESCOPO
--   O arquivo NÃO pertence ao runner padrão (nome fora de f50_4_m* e de
--   *matrix*). Pode ser passado explicitamente:
--     node scripts/f50-4/run-sql-tests.mjs tests/sql/f50_4_parser_regression.sql
--   A tabela abaixo é criada e DROPada na mesma transação; nada permanece.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.f50_4_parser_probe (
  id INTEGER PRIMARY KEY,
  value TEXT
);

-- O nome abaixo contém "atomic" DE PROPÓSITO: é o gatilho da regressão.
ALTER TABLE public.f50_4_parser_probe
  ADD CONSTRAINT chk_f50_4_parser_atomic_probe CHECK (value IS NULL OR length(value) > 0);

INSERT INTO public.f50_4_parser_probe (id, value) VALUES (1, 'probe');

DROP TABLE public.f50_4_parser_probe;

COMMIT;
