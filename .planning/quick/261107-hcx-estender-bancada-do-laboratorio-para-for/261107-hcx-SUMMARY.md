---
id: 261107-hcx
title: Estender a bancada do laboratório para 9:16 e comparar o modelo atual com gpt-image-2.6-sunburst
status: incomplete
checkpoint: B-ready
date: 2026-11-07
branch: feat/quick-extensao-laboratorio-9-16
---

# CHECKPOINT A — implementação e testes locais sem provider

> **Quick não concluída como integralmente validada.** O CHECKPOINT B
> (ativação local, cadastro eventual e primeiras chamadas pagas) permanece
> pendente de autorização específica de ambiente, matriz e orçamento. Nenhuma
> chamada paga foi executada, nenhum ambiente/banco/catálogo foi alterado e o
> preset 2.6 permanece desabilitado.

## Entregue no CHECKPOINT A

- Resolvedor interno `src/lib/lab/bench/domain/bench-format.ts`:
  `1:1` → `1024x1024`; `9:16` → `1152x2048`; dimensão/proporção exatas;
  comparação sem tolerância/resize.
- `9:16` habilitado no `config-registry`; política versionada
  `261107-formato-9-16-v1`; prompt-base `9:16` resolve o mesmo conteúdo neutro.
- Formato propagado por composição, aprovação, estimativa, execução, histórico
  e nova tentativa.
- Editor final livre preservado: editar/substituir o texto final invalida
  aprovação **e** confirmação financeira; recompor não sobrescreve a edição
  manual; botão explícito “Usar texto compilado”.
- `gpt-image-2.6-sunburst` incluído apenas em `BENCH_MODEL_ALLOWLIST`,
  `BENCH_PRESETS` e `BENCH_PRICING_ENTRIES`; preset
  `gpt-image-2.6-sunburst-medium` desabilitado com motivo
  `checkpoint_b_pendente`.
- Pricing local na regra `2026-11-bench-4`: tarifas 5/8/30 para o 2.6 e entradas
  `9:16`; nenhuma estimativa de tokens de saída inventada.
- `complexity` **não** foi enviado.
- `maxRetries: 0` somente no `BenchImagesAdapter`.
- Validação técnica com `expectedWidth`/`expectedHeight` opcionais e alerta
  `dimensions_mismatch`; `executeBenchRun` falha com
  `bench_dimensions_mismatch`, sem resize e persistindo `usage`, custo
  disponível e dimensões reais na falha.
- UI: seletor de formato funcional, tamanho efetivo exibido, evidência com
  formato/tamanho e dimensões reais do artefato.
- Testes novos/atualizados cobrindo regressão 1:1, wire 9:16, texto aprovado
  idêntico, ordem de referências, invalidação, histórico/repetição, dimensão
  divergente, isolamento, pricing e UI.

## Gates executados

