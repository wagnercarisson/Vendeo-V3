# F48.2.4 — Verificação da Fase (Experimento determinístico Oferta 1:1)

> Arquivo **iniciado** pelo Plano `48-2-4-09` (Task 1 — gates). O **SHA base** foi capturado no
> início da execução da fase (Plano `48-2-4-01`) e é a referência para o encerramento (Task 4)
> comparar `base..HEAD` — não apenas o working tree.
>
> **Status deste arquivo:** ✅ **FINAL — FASE CONCLUÍDA** (2026-09-30). Gates verdes (Supabase local
> ativo; exceção externa `legal` registrada). **CHECKPOINT A** e **CHECKPOINT B** **aprovados**
> (técnico + comercial/visual). Produção intocada comprovada por `base..HEAD` (§6). **Task 4
> (closeout) executada.** OpenSpec **ATIVO** (verify/sync/archive manuais do responsável).

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
| 1 | typecheck, lint, build e a suíte completa passam; nenhum teste faz chamada real de IA | §3 | ✅ **verde no ambiente atual** |
| 2 | CHECKPOINT A (humano) revisa políticas/branding/ordem das imagens/revalidação **antes de qualquer chamada paga** | §4 / `48.2.4-UAT.md` | ✅ **aprovado** |
| 3 | CHECKPOINT B (humano) executa o UAT manual completo (técnico + comercial/visual) | `48.2.4-UAT.md` | ✅ **aprovado** — técnico **8/8**; comercial/visual: Flare low `requer ajuste`, Sunburst low `aprovado com follow-up` |
| 4 | O UAT pago exige autorização humana explícita; recusa ⇒ fase NÃO concluída | `48.2.4-UAT.md` | ✅ autorização explícita registrada; **CHECKPOINT B aprovado** |
| 5 | Produção intocada por `base..HEAD`; base ausente ⇒ falha | §6 | ✅ **`base..HEAD` vazio**; `supabase/migrations` limpo |
| 6 | `48-2-4-VERIFICATION.md` e `48.2.4-UAT.md` gerados; nenhum provider autônomo | este arquivo + `48.2.4-UAT.md` | ✅ ambos gerados; provider autônomo = 0 |

---

## 3. Gates automatizados

Executados com `npm.cmd` (exit code real; o shim `npm` no PowerShell não propaga `$LASTEXITCODE`
de forma confiável). Data: 2026-09-30. **Reexecutados no ambiente atual (Supabase local ativo).**

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ exit 0 |
| Lint | `npm.cmd run lint` | ✅ exit 0 (0 warnings) |
| Build | `npm.cmd run build` | ✅ exit 0 |
| Suíte completa (só exceção externa `legal`; `--testTimeout=60000`) | `npm.cmd test -- --exclude "**/legal-document-versions.test.ts" --testTimeout=60000` | ✅ exit 0 — `Test Files 398 passed \| 1 skipped (399)` / `Tests 4609 passed \| 2 skipped (4611)` |
| Testes próprios da fase (política/compositor/prompt-base/branding/identidade/transporte/revalidação/histórico/adapter/execução/API/UI/isolamento/gate/chave/pricing) | `npm.cmd test -- --run --testTimeout=60000 <arquivos>` | ✅ exit 0 — todos verdes (incl. uploader principal+adicionais, `bench-api-key`, pricing v2) |

**Ambiente do run verde:** Supabase local **ativo** (`http://127.0.0.1:54321/rest/v1/` → HTTP 200) e
`VENDEO_LAB_ENABLED=true` em `.env.local`. Com o Postgres local disponível, as **6 suites de integração
de DB** que antes falhavam por `ECONNREFUSED 127.0.0.1:54322` **passaram** — a suíte completa agora fica
verde excluindo **apenas** a exceção externa preexistente `legal-document-versions.test.ts` (`ENOENT`).
As mensagens `Not implemented: navigation to another Document` / `Window's scrollTo()` são ruído do
jsdom, **não** falhas.

**Observação sobre o `--testTimeout`:** os flakes de 5 s preexistentes e já registrados nos planos
05 e 08 (`bench-execution.contract.test.ts` — processamento de imagem `sharp` + fetch ao Supabase
local) são absorvidos com `--testTimeout=60000`. Nenhum arquivo de produção/teste foi alterado para
contornar o timeout.

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
   explicitamente do gate via `--exclude` — **não** é sucesso silencioso. **Permanece registrada.**
