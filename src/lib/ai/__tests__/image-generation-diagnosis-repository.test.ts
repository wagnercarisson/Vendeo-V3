import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

import { SupabaseImageGenerationDiagnosisRepository } from "../image-generation-diagnosis-repository";
import { generateSupportReference } from "../image-generation-support-reference";

/**
 * Prova de DURABILIDADE cross-instance do diagnóstico de falha (F56.1, D-26).
 *
 * Esta suíte NÃO usa o `supabaseAdmin` da aplicação: constrói clientes Supabase
 * EXPLÍCITOS a partir das variáveis de ambiente da instância DESCARTAVEL e
 * comprovadamente ISOLADA do F56.1 (`F561_ISOLATED_SUPABASE_URL` /
 * `F561_ISOLATED_SERVICE_ROLE_KEY`), aplica a escrita por UMA instância do
 * repositório e recupera o diagnóstico por uma NOVA instância/requisição
 * (cliente separado). Um fake em memória nunca é apresentado como prova.
 *
 * Contingência BLOQUEANTE do encerramento da fase: sem a instância isolada, a
 * prova de durabilidade NÃO roda (skip explícito) e o checkpoint do plano 11 não
 * pode aprovar a correlação durável. Nunca marcar esta suíte como prova de
 * durabilidade com um duble em memória.
 *
 * Nota: o trigger de imutabilidade bloqueia UPDATE/DELETE — a linha de teste
 * inserida NÃO é removida (esperado na instância descartável).
 */

const ISOLATED_SUPABASE_URL = process.env.F561_ISOLATED_SUPABASE_URL;
const ISOLATED_SERVICE_ROLE_KEY = process.env.F561_ISOLATED_SERVICE_ROLE_KEY;

const hasIsolatedInstance = Boolean(ISOLATED_SUPABASE_URL && ISOLATED_SERVICE_ROLE_KEY);

// Sem a instância isolada a prova de durabilidade é pulada com marcador explícito
// de contingência BLOQUEANTE (não é aceitável como estado final da fase).
if (!hasIsolatedInstance) {
  describe.skip(
    "[BLOQUEANTE] image-generation-diagnosis-repository — durabilidade cross-instance requer instância Supabase descartável isolada (F561_ISOLATED_SUPABASE_URL / F561_ISOLATED_SERVICE_ROLE_KEY)",
    () => {
      it("é contingência BLOQUEANTE do encerramento da fase — nunca substituir por fake em memória", () => {
        // Intencionalmente vazio: o skip explícito é o próprio registro.
      });
    },
  );
}

const describeDurability = hasIsolatedInstance ? describe : describe.skip;

function createIsolatedClient() {
  return createClient(ISOLATED_SUPABASE_URL as string, ISOLATED_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describeDurability(
  "image-generation-diagnosis-repository — durabilidade cross-instance (F56.1 D-26)",
  () => {
    it("aponta exclusivamente para a instância isolada (nunca a stack compartilhada)", () => {
      expect(ISOLATED_SUPABASE_URL).toContain("127.0.0.1:55321");
    });

    it("recupera o diagnóstico por uma NOVA instância do repositório (novo cliente + nova requisição)", async () => {
      // Instância A: grava o diagnóstico.
      const repositoryA = new SupabaseImageGenerationDiagnosisRepository(createIsolatedClient());
      const reference = generateSupportReference();

      const recorded = await repositoryA.recordDiagnosis({
        reference,
        internalCategory: "quota",
        model: "gpt-image-2.5-sunburst",
        quality: "medium",
        target: "primary",
        attemptNumber: 1,
        normalizedError: "insufficient_quota sk-shouldbe-secret https://api.openai.com/v1/images",
        runId: "11111111-1111-4111-8111-111111111111",
        traceId: "trace-durabilidade-1",
      });

      expect(recorded.reference).toBe(reference);

      // Instância B: NOVA construção + NOVO cliente (nova requisição), recupera pela tabela durável.
      const repositoryB = new SupabaseImageGenerationDiagnosisRepository(createIsolatedClient());
      const recovered = await repositoryB.findByReference(recorded.reference);

      expect(recovered).not.toBeNull();
      expect(recovered?.reference).toBe(recorded.reference);
      expect(recovered?.internalCategory).toBe("quota");
      expect(recovered?.model).toBe("gpt-image-2.5-sunburst");
      expect(recovered?.quality).toBe("medium");
      expect(recovered?.target).toBe("primary");
      expect(recovered?.attemptNumber).toBe(1);
      expect(recovered?.runId).toBe("11111111-1111-4111-8111-111111111111");
      expect(recovered?.traceId).toBe("trace-durabilidade-1");
    });

    it("persiste o erro sanitizado (sem chave/URL crua) recuperável pela nova instância", async () => {
      const repositoryA = new SupabaseImageGenerationDiagnosisRepository(createIsolatedClient());
      const reference = generateSupportReference();

      await repositoryA.recordDiagnosis({
        reference,
        internalCategory: "auth",
        model: "gpt-image-2",
        quality: "medium",
        target: "fallback",
        attemptNumber: 3,
        normalizedError: "Bearer abc.def.ghi invalid api key sk-abcd1234efgh5678 https://api.openai.com",
      });

      const repositoryB = new SupabaseImageGenerationDiagnosisRepository(createIsolatedClient());
      const recovered = await repositoryB.findByReference(reference);

      expect(recovered).not.toBeNull();
      expect(recovered?.normalizedError).not.toContain("sk-abcd1234efgh5678");
      expect(recovered?.normalizedError).not.toContain("api.openai.com");
      expect(recovered?.internalCategory).toBe("auth");
      expect(recovered?.target).toBe("fallback");
      expect(recovered?.attemptNumber).toBe(3);
    });

    it("retorna null para referência inexistente consultando a tabela durável", async () => {
      const repository = new SupabaseImageGenerationDiagnosisRepository(createIsolatedClient());

      const recovered = await repository.findByReference(generateSupportReference());

      expect(recovered).toBeNull();
    });
  },
);
