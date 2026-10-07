## Why

A F56.2 foi proposta como fatia única, mas o recorte excede o limite operacional de 8–10 planos e mistura preparação não operacional com integração ponta a ponta. Reconciliar em **F56.2a** (preparação não operacional), **F56.2b1** (núcleo ponta a ponta) e **F56.2b2** (copy recuperável e piloto) reduz risco, permite validar contratos e estruturas sem tocar geração, provider, crédito, entrega ou download, e impede que uma chave incompleta encaminhe campanhas reais.

A F56.2a existe para entregar **contratos, componentes e estruturas inativos** do novo fluxo Produto 1:1 — seletores de intenção/fundo, composição produtiva versionada dos prompts aprovados na F48.2.6, estruturas de snapshot e histórico append-only, e o registro das duas chaves desligadas por padrão — com testes de equivalência e de decisão server-side, **sem** expor ao lojista nem permitir ativação de um caminho incompleto.

## What Changes

- **Contratos e componentes dos seletores de intenção e fundo.** Oferta/Destaque/Exclusivo e Fundo de estúdio/Cenário ambientado/Manter cenário original como domínio puro e componentes, com a regra de **Original exigindo exatamente uma imagem de produto** (imagem de identidade não conta). Componentes **inativos**: não montados no fluxo produtivo do lojista nesta fatia.
- **Composição produtiva versionada dos prompts aprovados na F48.2.6.** Módulo produtivo que incorpora Produto v4, compositor v5 e as três intenções, com versões fixadas e **testes de equivalência** contra a bancada aprovada, sem tornar a bancada dependência de runtime e sem ler configuração mutável em execução.
- **Estruturas de snapshot por campanha e histórico append-only por operação/tentativa.** Relação própria append-only vinculada à campanha e ao snapshot original, sem sobrescrever o run/trace histórico; contrato de reuso do snapshot original por correção (arquitetural, sem implementar a F56.3).
- **Registro das duas chaves em `feature_flags` com a RPC auditada existente.** Ambas desligadas por padrão, com testes de decisão server-side (precedência: a chave geral prevalece) e fail-closed na leitura. A interface de ativação efetiva e o roteamento real pertencem à **F56.2b1**.
- **Barreira de não-ativação.** Nenhuma rota de geração real, chamada ao provider, reserva de crédito, entrega ou download pelo novo fluxo; a chave **não** consegue encaminhar campanhas reais nesta fatia.

**BREAKING:** nenhuma. Tudo é aditivo, inativo e atrás de chaves desligadas.

## Capabilities

Escopo desta fatia: **5 specs** — 3 capacidades novas (`product-1-1-flow-activation`, `product-1-1-intent-background-selection`, `product-1-1-prompt-composition`) e 2 deltas de capability existente (`image-generation-config-snapshot`, `feature-flag-control`). As 13 specs citadas na change original eram o **total daquela change**, hoje reconciliada em F56.2a + F56.2b1 + F56.2b2.

### New Capabilities

- `product-1-1-flow-activation`: estrutura das duas chaves desligadas por padrão, decisão server-side fail-closed, precedência determinística e barreira de não-ativação (sem roteamento real).
- `product-1-1-intent-background-selection`: contratos e componentes (inativos) de seleção explícita de intenção e fundo, com a regra de Original exigindo exatamente uma imagem de produto.
- `product-1-1-prompt-composition`: módulo produtivo versionado e congelado dos prompts/regras aprovados na F48.2.6, com testes de equivalência e sem leitura mutável da bancada.

### Modified Capabilities

- `image-generation-config-snapshot`: estrutura append-only de operações/tentativas vinculada à campanha e ao snapshot original, com contrato de reuso e invariante de não sobrescrita do run/trace histórico.
- `feature-flag-control`: registro das duas chaves de ativação do novo fluxo com default desligado e alteração auditável pela RPC existente.

## Critérios de Aceite Verificáveis

1. Os contratos/componentes de seleção cobrem Oferta/Destaque/Exclusivo e Estúdio/Ambientado/Original; Original é rejeitado com zero ou mais de uma imagem de produto, ignorando a imagem de identidade; o erro é de campo (não `IMG-001`).
2. A composição versionada reproduz os prompts aprovados na F48.2.6 (Produto v4/compositor v5/três intenções/fundo), com testes de equivalência, e não muda por configuração mutável da bancada em runtime.
3. A estrutura append-only de operações/tentativas registra cada operação vinculada à campanha e ao snapshot original, sem sobrescrever o run/trace histórico; o contrato de reuso do snapshot original é testável.
4. As duas chaves existem em `feature_flags`, começam desligadas e são alteráveis pela RPC auditada; a decisão server-side é fail-closed e a chave geral prevalece.
5. A chave **não** encaminha campanhas reais nesta fatia: não há rota de geração, provider, reserva de crédito, entrega ou download pelo novo fluxo; os componentes não são montados no fluxo produtivo do lojista.
6. O fluxo legado permanece idêntico (fronteira produtiva vazia nos caminhos legados); nenhuma chamada paga e nenhuma alteração de produção.

## Fronteira com a F56.2b1 e F56.2b2

A F56.2a entrega **componentes/estruturas inativos**. A **F56.2b1** é a integração operacional correspondente (núcleo ponta a ponta, chaves desligadas) e **depende explicitamente** da F56.2a: habilita roteamento efetivo e controles administrativos, conecta formulário/composição/snapshot/preflight/política/telemetria, cobra um crédito por entrega de forma transacional, persiste a arte 1024×1024 com download direto e mantém copy não bloqueante. A **F56.2b2** acrescenta o botão "Tentar gerar copy novamente", os testes integrados/E2E e o piloto controlado, só então avaliando ativar lojas de teste. Aprovação/reprovação e correção permanecem na F56.3. Todas as três fatias estão em 0 tasks: são propostas planejadas, não implementação concluída.

## Migração e Compatibilidade

- **Aditivo e inativo.** Nada é consumido pelo fluxo produtivo; as chaves ficam desligadas.
- **Sem ativação parcial.** Registrar as chaves não ativa o novo fluxo; a interface de ativação é da F56.2b1.
- **Ordem de migração.** (1) criar/testar localmente em instância descartável isolada; (2) UAT local sem provider; (3) migration remota/deploy em etapa posterior autorizada. Nada remoto por esta proposta.
- **Rollback.** Basta não ativar; estruturas novas são aditivas.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit ou deploy ocorre antes da aprovação do responsável.

## Impact

- **Banco (migration [BLOCKING])**: estrutura append-only de operações/tentativas; registro das duas chaves em `feature_flags`; adaptações aditivas sobre as estruturas F56.1. Sem `db push` remoto.
- **Código novo (inativo)**: domínio/componentes de seleção de intenção e fundo, módulo produtivo de composição versionada, repositório/contrato de histórico append-only, função pura de decisão server-side das chaves.
- **Código alterado (aditivo)**: `feature-flags` (registro das chaves) e nenhum caminho legado.
- **Design**: `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, `lucide-react`, sem emojis, sem light mode). Saída do novo fluxo: **1024×1024** (divergindo do 1080×1080 genérico do contexto).
- **Reconciliação**: substitui parte da change `fase-56-2-novo-fluxo-geracao-produto-1-1` (ver `RECONCILIATION.md` na change original). A change original é preservada e marcada como substituída; não é descartada silenciosamente.
- **Validação**: typecheck, lint, build, testes locais e `openspec validate --strict`; sem chamada paga e sem alteração de produção.
