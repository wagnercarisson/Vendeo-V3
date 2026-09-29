# F48.2.3 — Verificação da Fase (Fidelidade experimental da bancada)

> Arquivo **iniciado** pelo Plano `48-2-3-08` (Task 1 — gates). O **SHA base** foi capturado
> no início da execução da fase (Plano `48-2-3-01`) e é a referência para o encerramento
> (Task 3) comparar `base..HEAD` — não apenas o working tree.
>
> **Status deste arquivo:** seção de gates preenchida (Task 1). As seções de UAT/CHECKPOINT B
> e de produção intocada (`base..HEAD`) são preenchidas na Task 3, **após** a aprovação do
> CHECKPOINT B pelo humano.

Base SHA: 73ece00fd54d72af1bd48c23a8458694ed1bd636

Capturado em: 2026-09-29 (início da execução da F48.2.3 — linha `Base SHA` de `48-2-3-01-SUMMARY.md`).

---

## 1. Escopo verificado

A F48.2.3 entrega a **fidelidade experimental da bancada** de geração no Admin/Laboratório:
importação explícita e unidirecional da identidade das lojas de teste por comando local
(`scripts/lab/48-2-3-bench-import-stores.mjs`), paridade programática do formulário produtivo
(`form-rules.ts`, snapshot fiel), briefing experimental estruturado com `typography_direction` e
`brandColor` resolvido pela precedência produtiva exata, e um **compositor determinístico mínimo**
com preflight explícito (**compor → revisar → editar → aprovar → estimar/confirmar**), mantendo
isolamento absoluto entre laboratório e produção. Fonte da verdade:
`openspec/changes/fase-48-2-3-fidelidade-experimental-bancada/`.

---

## 2. `must_haves` da fase — evidência

| # | Verdade exigida | Evidência | Resultado |
|---|---|---|---|
| 1 | typecheck, lint, build e suíte completa passam; nenhum teste faz chamada real de IA | §3 abaixo | ✅ |
| 2 | Testes negativos de fronteira/importação, paridade e compositor passam | `bench-import.contract.test.ts`, `lab-isolation.contract.test.ts`, `architecture-guard.test.ts`, `form-parity.contract.test.ts`, `prompt-composer.contract.test.ts` (§3) | ✅ |
| 3 | UAT manual sem provider (CHECKPOINT B) comprova fidelidade/composição/isolamento | `48.2.3-UAT.md` (Task 3, após aprovação) | ⏳ pendente (CHECKPOINT B) |
| 4 | Geração real é OPCIONAL, só manual pelo usuário, e NÃO é critério automático | §3 (nenhuma geração em testes/CI); `48.2.3-UAT.md` | ✅ (nenhuma geração real executada) |
| 5 | Produção intocada por `base..HEAD`; base ausente ⇒ falha | §4 (Task 3) | ⏳ pendente (Task 3) |
| 6 | `48-2-3-VERIFICATION.md` e `48.2.3-UAT.md` gerados; tracking não alterado por tasks autônomas | este arquivo; `48.2.3-UAT.md` (Task 3); STATE/ROADMAP/HANDOFF intocados | ✅ (parcial) |

---

## 3. Gates automatizados (Task 1)

Executados com `npm.cmd` (exit code real; o shim `npm` no PowerShell não propaga `$LASTEXITCODE` de forma confiável).

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ exit 0 |
| Lint | `npm.cmd run lint` | ✅ exit 0 |
| Build | `npm.cmd run build` | ✅ exit 0 |
| Suíte completa (exceção externa `legal` + workaround temporário `access-request`) | `npm.cmd test -- --exclude "**/legal-document-versions.test.ts" --exclude "**/access-request-limit.postgres.test.ts"` | ✅ exit 0 — `Test Files 388 passed (388)` / `Tests 4350 passed \| 1 skipped (4351)` — ver §5: a 2ª exclusão **não** é permanente |
| Fronteira/paridade/compositor | `npm.cmd test -- --run src/lib/lab/bench/__tests__/bench-import.contract.test.ts src/lib/lab/bench/__tests__/form-parity.contract.test.ts src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts` | ✅ exit 0 — `3 passed (3)` / `98 passed (98)` |
| Isolamento/architecture-guard/branding/snapshot/API/UI | `npm.cmd test -- --run src/lib/lab/__tests__/lab-isolation.contract.test.ts src/lib/ai/__tests__/architecture-guard.test.ts src/lib/lab/bench/__tests__/resolve-bench-brand-color.test.ts src/lib/lab/bench/__tests__/branding-service.test.ts src/lib/lab/bench/__tests__/campaign-snapshot.test.ts src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"` | ✅ exit 0 — `7 passed (7)` / `183 passed (183)` |

