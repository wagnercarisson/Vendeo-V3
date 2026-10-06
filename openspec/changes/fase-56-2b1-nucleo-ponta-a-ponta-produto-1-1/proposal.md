## Why

A **F56.2a** (proposta, 0 tasks) define os contratos, componentes e estruturas **inativos** do novo fluxo Produto 1:1. A **F56.2b1** é a integração operacional de **núcleo**, fechando **junto** roteamento, geração, snapshot/histórico, crédito transacional, arte e download — porque uma arte baixável sem o contrato transacional de cobrança **não é uma entrega segura**. Nesta fatia as chaves permanecem **desligadas**.

Ela **depende explicitamente da F56.2a**. O botão de nova tentativa de copy, os testes integrados/E2E e o piloto controlado ficam na **F56.2b2**; aprovação/reprovação e correção permanecem na **F56.3**.

## What Changes

- **Roteamento server-side efetivo e controles administrativos auditados** (sobre a estrutura da F56.2a). Chave geral prevalece; falha de leitura mantém o legado sem reinterpretar campos novos do formulário como legados. O download é decidido pelo **fluxo persistido** da campanha.
- **Formulário conectado** com intenção (Oferta/Destaque/Exclusivo) e fundo (Estúdio/Ambientado/Original), validação server-side (Original exige exatamente uma imagem de produto; erro de campo, não `IMG-001`).
- **Composição versionada e orquestração real:** consome a composição da F56.2a e o par modelo–qualidade (F56.1); preflight de pricing `complete` para principal e fallback; política de tentativas (2+1); telemetria por tentativa; `IMG-001` + referência opaca com diagnóstico durável; sem revisor automático.
- **Snapshot e histórico operacionais:** snapshot persistido no início; histórico append-only por tentativa, vinculado à campanha e ao snapshot original, sem sobrescrever o run/trace.
- **Crédito transacional com máquina de estados durável** (`reserva → upload → entrega/estorno`): uma campanha entregue custa **um** crédito; falha técnica sem arte utilizável **não debita**. Idempotência por `campaignId + operation_id`, concorrência, detecção de operação interrompida e reconciliação agendada/manual. **Sem crédito corretamente resolvido, a arte não é considerada entregável.**
- **Arte 1024×1024 e download direto:** persistida em `campaign-images` com prefixo próprio e caminhos imutáveis, com dimensões reais; download direto sem revisor automático nem aprovação/reprovação.
- **Copy não bloqueia a entrega:** em falha da copy, a arte permanece baixável com o único débito e o **estado de falha é persistido**. Nesta fatia **não** há botão de nova tentativa (F56.2b2).
- **Legado integralmente preservado.** Chaves desligadas por padrão.

**BREAKING:** nenhuma.

## Capabilities

### New Capabilities

- `product-1-1-generation-orchestration`: geração real com preflight, execução da política de tentativas, telemetria por tentativa e `IMG-001` + diagnóstico durável, sem revisor automático.
- `product-1-1-campaign-credit-billing`: cobrança de um crédito por campanha entregue e **máquina de estados durável de reserva → upload → entrega/estorno** com idempotência, concorrência e reconciliação.
- `product-1-1-artifact-delivery`: persistência 1024×1024 com dimensões reais e download direto, preservando as regras de download das campanhas antigas.
- `product-1-1-copy-recovery`: entrega **não bloqueada** por falha de copy e **persistência do estado de falha** (sem a ação de nova tentativa, que é da F56.2b2).

### Modified Capabilities

- `product-1-1-flow-activation`: roteamento efetivo, controles administrativos auditados, rollback e download por fluxo persistido (depende da F56.2a).
- `product-1-1-intent-background-selection`: montagem no formulário de produção e validação server-side efetiva (depende da F56.2a).
- `image-generation-config-snapshot`: persistência operacional no início da campanha real e registro append-only por tentativa (depende da F56.2a).
- `image-generation-failure-policy`: execução sobre geração real e enforcement transacional de não-cobrança.
- `image-generation-support-reference`: produção e persistência reais do `IMG-001` + referência e correlação no admin/suporte.
- `image-generation-model-pair-config`: preflight de pricing completo e congelamento da configuração vigente por campanha na execução.
- `image-generation-instrumentation`: envelope e custo por tentativa no caminho de produção, preservando a contabilidade legada.

