---
id: 261107-hcx
title: Estender a bancada do laboratório para 9:16 e comparar o modelo atual com gpt-image-2.6-sunburst
status: incomplete
checkpoint: A
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
| Suíte direcionada (bancada + technical-validation + API/UI) | 797 passed, 1 skipped |

Todos os testes rodaram com fakes/`vi.mock`, sem provider e sem rede.

## Preservação de produção e escopo

- Nenhum arquivo de produção (`MODEL_ALLOWLIST`, pricing produtivo,
  `ai_model_selection`, `product-1-1`, `product-vertical-9-16`, engine ou
  compositor produtivo) foi alterado.
- Nenhum `package.json`/lockfile alterado.
- Nenhuma migração de produção, bootstrap, stack, schema, catálogo ou chamada
  paga.
- Nenhum fallback para credenciais produtivas; `OPENAI_BENCH_API_KEY`
  permanece a única fonte do adapter da bancada.

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

## Próximo passo

CHECKPOINT B, somente após autorização específica:

1. localizar o ambiente existente da F59 e conferir os alvos em read-only;
2. confirmar schema/bucket e, se faltar schema da bancada, aplicar apenas
   `supabase/lab/bench-schema.sql` (idempotente);
3. confirmar `OPENAI_BENCH_API_KEY` e `VENDEO_LAB_ENABLED=true`;
4. habilitar o preset 2.6;
5. executar a matriz de 4 chamadas (2 modelos Sunburst `medium` × 2 formatos),
   uma por vez, com orçamento/referência conservadora previamente definidos.

Parar para revisão antes do CHECKPOINT B. A quick **não** está integralmente
validada.
