---
id: 261107-qvo
title: Expandir campanha pronta para 9:16 na bancada do laboratório
status: incomplete
checkpoint: A
date: 2026-11-07
branch: feat/quick-extensao-laboratorio-9-16
---

# CHECKPOINT A — implementação e testes locais sem provider

> **Quick não concluída como integralmente validada.** As chamadas pagas dos
> CHECKPOINTS B/C permanecem pendentes de autorização específica. Nenhuma
> chamada ao provider foi executada.

## Entregue

- Operação isolada **“Expandir campanha pronta”** em
  `/admin/laboratorio/bancada/expandir`, com link na bancada.
- `POST /api/admin/laboratorio/bancada/expand/runs`: uma única imagem, sem
  identidade, sem compositor comercial e com `promptApproved` explícito.
- Upload com `operation=expand` exige exatamente um arquivo.
- Geometria pura `1152×1440 → 1152×2048` (304 px acima, 304 abaixo, escala
  solicitada 1.0); largura ≠ 1152 e altura `>= 2048` são recusadas sem resize.
- Prompt próprio `261107-expand-9-16-v1`; evidência com `promptVersion` e
  `promptEdited`; sem versões do compositor comercial.
- Persistência reutilizando `lab_bench_runs`/`lab_bench_artifacts`: operação,
  origem/checksum/dimensões, destino/geometria, prompt, modelo/qualidade, usage,
  custo e resultado. Campos comerciais não usados ficam nulos.
- Original como artefato `input` independente; resultado como `output`.
- `operation` marcado no draft no upload e preservado nas novas tentativas;
  rotas comerciais recusam draft de expansão e vice-versa
  (`bench_operation_mismatch`).
- Formato `4:5` (`1152x1440`) adicionado ao fluxo comercial da bancada, com
  política própria e pricing por tamanho (sem estimativa inventada).
- UI: upload único com preview/dimensões, seletor de modelo/qualidade, painel de
  geometria solicitada, editor/aprovação, estimativa/confirmação, comparação
  original × resultado, download e histórico.
- Distinção explícita: sucesso técnico ≠ preservação visual; checksum do original
  ≠ preservação do centro.

## Correções pós-revisão

- **Replay de upload:** a rota `/inputs` agora valida autoria/estado/operação do
  run existente antes de qualquer mutação. Replay em `pending`/`running` ou
  terminal retorna `409 bench_upload_not_draft` sem finalizar o run; operação
  incompatível retorna `409 bench_operation_mismatch` sem sobrescrever
  `config`; replay de draft com a mesma operação devolve as entradas existentes
  sem remarcar/reenviar. `markBenchRunOperation` só grava quando `config` é
  nulo.
- **Troca de arquivo no upload de expansão:** selecionar outro arquivo limpa a
  entrada efetiva no pai e invalida aprovação/confirmação; respostas atrasadas
  de upload são descartadas após troca de arquivo ou de loja.

## Gates executados

| Gate | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` | passou |
| `npm run build` | passou |
| `git diff --check` | sem erros |
| Suíte direcionada (bancada + expansão + API/UI + 4:5) | 838 passed, 1 skipped |

**Teste pulado:** `src/lib/lab/bench/__tests__/bench-import.integration.test.ts`
— integração real opt-in que exige `BENCH_IMPORT_REAL_INTEGRATION=1` e o stack
Supabase local. Não foi habilitado porque o CHECKPOINT A não inicia stack.

## Limitações

1. A expansão paga de uma campanha pronta ainda não foi executada; o endpoint
   `images.edit` `1152×2048` já é usado nas gerações da bancada, mas a expansão
   de uma campanha pronta nesse caminho será provada no CHECKPOINT B.
2. Entrada 1:1 `1024×1024` do Playground é explicitamente recusada nesta versão
   (largura ≠ 1152), sem resize silencioso.
3. Qualidade de outpainting e preservação visual da campanha central não são
   avaliadas automaticamente; dependem de inspeção humana.
4. Estimativas de `medium`/`4:5`/`9:16` e do 2.6 permanecem indisponíveis até
   haver prova de tokens; custo real só após `usage`. Não há hard cap.
5. Nenhuma alteração de produção, crédito, catálogo, prompt produtivo, migration
   compartilhada, push ou deploy.

## Próximo passo

- **CHECKPOINT B:** uma expansão paga de uma imagem pronta 1152×1440, após
  autorização de orçamento.
- **CHECKPOINT C:** fluxo completo 4:5 + expansão 9:16, com duas chamadas pagas
  e autorização separada.
