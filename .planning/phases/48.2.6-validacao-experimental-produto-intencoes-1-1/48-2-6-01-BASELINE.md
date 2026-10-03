# F48.2.6 — Baseline e mapa de fronteiras

## Identificação

- **BASE_SHA:** `5fb863e91f42e5daa218f5918f0b78afa31ec0c8`
- **Machine-readable BASE_SHA:**
  `BASE_SHA: 5fb863e91f42e5daa218f5918f0b78afa31ec0c8`
- **Branch:** `feature/fase-48-2-6-validacao-experimental-produto`
- **HEAD no registro:** igual ao BASE_SHA.
- **Working tree inicial da execução:** alterações documentais de OpenSpec/GSD revisadas pelo responsável; nenhuma alteração funcional da fase.
- **Fonte normativa:** OpenSpec `fase-48-2-6-validacao-experimental-produto-intencoes-1-1`, design D1–D6, tasks e specs ativos.

## Contratos atuais confirmados

- **Selo:** `BADGE_OPTIONS_BY_INTENT` em `src/lib/constants.ts` é a autoridade das opções. `form-rules.ts` valida selo obrigatório em Oferta e opções válidas por intenção; não modificar lista nem permissões.
- **Intenção na bancada:** `src/lib/lab/bench/domain/form-rules.ts` exporta hoje `inferIntent` e `availableIntents`, replicadas do hook produtivo. `src/lib/lab/bench/__tests__/form-parity.contract.test.ts` compara a inferência com `use-campaign-form.ts` e cobre as opções existentes.
- **Decisão aprovada para a fase:** extrair somente os helpers puros de intenção/opções para `src/lib/lab/bench/domain/intent-options.ts`; preservar exports/signatures de `form-rules.ts` por wrappers. O helper extraído não importa `form-rules.ts` e não cria ciclo. A UI/schema/backend usarão a autoridade comum da bancada; o hook produtivo será leitura de referência nos testes e permanecerá intocado.
- **Matriz a implementar:** `de+por → offer`; somente `por → offer|spotlight`; sem ambos → `spotlight|exclusive`; preço original positivo sem preço por é estado inválido. Zero/ausência contam como não informado. Incompatibilidade explícita não é reinterpretada.
- **Schemas:** `BenchProductSchema` e `BenchOfferSchema` em `src/lib/lab/bench/domain/schemas.ts` validam atualmente estrutura/shape; preço e intenção ainda não têm refinamento de consistência; `validUntil`/`validity` são opcionais no shape.
- **Snapshot:** `src/lib/lab/bench/domain/campaign-snapshot.ts` aceita intenção explícita, senão resolve Oferta; constrói briefing pelos mappers existentes de `src/lib/campaign/brief`. Não persiste nem chama provider.
- **Compose:** `src/app/api/admin/laboratorio/bancada/compose/route.ts` aplica guards `requireAdmin → assertLabEnvironment → valida storeId → assertBenchTestStore` antes da leitura de branding; faz parse estrutural, composição determinística, sem provider.
- **Runs:** `src/app/api/admin/laboratorio/bancada/runs/route.ts` exige confirmação, faz parse, valida evidência/preflight, resolve manifesto e configuração, e só então persiste/CAS; a execução usa runtime da bancada. Preservar ordem de guards, CAS single-run, ausência de retry/batch e prompt aprovado byte a byte.
- **Preflight:** `src/lib/lab/bench/domain/preflight-revalidation.ts` recompõe e compara texto/evidência existente; preset/modelo/qualidade são configuração de execução e não invalidam, isoladamente, o texto aprovado.
- **Config/policies:** `config-registry.ts` habilita atualmente Oferta e mantém Destaque/Exclusivo e outros recortes disabled com motivo. `policies/registry.ts` é versionado, puro e atualmente indexado por uma política por dimensão.
- **Credencial bench:** `src/lib/lab/bench/gateway/bench-api-key.ts` usa somente `OPENAI_BENCH_API_KEY`, sem fallback produtivo e com erro sanitizado.
- **Pricing:** `src/lib/lab/bench/domain/bench-pricing.ts` é módulo puro, local e versionado por preset completo; não deve ser alterado.

## Arquivos e cobertura existentes

Inventário de caminhos reais confirmados e arquivos de teste relevantes:

- Paridade da bancada contra produção: `src/lib/lab/bench/__tests__/form-parity.contract.test.ts`.
- Snapshot: `src/lib/lab/bench/__tests__/campaign-snapshot.test.ts`.
- Registry de dimensões/policies: `src/lib/lab/bench/__tests__/config-registry.test.ts`, `prompt-policy.contract.test.ts`.
- Preflight: `src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts`.
- API administrativa: `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts`.
- UI da bancada: `src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx`.
- Segurança/single-run/chave: `bench-boundary.contract.test.ts`, `bench-concurrency.contract.test.ts`, `bench-api-key.contract.test.ts`, `bench-run-service.test.ts`.
- Lacunas confirmadas para esta change: testes tabulares da nova matriz; rejeições schema/snapshot incluindo validade incompatível; escolha explícita e invalidação comercial na UI; recusas API por payload incompatível com zero persistência/provider; policies versionadas para as três intenções.
- Configuração de validação: `npm test` (`vitest run`), `npm run typecheck`, `npm run lint`, `npm run build`; nenhuma dependência nova prevista.

## Fronteiras protegidas

Proibido alterar durante a fase: `src/components/flow/**`; `src/app/api/campaign/generate/**`; `src/lib/campaign/**` (incluindo mappers produtivos); `src/lib/credit/**`; `src/lib/ai/adapters/**`; `src/lib/ai/model-registry.ts`; `src/lib/lab/gateway/**`; `src/lib/lab/bench/gateway/**`; `src/lib/lab/bench/execution/**`; `src/lib/lab/bench/domain/bench-pricing.ts`; `src/lib/store-identity-service.ts`; `prompts/**`; tabelas/banco; `supabase/migrations/**`.

Permitido: bounded context `src/lib/lab/bench/domain/**` (exceto pricing), componentes/rotas da bancada, testes e artefatos documentais da fase. `form-rules.ts` fica no bounded context da bancada; somente os exports de intenção/opções delegam ao novo helper, mantendo os demais comportamentos e paridade.

## Comprovação inicial de não mudança

- `git diff --name-status BASE_SHA..HEAD -- <fronteiras protegidas>`: vazio.
- `git status --short --untracked-files=all -- <fronteiras protegidas>`: vazio, incluindo `supabase/migrations/**` não rastreadas.
- Diff documental de planejamento/OpenSpec em andamento não toca fronteiras protegidas.
- Registrar novamente, em separado, `BASE_SHA..HEAD` e `BASE_SHA → worktree final` no Plano 07. Qualquer alteração protegida atribuível à fase bloqueia CHECKPOINT A.

## Limites operacionais

- Nenhuma leitura remota, consulta/sondagem de provider, chamada de provider, geração paga ou `db push`.
- CHECKPOINT A é obrigatório após gates/security do Plano 07; não avançar aos Planos 09–10 antes de aprovação humana.
- A aprovação no CHECKPOINT A não autoriza geração nem despesa; cada run futuro exigiria ação e confirmação financeira individual pelo usuário.
