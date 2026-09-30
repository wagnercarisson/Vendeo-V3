# F48.2.4 — Verificação da Fase (Experimento determinístico Oferta 1:1)

> Arquivo **iniciado** pelo Plano `48-2-4-09` (Task 1 — gates). O **SHA base** foi capturado no
> início da execução da fase (Plano `48-2-4-01`) e é a referência para o encerramento (Task 4)
> comparar `base..HEAD` — não apenas o working tree.
>
> **Status deste arquivo:** ⏳ **INICIADO (Task 1 — gates).** Os CHECKPOINTS **A** e **B**
> permanecem **pendentes** (humanos). As seções de produção intocada (`base..HEAD`) e de
> closeout serão preenchidas na **Task 4**, após o UAT.

Base SHA: f5a7fe9a27e823b64b355ec8c431d4e514d5ab99

Capturado em: 2026-09-30 (início da execução da F48.2.4 — linha `Base SHA` de `48-2-4-01-SUMMARY.md`).
Verificado como objeto de commit válido: `git cat-file -t f5a7fe9a…` → `commit`.

---

## 1. Escopo verificado

A F48.2.4 entrega o **experimento determinístico de campanha Oferta 1:1** na bancada do
Admin/Laboratório: compositor determinístico multidimensional (núcleo neutro + políticas
versionadas), prompt-base padrão versionado e editável, mapeamento mínimo de branding (um único
campo de direção visual), transporte canônico da identidade (ordem principal → adicionais →
identidade; resolução por `identity_state`), revalidação server-side do preflight
(`approval_invalidated`), linhagem de tentativas (`attempt_of_run_id`) e API/UI evoluídas — tudo
isolado da produção e **sem qualquer geração real de IA** em implementação, testes ou CI.
Fonte da verdade: `openspec/changes/fase-48-2-4-experimento-deterministico-oferta-1-1/`.

---

## 2. `must_haves` da fase — evidência

| # | Verdade exigida | Evidência | Resultado |
|---|---|---|---|
| 1 | typecheck, lint, build e a suíte completa passam; nenhum teste faz chamada real de IA | §3 | ✅ (Task 1) |
| 2 | CHECKPOINT A (humano) revisa políticas/branding/ordem das imagens/revalidação **antes de qualquer chamada paga** | §4 | ⏳ pendente |
| 3 | CHECKPOINT B (humano) executa o UAT manual completo (técnico + comercial/visual) | §4 | ⏳ pendente |
| 4 | O UAT pago exige autorização humana explícita; recusa ⇒ fase NÃO concluída | §4 | ⏳ pendente |
| 5 | Produção intocada por `base..HEAD`; base ausente ⇒ falha | §6 | ⏳ a preencher (Task 4) |
| 6 | `48-2-4-VERIFICATION.md` e `48.2.4-UAT.md` gerados; nenhum provider autônomo | este arquivo | ⏳ parcial (UAT na Task 3) |

---

## 3. Gates automatizados (Task 1)

Executados com `npm.cmd` (exit code real; o shim `npm` no PowerShell não propaga `$LASTEXITCODE`
de forma confiável). Data: 2026-09-30.

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ exit 0 |
| Lint | `npm.cmd run lint` | ✅ exit 0 (0 warnings) |
| Build | `npm.cmd run build` | ✅ exit 0 (`✓ Compiled successfully`; 76/76 páginas geradas; `check:cnae OK`) |
| Suíte completa (exceção externa `legal`; `--testTimeout=30000`) | `npm.cmd test -- --exclude "**/legal-document-versions.test.ts" --testTimeout=30000` | ⚠️ exit 1 — `Test Files 6 failed \| 391 passed \| 1 skipped (398)` / `Tests 2 failed \| 4558 passed \| 26 skipped (4586)` — **as 6 falhas são suites de integração que exigem Postgres local em `127.0.0.1:54322` (Docker não está em execução)**; ver §5 |
| Suíte completa (exceção externa `legal` **+** suites de integração de DB ambientalmente bloqueadas; `--testTimeout=30000`) | `npm.cmd test -- --testTimeout=30000 --exclude …` (7 `--exclude`; ver §5) | ✅ exit 0 — `Test Files 391 passed \| 1 skipped (392)` / `Tests 4558 passed \| 2 skipped (4560)` |
| Testes da fase (14 arquivos) | `npm.cmd test -- --run --testTimeout=30000 <14 arquivos>` | ✅ exit 0 — `Test Files 14 passed (14)` / `Tests 333 passed (333)` |

**Observação sobre o `--testTimeout`:** os flakes de 5 s preexistentes e já registrados nos planos
05 e 08 (`bench-execution.contract.test.ts` — processamento de imagem `sharp` + fetch ao Supabase
local `localhost:54321`, que não está em execução) reapareceram no primeiro run do gate. Com
`--testTimeout=30000` **todos passam** — nenhum timeout de 5 s remanescente. Nenhum arquivo de
produção/teste foi alterado para contornar o timeout.

---

## 4. Testes próprios da fase executados (14 arquivos — todos verdes)