2. **Suites de integração de DB — RESOLVIDAS no ambiente atual.** No primeiro run do gate (Docker/Postgres
   local ausente) 6 suites de integração de crédito/access-request/dados pessoais falhavam por
   `ECONNREFUSED 127.0.0.1:54322`:
   - `src/lib/__tests__/access-request-limit.postgres.test.ts`
   - `src/lib/__tests__/data-subject-requests.postgres.test.ts`
   - `src/lib/credit/__tests__/credit-concurrency.test.ts`
   - `src/lib/credit/__tests__/credit-f50-11-integration.test.ts`
   - `src/lib/credit/__tests__/credit-idempotency.test.ts`
   - `src/lib/credit/__tests__/operation-cost-service.integration.test.ts`

   Com o **Supabase local ativo** (`127.0.0.1:54322`), essas suites **passaram** no gate atual (§3,
   linha 4). Não pertencem à F48.2.4 e não foram tocadas por esta fase; o bloqueio era **ambiental**
   (Docker/Postgres ausente), não regressão de código. **Nenhuma exclusão adicional é necessária** —
   a suíte completa roda excluindo **apenas** a exceção externa `legal`.

---

## 6. Produção intocada — comparativo `base..HEAD` (Task 4 — executada)

`BASE = f5a7fe9a27e823b64b355ec8c431d4e514d5ab99` (lido da linha `Base SHA` acima; **não** recriado).

Comando executado no encerramento:
`git diff --name-only $BASE..HEAD -- src/components/campaign/types.ts src/lib/store-identity-service.ts src/lib/image-generation/services/art-director-briefing.ts src/lib/ai/adapters/images.ts src/lib/ai/adapters/registry.ts src/lib/ai/model-registry.ts src/lib/ai/api-keys.ts src/lib/ai-cost/cost-estimator.ts src/components/flow prompts supabase/migrations src/lib/campaign src/app/api/campaign`

**Resultado:** ✅ **vazio** (nenhum caminho produtivo alterado). `git status --porcelain supabase/migrations`
→ **limpo**; nenhum `supabase db push` executado. A prova é **temporal** (`base..HEAD`), não um
congelamento de conteúdo. `HEAD` do encerramento: `b85115cac1790658c5d7b3b7f9f6fe21888f3157`
(53 commits na fase). Nenhum uso de credencial/comando remoto; nenhuma promoção; nenhum crédito.

---

## 7. Checkpoints humanos

| Checkpoint | Plano/Task | Conteúdo | Status |
|---|---|---|---|
| **A** | 48-2-4-09 / Task 2 | Revisão de políticas/versões, mapeamento de branding, ordem das imagens + resolução de identidade, revalidação do preflight e `prompt_sent` byte a byte — **antes de qualquer chamada paga**. Autoriza o número de gerações reais do UAT. | ✅ **APROVADO** (env prep + CHECKPOINT B; 1 geração manual) |
| **B** | 48-2-4-09 / Task 3 | UAT manual completo (técnico sem provider + comercial/visual humano por geração); decisão aprovado/rejeitado/requer ajuste. | ✅ **APROVADO** — técnico **8/8**; comercial/visual registrado (Flare low `requer ajuste`; Sunburst low `aprovado com follow-up`) |

Detalhamento em `.planning/phases/48.2.4-experimento-deterministico-oferta-1-1/48.2.4-UAT.md`.

---

## 8. Conclusão final

**✅ Fase 48.2.4 CONCLUÍDA** (2026-09-30).

- `typecheck`, `lint` e `build` **verdes** (exit 0).
- Testes próprios da fase **verdes** (incl. políticas/compositor/prompt-base/branding/identidade/
  transporte/revalidação/histórico/adapter/execução/API/UI/isolamento/gate/chave/pricing).
- Suíte completa **verde** excluindo **apenas** a exceção externa `legal` — `398 passed | 1 skipped`
  / `4609 passed | 2 skipped`.
- **Nenhuma chamada real de IA** pelo executor em testes/CI (fakes/adapters gravadores + gate
  arquitetural); custo do executor **US$ 0**.
- **CHECKPOINT A APROVADO**; **CHECKPOINT B APROVADO** — técnico **8/8** e comercial/visual
  registrado (Flare low `requer ajuste`; Sunburst low `aprovado com follow-up`). As duas gerações
  reais foram **manuais** (US$ 0,03 cada), com mesmo prompt/dados/duas referências.
- **Produção intocada** (`base..HEAD` vazio; `supabase/migrations` limpo); nenhum `db push`;
  nenhuma promoção.
- **Task 4** (produção `base..HEAD` + closeout não-destrutivo de `STATE.md`/`ROADMAP.md`/
  `HANDOFF.json`) **executada**.
- **OpenSpec ATIVO** — `/opsx-verify`, `/opsx-sync` e `/opsx-archive` são **manuais do responsável**.
- **Follow-ups encaminhados à F48.2.5:** papel da imagem principal × referências; ortografia e
  integridade textual; ciclos comparativos de refinamento.

---

*Fase: 48.2.4-experimento-deterministico-oferta-1-1. Verificação **final**: gates verdes, CHECKPOINT
A e B aprovados, produção intocada (`base..HEAD` vazio) e closeout executado. Change OpenSpec ativa.*
