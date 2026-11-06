# 59-10 — Gate de produção (NÃO EXECUTADO)

Status: **documento de planejamento; nenhuma ação de produção foi executada**.
Este gate é separado do aceite de homolog e **não** é autorizado por ele.

## 1. Estado atual

- `product_9_16_enabled` em produção: **deve permanecer OFF** até autorização
  específica.
- Nenhum deploy, migration, ativação, smoke ou rollback de produção foi executado.
- Nenhuma campanha, crédito, Storage ou flag de produção foi alterado.
- O homolog está apto apenas no recorte comprovado; os gates pendentes da F59
  continuam abertos.

## 2. Pré-requisitos de entrada

1. F59 sem gates pendentes de recuperação/resolução, idempotência e concorrência, ou
   aceite explícito de risco pelo responsável.
2. Relatório de aceite aprovado e limitações conhecidas registradas.
3. Revisão de Reels/overlays: executada e **não aprovada**; correção na quick pós-F59
   ou aceite explícito de limitação.
4. Caso D encerrado pelo mecanismo auditado (proposta pendente de autorização).
4. Migration do seed da flag revisada e com timestamp único.
5. Plano de rollback testado em homolog.
6. Janela, responsável e critério de aborto definidos.

## 3. Sequência proposta (não executar sem autorização)

| Etapa | Ação | Evidência exigida |
|---|---|---|
| 1 | Confirmar branch/commit e build | hash do commit, build ID |
| 2 | Deploy do código com flag OFF | registro de deploy `READY` |
| 3 | Smoke 1:1 em loja de teste de produção | arte 1024×1024, crédito, download |
| 4 | Ativar a flag por RPC auditada, com motivo | linha de auditoria, ator |
| 5 | Smoke vertical em loja de teste | 1080×1920, path vertical, crédito 1 |
| 6 | Monitorar erros, custo e crédito | logs/telemetria por 24 h |
| 7 | Comunicar liberação ou rollback | decisão registrada |

## 4. Rollback

- Desligar `product_9_16_enabled` pela RPC auditada com motivo.
- Reverter o deploy para o commit anterior, se necessário.
- **Não** reverter dados/ledger/Storage por rollback de código.
- Campanhas verticais já entregues permanecem consultáveis e baixáveis com a flag OFF.
- Registrar horário, ator, motivo e evidência do rollback.

## 5. Critérios de aborto

- Qualquer geração vertical sem arte íntegra 1080×1920.
- Cobrança dupla, crédito sem entrega ou entrega sem crédito.
- Erro de recuperação/resolução em campanha existente.
- Regressão 1:1 em payload, arte, path, crédito, download ou miniatura.
- Falha de leitura da flag ou comportamento não fail-closed.

## 6. Fora de escopo

- Migrar ou converter campanhas existentes.
- Ativar o formato para todas as lojas sem decisão de produto.
- Publicação automática em redes sociais.
- Alterar o prompt congelado, o pipeline ou o modelo.

## 7. Declaração

Este documento **não aprova produção**. A ativação exige autorização específica,
registro de deploy, evidência de smoke e caminho de rollback. Até lá, a flag
permanece OFF em produção.