- `src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts` (políticas determinísticas + negativos)
- `src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts` (núcleo/compositor)
- `src/lib/lab/bench/__tests__/prompt-base.contract.test.ts` (prompt-base padrão versionado)
- `src/lib/lab/bench/__tests__/branding-prompt-mapping.contract.test.ts` (mapeamento mínimo de branding)
- `src/lib/lab/bench/__tests__/identity-direction.contract.test.ts` (direção de identidade)
- `src/lib/lab/bench/__tests__/identity-transport.contract.test.ts` (transporte canônico da identidade)
- `src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts` (revalidação `approval_invalidated`)
- `src/lib/lab/bench/__tests__/run-history.contract.test.ts` (linhagem de tentativas)
- `src/lib/lab/bench/__tests__/bench-images-adapter.test.ts` (adapter Images da bancada)
- `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` (execução single-shot + `prompt_sent` byte a byte via `RecordingAdapter`)
- `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` (API administrativa)
- `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx` (UI)
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` (isolamento local-only)
- `src/lib/ai/__tests__/architecture-guard.test.ts` (gate arquitetural estático)

**Nenhuma chamada real de IA:** os testes usam fakes/mocks/adapters gravadores (ex.: `RecordingAdapter`
em `bench-execution.contract.test.ts`; client gravador em `src/lib/lab/__tests__/`).
`architecture-guard.test.ts` é um gate estático contra `new OpenAI(` / `new GoogleGenerativeAI(` /
`chat.completions.create(`. **Nenhum `usage` real, nenhum crédito, nenhuma chamada paga** em
implementação/testes/CI.

---

## 5. Exceções e condições ambientais (registradas, não mascaradas)

1. **Exceção externa preexistente (F50) — `legal-document-versions.test.ts`:** `ENOENT` do caminho
   antigo da change arquivada da F50. **Não corrigida** nesta fase; follow-up externo. Excluída
   explicitamente do gate via `--exclude` — **não** é sucesso silencioso.
2. **Pré-requisito ambiental ausente — Postgres local (`127.0.0.1:54322`) / Docker não em execução:**
   6 suites de integração que abrem conexão real ao Postgres local falham por `ECONNREFUSED 127.0.0.1:54322`:
   - `src/lib/__tests__/access-request-limit.postgres.test.ts`
   - `src/lib/__tests__/data-subject-requests.postgres.test.ts`
   - `src/lib/credit/__tests__/credit-concurrency.test.ts`
   - `src/lib/credit/__tests__/credit-f50-11-integration.test.ts`
   - `src/lib/credit/__tests__/credit-idempotency.test.ts`
   - `src/lib/credit/__tests__/operation-cost-service.integration.test.ts`

   **Diagnóstico:** `docker info` → `failed to connect to the docker API … daemon is not running`;
   portanto o Supabase local **não pode** ser iniciado neste ambiente. Essas suites são de
   **crédito/access-request/dados pessoais (F50)** — **nenhuma pertence à F48.2.4** e nenhuma foi
   tocada por esta fase. São **bloqueio ambiental** (Docker/Postgres ausente), **não** regressão de
   código. Foram **excluídas explicitamente** do run verde (§3, linha 2) para comprovar ausência de
   outras regressões — a exclusão é **documentada**, não silenciosa. Quando o Supabase local estiver
   ativo (pré-requisito do UAT/CHECKPOINT A), essas suites devem ser reexecutadas no gate final.

   **Precedente na fase:** os Planos 05 e 08 já registraram que `bench-execution.contract.test.ts`
   estoura o timeout padrão de 5 s por causa do Supabase local (`localhost:54321`) não estar em
   execução — pré-existente e não relacionado.

---

## 6. Produção intocada — comparativo `base..HEAD` (Task 4 — pendente)

> Preenchido na **Task 4**, após o CHECKPOINT B. `BASE = f5a7fe9a27e823b64b355ec8c431d4e514d5ab99`
> (lido da linha `Base SHA` acima; **não** recriado). Comando:
> `git diff --name-only $BASE..HEAD -- <caminhos produtivos>` (vazio esperado).

⏳ **Pendente** — a prova `base..HEAD` e a confirmação de ausência de uso remoto serão registradas
na Task 4 (encerramento), após o UAT.

---

## 7. Checkpoints humanos

| Checkpoint | Plano/Task | Conteúdo | Status |
|---|---|---|---|
| **A** | 48-2-4-09 / Task 2 | Revisão de políticas/versões, mapeamento de branding, ordem das imagens + resolução de identidade, revalidação do preflight e `prompt_sent` byte a byte — **antes de qualquer chamada paga**. Autoriza o número de gerações reais do UAT. | ⏳ **PENDENTE** |
| **B** | 48-2-4-09 / Task 3 | UAT manual completo (técnico sem provider + comercial/visual humano por geração); decisão aprovado/rejeitado/requer ajuste. | ⏳ **PENDENTE** |

---

## 8. Conclusão parcial (Task 1)

**⏳ Fase 48.2.4 em verificação — gates da Task 1 executados.**

- `typecheck`, `lint` e `build` **verdes** (exit 0).
- Testes próprios da fase **verdes** (14 arquivos / 333 testes).
- Suíte completa **verde** excluindo a exceção externa `legal` e as 6 suites de integração de DB
  ambientalmente bloqueadas (Docker/Postgres ausente) — `391 passed | 1 skipped` / `4558 passed | 2 skipped`.
- **Nenhuma chamada real de IA** em testes/CI (fakes/adapters gravadores + gate arquitetural).
- **CHECKPOINT A** e **CHECKPOINT B** permanecem **pendentes**; nenhuma geração paga foi executada.

---

*Fase: 48.2.4-experimento-deterministico-oferta-1-1. Verificação **iniciada** na Task 1 (gates).
Produção intocada (`base..HEAD`) e closeout serão preenchidos na Task 4, após os CHECKPOINTS A/B.*
