# Piloto hospedado do Produto 1:1 em lojas de teste

## Why

O fluxo Produto 1:1 foi validado **apenas localmente** (homologação Docker `vendeo-homolog`), enquanto o **código em produção** está no commit `cc70e57c` (branch `main`, deploy Vercel de 2026-10-05) — ou seja, a F56 inteira **não está publicada** — e o banco de produção (`gvbzwihwgzujwsviufgy`) tem **30 migrations pendentes** e **PITR desabilitado**. Além disso, **não existe hoje caminho de habilitação para o ambiente operacional**: o único estágio habilitador aceito (`isolated_pilot`) exige ambiente `isolated` (loopback), incompatível com o hospedado.

Esta mudança propõe o **piloto hospedado restrito a lojas de teste** — a **primeira etapa** da liberação, com publicação **OFF**, provas hospedadas mínimas de recuperação e segurança, orçamento de tempo compatível com a função Vercel de 300s e critérios explícitos de parada e desligamento. Ela **não** abre lojas gerais.

## What Changes

- **Nova capacidade de piloto hospedado**: prontidão de publicação com fluxo OFF (backup **verificável**, conjunto exato de migrations, deploy, configuração, checagens do legado), execução manual restrita, orçamento de tempo, monitoramento, critérios de parada e desligamento.
- **Autorizar o estágio `test_stores` no ambiente operacional**, alinhando os três pontos que hoje bloqueiam: (a) RPC de concessão, (b) rota admin de autorização, (c) gate de gasto do piloto. **Preservar** `isolated_pilot` (local/isolado) e **manter `all_stores` bloqueado**.
- **Orçamento de tempo** compatível com a função Vercel (**teto 300s, Fluid, 2048MB, iad1**) com **margem** para persistir o estado terminal, e **tratamento honesto de resultado desconhecido**.
- **Publicação com fluxo OFF**: backup **verificável de banco e Storage** (plano Free sem backup restaurável gerenciado; não assumir WAL-G), conjunto de migrations **fixado após a implementação** — o lote inicial de 30 cresce com as novas migrations aprovadas desta mudança —, deploy e configuração do fluxo novo, com verificações de **não regressão do legado**.
- **Menor conjunto de provas hospedadas** de recuperação e segurança, **reutilizando** as provas locais existentes; **sem rota pública de simulação** e **sem que clientes escolham provider simulado**.
- **Piloto manual restrito**: orçamento, monitoramento, critérios de parada e **desligamento** (flag off + revogação).

## Capabilities

### New Capabilities

- `product-1-1-hosted-pilot`: prontidão de publicação do fluxo Produto 1:1 com fluxo OFF (backup verificável, migrations exatas, deploy, configuração, verificação do legado), execução de **piloto hospedado manual restrito a lojas de teste**, orçamento de tempo, monitoramento, critérios de parada, desligamento e separação explícita da futura abertura a lojas gerais.

### Modified Capabilities

- `product-1-1-flow-activation`: habilitar o estágio `test_stores` no **ambiente operacional** para lojas de teste (com as alterações de RPC, rota admin e gate de gasto), preservando `isolated_pilot` e mantendo `all_stores` bloqueado; ajustar os cenários de negativos e o requisito de habilitação condicionada.
- `product-1-1-controlled-real-test-authorization`: estender a autorização estreita para incluir a via `test_stores` + `test_stores` no ambiente operacional, mantendo a recusa do escopo geral e a barreira global.
- `product-1-1-generation-orchestration`: definir o **orçamento de tempo** interno compatível com o teto da plataforma (300s) com margem para persistência, o **tratamento honesto de resultado desconhecido**, e a regra de que **kill da plataforma não prova ausência de upload**.

## Impact

- **Código**: `authorization-decision.ts` (matriz estágio×ambiente×escopo), sucessora da migration `20261017000001_f56_2b2c_narrow_authorization.sql` (RPC de concessão), rota `src/app/api/admin/product-flow-authorizations/route.ts`, `pilot/resolve-pilot-spend-gate.ts` (armar `test_stores`), `launch-config`/timeout de geração e orquestração de publicação/recuperação.
- **Infra/dados**: Vercel `vendeo-v3` (plano **hobby**, Fluid `true`, `functionDefaultTimeout=300`, 2048MB, região `iad1`); Supabase produção `gvbzwihwgzujwsviufgy` (30 migrations pendentes; `pitr_enabled=false`, `walg_enabled=true`).
- **Fora de escopo (não implementado nesta mudança)**: abertura a lojas gerais (`all_stores`), aprovação/reprovação/correção de arte (F56.3), remoção do fluxo legado, rota pública de provider simulado.