| Gate | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` | passou |
| `npm run build` | passou |
| `git diff --check` | sem erros |
| Suíte direcionada (bancada + technical-validation + API/UI) | 798 passed, 1 skipped |

Todos os testes rodaram com fakes/`vi.mock`, sem provider e sem rede.

**Teste pulado:** `src/lib/lab/bench/__tests__/bench-import.integration.test.ts`
— integração real opt-in que exige `BENCH_IMPORT_REAL_INTEGRATION=1` e o stack
Supabase local (PostgreSQL + Storage). Não foi habilitado porque o CHECKPOINT A
não inicia stack nem acessa banco. O motivo está documentado no próprio arquivo
(linhas 15–20).

## Preservação de produção e escopo

- Nenhum arquivo de produção (`MODEL_ALLOWLIST`, pricing produtivo,
  `ai_model_selection`, `product-1-1`, `product-vertical-9-16`, engine ou
  compositor produtivo) foi alterado.
- Nenhum `package.json`/lockfile alterado.
- Nenhuma migração de produção, bootstrap, stack, schema, catálogo ou chamada
  paga.
- Nenhum fallback para credenciais produtivas; `OPENAI_BENCH_API_KEY`
  permanece a única fonte do adapter da bancada.

## Ajustes pós-revisão (antes do CHECKPOINT B)

- **Estimativa atrasada:** o painel de execução descarta respostas de revisões
  antigas (request id + revisão efetiva), limpa a estimativa em voo ao trocar a
  configuração e exige, na confirmação, que a revisão estimada seja a atual.
  Coberto por teste de resposta atrasada.
- **Nome do editor:** “Prompt compilado” passou a “Prompt final (editável)” no
  título e no editor; o bloco somente leitura do compilado virou “Prompt
  compilado (referência)”. Testes de rótulo atualizados.

## Limitações e ressalvas

1. A aceitação efetiva de `1152x2048` pelo `gpt-image-2.6-sunburst` **não** foi
   comprovada; apenas a geometria documentada. A prova depende do CHECKPOINT B.
2. O ambiente local não foi verificado nesta etapa; `supabase status` falhou
   para o container padrão, o que não prova indisponibilidade do ambiente da
   F59. Nenhum stack foi iniciado.
3. `complexity` foi omitido; o default documentado do 2.6 é `high`. Não se
   afirma que fixar `medium` seria necessariamente mais justo.
4. Estimativas de saída para `medium`/`9:16` e para o 2.6 permanecem ausentes e
   são exibidas como indisponíveis, nunca como zero. Não há hard cap financeiro.
5. Nenhum cadastro em `ai_model_catalog` foi feito; o runtime não consulta o
   validador de catálogo.
6. O rótulo acessível do editor final permaneceu “Prompt compilado” para
   preservar o contrato de UI existente; o hint agora explicita que o texto é o
   prompt final editável e pode ser substituído integralmente.

## CHECKPOINT B — preparação e validação (sem chamadas pagas)

Data: 2026-11-07. Ambiente existente: Docker Compose `vendeo-homolog`
(API `127.0.0.1:57781`, Postgres `127.0.0.1:57782`).

- `VENDEO_LAB_ENABLED=true` definido no `.env.local`.
- `OPENAI_BENCH_API_KEY` preenchida pelo responsável (valor não lido/registrado).
- `supabase/lab/bench-schema.sql` aplicado no DB do `vendeo-homolog`:
  `lab_bench_runs`, `lab_bench_artifacts` e `lab_bench_store_imports` presentes;
  índice global de geração ativa e policies criados.
- Preset `gpt-image-2.6-sunburst-medium` habilitado na bancada.
- Nenhum cadastro em `ai_model_catalog`; nenhuma alteração de produção; nenhum
  stack novo.

Validação executada sem confirmar geração:

- acesso administrativo e página da bancada (`200`);
- loja Padaria da Esquina materializada e assinatura visual ativa;
- upload de 2 referências em `draft` (`runId` de validação
  `bde8c90b-42f6-4c8e-aacb-b3e83fd150ec`, 2 artefatos de entrada, 0 saídas);
- composição `9:16` com o preset 2.6 (`compiledPrompt` de 2.648 caracteres,
  `policyVersions.formato = 261107-formato-9-16-v1`);
- estimativa 2.6/9:16 retornando `size=1152x2048`, cobertura `partial` e
  `estimatedUsd=null` (sem valor inventado);
- gate de aprovação com composição divergente retornando `409
  approval_invalidated` antes de qualquer chamada paga;
- `POST /runs` sem `confirmed: true` retornando `422 confirmation_required`.

**Ainda não executado:** as 4 chamadas pagas da matriz e a confirmação
financeira. Nenhum run saiu de `draft`, nenhum `usage`/custo foi gerado.

**Servidor Next local:** em execução em `http://localhost:3000`; bancada
disponível em `http://localhost:3000/admin/laboratorio/bancada`.

## Próximo passo

Bancada pronta para as chamadas pagas. Restante, somente após autorização
específica de gasto:

1. confirmar a matriz de 4 chamadas (2 modelos Sunburst `medium` × 2 formatos);
2. confirmar o prompt/referências e a referência conservadora de US$ 1,00;
3. executar uma chamada por vez, registrando dimensão retornada, `usage`, custo
   calculado e custo reportado (se houver), com a regra de parada acordada.

A quick **não** está integralmente validada: nenhuma chamada paga foi feita.
