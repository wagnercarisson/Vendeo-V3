# 59-10 — Parecer de fechamento da F59

Data: 2026-11-06. Status: **FECHADA TECNICAMENTE E EM HOMOLOGAÇÃO NO ESCOPO 9:16;
PRODUÇÃO NÃO AUTORIZADA.** OpenSpec verificado, sincronizado e arquivado em
`openspec/changes/archive/2026-11-06-fase-59-campanhas-produto-vertical-9-16/`.

## 1. Bloqueadores específicos do 9:16

**Nenhum bloqueador funcional remanescente no escopo 9:16.**

Gates reais executados no homolog:

- geração vertical real 1080×1920 e entrega;
- 1 crédito por entrega;
- download, detalhe, listagem e miniatura;
- recuperação vertical completa e resolução administrativa até detalhe/lista;
- ciclo de flag OFF com 503 antes de reserva/provider;
- geração em andamento concluindo com flag OFF;
- concorrência de rota com uma campanha/uma dedução/uma chamada de imagem;
- reenvio somente leitura;
- concorrência SQL de reserva/tentativa;
- regressão 1:1.

## 2. Decisão de auditoria — aceita como exceção

- Auditoria do replay terminal idempotente: a RPC retorna `refunded + refund_once`
  antes do `INSERT` em `admin_audit_log`. A campanha D foi encerrada em `error`,
  operação permaneceu `refunded`, `refund_tx_id`/ledger/saldo inalterados.
- **Aceite formal registrado em 2026-11-06**: exceção de rastreabilidade do replay
  administrativo, **não** falha de estorno. Pendência separada em
  `.planning/issues/59-AUDIT-REPLAY-GAP.md`, com evidência e mecanismo responsável.
- **Não corrigida** nesta fase; correção em trabalho separado.

## 3. Ressalvas aceitas

- **Bolo:** validade na faixa inferior; exceção pontual, proteção mantida no prompt.
- **Pão Francês:** “garanti” é erro de entrada; arte não publicável com o erro.
- **Reels:** aceito com a ressalva observada no Facebook; máscara antiga é análise de
  risco, não validação irrestrita. Stories aprovado separadamente.
- **Custo:** calculado por usage e pricing (0,030441), não valor confirmado em
  fatura; piloto 0,1107; desvio 0,080259; contador conservador não precisa mudar.
- **Concorrência:** comprovada nos cenários executados, não em todas as suítes
  antigas.
- **Faixa superior:** 5% efetivos; 5%–15% não protegidos.

## 4. Fora do escopo da F59

- Proteção contra perda de dados no reload, intenção de nova campanha e botão
  “Limpar dados”: melhoria transversal separada
  (`59-OUT-OF-SCOPE-DATA-PRESERVATION.md`), não implementada.
- Três ajustes de UI reservados à quick pós-F59: posição do seletor de formato,
  identificação do formato na listagem e direção de fundo na revisão.

## 5. Gate de produção

- Separado, **não executado**.
- Exige deploy, ativação auditada, smoke, monitoramento e rollback, com autorização
  específica. O aceite de homolog não autoriza produção.

## 6. Decisões registradas

1. Lacuna de auditoria do replay terminal: **aceita formalmente nesta fase** como
   exceção de rastreabilidade; correção separada; não resolvida.
2. Fechamento técnico e de homologação da F59 no escopo 9:16: **autorizado**,
   preservando ressalvas, exclusões e produção como gate separado.
3. Proteção contra perda de dados/“Limpar dados”: escopo transversal separado.
4. Três ajustes de UI: quick pós-F59.
