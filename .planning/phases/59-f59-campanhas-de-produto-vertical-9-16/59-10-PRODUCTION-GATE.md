# 59-10 — Gate de produção (NÃO EXECUTADO)

Status: **documento de planejamento; homologação concluída; nenhuma ação de produção foi executada**.
Este gate é separado do aceite de homolog e **não** é autorizado por ele.

> Atualização 2026-11-06: os gates funcionais de homolog da F59 foram concluídos
> e a fase foi encerrada tecnicamente. As pendências abaixo são exclusivamente de
> preparação/promoção de produção, não de validação funcional em homolog.

## 1. Estado atual

- `product_9_16_enabled` em produção: **deve permanecer OFF** até autorização
  específica.
- Nenhum deploy, migration, ativação, smoke ou rollback de produção foi executado.
- Nenhuma campanha, crédito, Storage ou flag de produção foi alterado.
- O homolog está apto no recorte comprovado; os gates funcionais da F59 foram
  concluídos. Permanecem apenas os passos de produção descritos neste documento.
- A migration data-only `20261105162052_f59_product_9_16_flag.sql` foi aplicada
  no homolog com a flag `enabled=false`; a aplicação em produção continua pendente
  de autorização específica.

## 2. Pré-requisitos de entrada

1. Fora do escopo da F59: proteção contra perda de dados no reload e intenção de
   nova campanha são melhoria transversal separada, não implementada.
2. Caso D fechado em `error`; lacuna de auditoria do replay terminal aceita
   formalmente como exceção em `.planning/issues/59-AUDIT-REPLAY-GAP.md`
   (**não corrigida**).
3. Reels: **aceito com ressalva observada no Facebook**; não é aprovação irrestrita
   de todas as interfaces.
4. Custo: **calculado por usage e pricing** (0,030441 no Run B; piloto 0,1107),
   não é valor faturado; reconciliação de fatura permanece fora deste gate.
5. Migration do seed da flag revisada, com timestamp único e já aplicada no
   homolog; a aplicação em produção é uma autorização separada.
6. Plano de rollback definido; o teste de rollback em produção permanece parte do
   gate de produção, não do homolog.
7. Janela, responsável e critério de aborto definidos.

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

Checklist de integração/promoção:
`docs/operations/f59-quick-261106-qxn-promotion-checklist.md`.
O comportamento de deploy automático ao push na `main` **não foi verificado nesta
etapa** e deve ser confirmado fora desta preparação, sem alterar configurações de
publicação.