**Testes próprios da fase executados (todos verdes):**

- `src/lib/lab/bench/__tests__/bench-import.contract.test.ts` (fronteira/importação — negativos)
- `src/lib/lab/bench/__tests__/form-parity.contract.test.ts` (paridade do formulário)
- `src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts` (compositor/preflight)
- `src/lib/lab/bench/__tests__/resolve-bench-brand-color.test.ts` (resolução cromática)
- `src/lib/lab/bench/__tests__/branding-service.test.ts` (branding local)
- `src/lib/lab/bench/__tests__/campaign-snapshot.test.ts` (snapshot fiel)
- `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` (API)
- `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx` (UI)
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` (isolamento)
- `src/lib/ai/__tests__/architecture-guard.test.ts` (gates arquiteturais)

**Nenhuma chamada real de IA:** os testes usam fakes/mocks/adapters gravadores; os próprios
testes afirmam ausência de rede a provider — `prompt-composer.contract.test.ts` verifica que o
compositor não contém `fetch(`; `bench-import.contract.test.ts` verifica que o comando não
referencia `OPENAI_API_KEY`/`GEMINI_API_KEY`; `architecture-guard.test.ts` é gate estático contra
`new OpenAI(`/`new GoogleGenerativeAI(`/`chat.completions.create(`. **Nenhum `usage` real, nenhum
crédito, nenhuma chamada paga** em implementação/testes/CI.

---

## 4. Produção intocada — comparativo `base..HEAD` (Task 3)

> Preenchido na **Task 3**, após o CHECKPOINT B. `BASE = 73ece00fd54d72af1bd48c23a8458694ed1bd636`
> (lido da linha `Base SHA` acima; **não** recriado). Comando:
> `git diff --name-only $BASE..HEAD -- <caminhos produtivos>` (vazio esperado).

⏳ pendente (Task 3).

---

## 5. Exceções externas preexistentes (registradas, não corrigidas)

1. **F50 (externa à fase):** `src/lib/legal/__tests__/legal-document-versions.test.ts` → `ENOENT`
   do caminho antigo da change arquivada da F50. **Não corrigida** nesta fase; follow-up externo.
   Excluída explicitamente do gate via `--exclude` — **não** é sucesso silencioso.
2. **NÃO é exceção permanente — resolvido por limpeza de estado:** `src/lib/__tests__/access-request-limit.postgres.test.ts`
   (F50, commit `9c017ad8`) falhava por **poluição do Postgres local** deixada por execuções
   anteriores da própria suíte (6 linhas órfãs `approved-0..5-*@example.test`, somadas ao limite de 50).
   Após limpar essas linhas, o teste passa **6/6 em isolamento** (2026-09-29) e **não** deve ser
   excluído permanentemente do gate. A exclusão usada na Task 1 foi **workaround temporário**.

**Nota de flakiness (não é exceção):** os testes de integração Postgres (`access-request-limit`,
`data-subject-requests`, `operation-cost-service`, `credit-f50-11`) são sensíveis à concorrência do
runner: sob carga (suíte completa em paralelo) podem estourar timeout/contensão de DB, mas passam
em isolamento. Recomenda-se rodar o gate final com paralelismo reduzido (ou por arquivo) para evitar
falso-negativo. **Somente `legal-document-versions.test.ts` é exceção externa permanente.**

---

## 6. Conclusão

⏳ Pendente: seções 4 (produção intocada `base..HEAD`) e o resultado do CHECKPOINT B/UAT são
preenchidos na Task 3, condicionados à aprovação humana do CHECKPOINT B. A fase **NÃO** é
marcada como concluída antes disso.

---

*Fase: 48.2.3-fidelidade-experimental-bancada. Verificação iniciada pela Task 1 (gates). Produção intocada pendente de confirmação `base..HEAD` na Task 3; UAT/CHECKPOINT B conduzido pelo humano.*