## Critérios de Aceite Verificáveis

1. Chaves desligadas (ou falha de leitura) → legado idêntico; chave de lojas de teste → só `is_test_store=true`; chave geral prevalece.
2. Formulário transporta intenção e fundo; Original rejeitado no servidor sem exatamente uma imagem de produto (identidade não conta), como erro de campo.
3. Execução só com preflight `complete` para principal **e** fallback; 2 tentativas no principal + 1 no fallback; `rate_limit` transitório; quota/faturamento sem fallback; telemetria por tentativa.
4. Falha operacional produz `IMG-001` + referência, sem vazar motivo interno, com diagnóstico durável.
5. **Um crédito por campanha entregue**; falha sem arte utilizável não debita; reserva/entrega/estorno idempotentes e reconciliáveis; **nenhuma arte é considerada entregável sem o crédito resolvido**.
6. A máquina de estados cobre interrupções em cada fronteira (reserva→upload, upload→entrega, entrega→confirmação) com transições idempotentes e reconciliação segura (arte persistida ⇒ entrega; ausente ⇒ estorno).
7. Arte 1:1 1024×1024 com dimensões reais; prefixo próprio/imutável; download direto; campanhas antigas mantêm regras e a F37 não governa o novo fluxo.
8. Só a copy falhando: arte baixável com o único débito e **estado de falha persistido**; **sem** botão de nova tentativa nesta fatia.
9. Snapshot no início; append-only por tentativa; reuso na mesma campanha; run/trace histórico não sobrescrito.
10. Nenhuma chamada paga por testes/CI; `db push`/deploy/abertura geral fora desta proposta; geração paga só em F56.2b2 com autorização humana específica.

## Dependência explícita

Depende da **F56.2a** (contratos/componentes/estruturas inativos). Não duplica requisitos: a F56.2a especifica o componente/estrutura; a F56.2b1 especifica a integração operacional.

## Fronteira com a F56.2b2 e a F56.3

- **F56.2b2:** botão e controles da ação "Tentar gerar copy novamente", testes integrados/E2E e piloto controlado; só então avaliar habilitar lojas de teste.
- **F56.3:** aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas.

## Migração e Compatibilidade

- **Aditivo e atrás de chave.** Legado é o default; rollback = desligar a chave.
- **Ordem.** (1) local em instância isolada; (2) testes transacionais; (3) migration remota/deploy em etapa posterior autorizada. Geração paga e piloto ficam na F56.2b2.
- **Rollback.** Desligar a chave; campanhas existentes preservam o fluxo persistido.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit ou deploy antes da aprovação do responsável.

## Impact

- **Banco (migration [BLOCKING])**: consumo operacional do snapshot/append-only; estado de operação (reserva/upload/entrega/estorno) com identidade `campaignId + operation_id`; dimensões reais da arte; estado de copy pendente/falha.
- **Código novo**: orquestrador real, roteamento efetivo, máquina de estados de crédito + reconciliação, persistência/download do novo fluxo.
- **Código alterado (aditivo)**: `src/app/api/campaign/generate-image/route.ts` (ramo novo), formulário/`use-campaign-form.ts`, serviço de crédito (idempotência), download (novo fluxo direto; legado intacto).
- **Design**: `openspec/design-system/MASTER.md`; saída **1024×1024** (divergindo do 1080×1080 genérico).
- **Reconciliação**: integra a change original `fase-56-2-novo-fluxo-geracao-produto-1-1` (relocada para `openspec/changes/archive/2026-10-06-fase-56-2-novo-fluxo-geracao-produto-1-1/`; ver `RECONCILIATION.md`).
- **Validação**: typecheck, lint, build, testes locais/transacionais e `openspec validate --strict`; sem chamada paga.
