# F48.2.6 — Gates técnicos antes do CHECKPOINT A

## Escopo e estado

- **BASE_SHA:** `5fb863e91f42e5daa218f5918f0b78afa31ec0c8`
- **HEAD verificado:** após execução do Plano 07.
- **Modo:** validação offline; sem provider real, geração paga, `db push`, consulta remota ou credencial real.
- **Resultado:** gates focados, typecheck, lint, build e fences protegidas aprovados.

## Testes direcionados

| Comando | Resultado |
|---|---|
| `npm.cmd test -- --run src/lib/lab/bench/__tests__/bench-boundary.contract.test.ts src/lib/lab/bench/__tests__/bench-concurrency.contract.test.ts src/lib/lab/bench/__tests__/bench-api-key.contract.test.ts src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` | PASS — 4 arquivos, 149 testes. Inclui guards de acesso, isolamento/chave, API, recusas e CAS. O teste de fronteira usa gravação em memória, mock de custo e fetch fail-fast; guard confirmou zero fetch. |
| `npm.cmd test -- --run src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` | PASS — 24 testes; `resolveAiCost` determinístico e assert global de zero fetch. |
| `npm.cmd test -- --run src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts` | PASS — 17 testes, incluindo preço alterado produzindo composição stale e bytes aprovados persistidos/enviados sem transformação. |
| `npm.cmd test -- --run src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts src/lib/lab/bench/__tests__/prompt-base.contract.test.ts src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts src/lib/lab/bench/__tests__/config-registry.test.ts` | PASS — 134 testes focados no Plano 06. |
| `npm.cmd test -- --run src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx` | PASS — 66 testes focados no Plano 04. |

## Gates de projeto

| Comando | Resultado |
|---|---|
| `npm.cmd run typecheck` | PASS — exit 0. |
| `npm.cmd run lint` | PASS — exit 0. |
| `npm.cmd run build` | PASS — exit 0; `check:cnae` OK; Next.js compilou e gerou 76 páginas estáticas. Aviso não bloqueante existente: plugin Next.js não detectado na configuração ESLint durante build. |
| `git diff --check` | PASS. |

## Fences de não mudança

Comandos executados em separado para `BASE_SHA..HEAD`, `BASE_SHA → worktree`, e status incluindo não rastreados:

```text
git diff --exit-code BASE_SHA..HEAD -- <fronteiras protegidas>       => exit 0, vazio
git diff --exit-code BASE_SHA -- <fronteiras protegidas>              => exit 0, vazio
git status --short --untracked-files=all -- <fronteiras protegidas>  => vazio
```

Fronteiras cobertas: `src/components/flow/**`, `src/app/api/campaign/generate/**`, `src/lib/campaign/**`, `src/lib/credit/**`, `src/lib/ai/adapters/**`, `src/lib/ai/model-registry.ts`, `src/lib/lab/gateway/**`, `src/lib/lab/bench/gateway/**`, `src/lib/lab/bench/execution/**`, `src/lib/lab/bench/domain/bench-pricing.ts`, `src/lib/store-identity-service.ts`, `prompts/**`, `supabase/migrations/**`. Tabelas/banco não foram acessados nem alterados.

- `src/lib/lab/bench/gateway/bench-api-key.ts` segue usando exclusivamente `OPENAI_BENCH_API_KEY`; sem fallback para chave produtiva.
- `src/lib/lab/bench/domain/bench-pricing.ts` segue inalterado, regra `2026-10-bench-3`.
- Nenhuma dependência instalada.

## Registro histórico — execução ampla anterior

O teste amplo anterior ao isolamento reportou quatro `fetch failed` no `bench-execution.contract.test.ts`. O log não contém hostname/porta e o destino histórico permanece **não determinado**. Não registrar como leitura remota confirmada nem como acesso exclusivamente local. Correção de teste `15bc1ae9` mocka `resolveAiCost`, bloqueia fetch não mockado e prova zero chamadas na execução corrigida; os quatro casos afetados, o arquivo completo e contratos adjacentes passaram offline. Não houve geração/provider call.

## Conclusão

Todos os gates específicos do Plano 07 passaram após isolamento offline. CHECKPOINT A foi aprovado em 2026-10-03 apenas para a readiness local/documentação do Plano 09. Isso não autoriza paid UAT, provider, geração, leitura remota nem o Plano 10 nesta continuação.
