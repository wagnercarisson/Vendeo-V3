## Why

O fluxo 9:16 aprovado hoje entrega a campanha em uma única etapa paga e encerra o crédito na entrega. O novo fluxo 9:16 exigirá duas etapas pagas — geração quadrada e expansão vertical — dentro de **um único pedido de 1 crédito**. Sem um controle próprio e durável, a operação pode cobrar duas vezes, entregar antes da hora, repetir geração após entrega/estorno ou deixar o encerramento financeiro administrativo agir sobre uma execução ativa que ele não reconhece.

Esta mudança propõe apenas a **primeira fatia**: o módulo de controle da operação em duas etapas, sua integração com os serviços financeiros existentes e uma **prova mínima de viabilidade em banco isolado**, antes de qualquer implementação completa de geração, expansão ou interface. Não há geração de imagem, expansor, armazenamento de artefatos nem UI nesta fatia.

## What Changes

- Define um **orquestrador próprio** para o novo fluxo 9:16, independente do orquestrador 1:1 atual. Os orquestradores existentes **não** são refatorados e o comportamento do 1:1 e do 9:16 direto é preservado.
- Define um **módulo de controle de operação** com identidade durável, etapas explícitas (`base` e `expansion`), tentativas identificadas, transições persistidas e limites entre requisições e retomadas.
- Fixa o contrato financeiro do pedido:
  - um pedido 9:16 = **1 crédito reservado**;
  - **duas etapas pagas** (base quadrada e expansão) na mesma operação;
  - a **conclusão da base não entrega** a campanha nem confirma o consumo definitivo;
  - a **expansão não reserva** outro crédito;
  - a **entrega vertical** confirma o único crédito;
  - **falha definitiva sem entrega** estorna uma única vez;
  - **resultado desconhecido** não autoriza repetição nem estorno cego;
  - **timeout, abort ou perda de comunicação após possível envio ao provider** são resultado desconhecido, mesmo que o SDK marque o erro como `retryable`, e não autorizam repetição automática;
  - **respostas tardias** após encerramento não produzem entrega nem cobrança adicional.
- Distingue **consulta** de **autorização para executar**: o vencedor da aquisição recebe autorização de execução; o reenvio recebe o estado/token existente, mas **não** autoriza executar de novo. Receber o mesmo token não significa que duas requisições podem executar.
- Mantém **uma única verdade financeira**: a linha de operação de crédito existente é a autoridade para reserva, entrega e estorno. Estados financeiros não são duplicados no módulo operacional; são derivados e revalidados sob a mesma trava. A resolução administrativa impede novas execuções mesmo que o registro operacional esteja desatualizado.
- Define a **origem canônica** de cada operação (`legacy` ou `9_16_two_stage`) para que a leitura compartilhada não produza desfechos duplicados ou conflitantes.
- Define a política de tentativas da operação:
  - **Expansão**: no máximo **2 tentativas por operação** — uma inicial e uma repetição automática, e a repetição só é permitida para falha classificada como **transitória**. O limite é durável e vale também após retomadas.
  - **Geração base**: decisão registrada — **manter a política do motor 1:1 atual** (até 2 tentativas no par principal + até 1 no fallback, máximo de 3 chamadas reais), porque o módulo base será reutilizado. Esta proposta **não altera silenciosamente** essa política; a mesma regra de timeout/abort/perda de comunicação como resultado desconhecido se aplica.
  - **Chamadas ao provider não são créditos**: qualquer número de tentativas permitido continua consumindo **no máximo 1 crédito** por pedido.
- Define a **integração financeira** reutilizando os serviços existentes (`reserve_credit`, `refund_credit`, `product_1_1_campaign_credit_operations` e suas RPCs CAS). **Não** cria ledger paralelo nem duplica regras financeiras.
- Trata o **ponto crítico já identificado**: as rotinas de encerramento financeiro e de pendências consultam hoje de forma explícita `product_1_1_generation_attempt_claims`. Se o novo módulo gravar tentativas em outro registro, essas rotinas não reconhecerão a execução. A proposta exige uma **fonte de leitura compartilhada** consultada pelas rotinas de encerramento e pendências, sob a **mesma trava da linha de crédito**, com mudanças compartilhadas mínimas, justificadas e cobertas por testes de compatibilidade. Verificações apenas em TypeScript **não** são aceitas como garantia de atomicidade.
- Define um **checkpoint inicial obrigatório** — a primeira tarefa da futura execução é uma prova mínima do contrato em banco isolado, sem IA, com etapas simuladas e evidências de artefato controladas. Se a prova reprovar o desenho, a execução para e o desenho volta para revisão.
- Mantém o caminho incompleto **não disponibilizado ao lojista**: sem flag, sem rota pública, sem UI e sem ativação nesta fatia.

## Capabilities

### New Capabilities

- `product-9-16-two-stage-operation-control`: identidade durável da operação, etapas, tentativas, máquina de estados, autorização de execução única, continuidade após a base, bloqueio de repetição após entrega/estorno/resultado desconhecido, proteção contra respostas tardias e limites duráveis entre requisições e retomadas.
- `product-9-16-two-stage-financial-integration`: reserva única, confirmação somente na entrega vertical, estorno único em falha definitiva, tratamento de resultado desconhecido e reconhecimento da nova execução pelas rotinas financeiras e administrativas existentes, sem ledger paralelo.
- `product-9-16-two-stage-viability-proof`: prova mínima inicial em banco isolado, com etapas simuladas, cenários obrigatórios, evidências controladas, critérios de aprovação/reprovação e separação entre validação local, homolog e produção.

### Modified Capabilities

- `product-1-1-generation-orchestration`: as rotinas de encerramento e de pendências passam a reconhecer a execução do novo fluxo por uma fonte de leitura compartilhada, preservando integralmente a semântica atual para as operações 1:1 e 9:16 direto.
- `product-1-1-campaign-credit-billing`: o contrato de crédito é estendido para admitir uma operação de duas etapas com **um único crédito**, confirmação apenas na entrega vertical, sem reserva na expansão e sem confirmação na conclusão da base.

## Impact

- **Domínio novo**: módulo de controle da operação em duas etapas (identidade, etapas, tentativas, transições e travas), isolado dos orquestradores atuais.
- **Banco**: novas tabelas/RPCs de controle e, se confirmado como indispensável, uma **fonte de leitura compartilhada** e ajustes pontuais nas RPCs de encerramento/pendências. Migrations futuras seguirão `YYYYMMDDHHmmss_descricao.sql` com timestamp real e unicidade verificada; nesta etapa **nenhuma migration é criada, aplicada ou executada**.
- **Serviços financeiros reutilizados**: `reserve_credit`, `refund_credit`, `product_1_1_campaign_credit_operations` e RPCs CAS de entrega/estorno. Nenhuma regra financeira é duplicada.
- **Rotinas administrativas e de recuperação afetadas**: `product_1_1_close_failed_operation`, `admin_resolve_product_1_1_pending`, o repositório de pendências e a leitura de claims. Cada ponto de mudança compartilhada será identificado e justificado no design, com testes de compatibilidade antes de aprovação.
- **Ambiente da prova**: homolog (`vendeo-homolog`, `127.0.0.1:57782`, ledger observado de 153 migrations, último `20261105162052`) é o destino adotado, **não descartável**, mediante autorização específica. A proposta define identificação inequívoca do destino, loja/usuário/campanhas exclusivos de teste, migrations necessárias, limpeza limitada, autorizações prévias e **janela de exclusividade das RPCs compartilhadas** — IDs exclusivos isolam os dados, mas não isolam alterações de rotinas usadas por outros fluxos. Nada é criado, recriado, limpo ou escrito nesta etapa.
- **Fora de escopo**: composição de prompt e diretores; geração real de copy ou imagem; armazenamento completo de artefatos; preparação determinística 1024→1152, expansor de IA ou exportação; seletor administrativo de modelos; UI, aquisição de formatos e entrega dupla; limpeza automática, cron, filas ou workers; refatoração financeira genérica ou unificação do legado.
- **Preservação**: o significado de `delivered`, a cobrança atual e os orquestradores 1:1/9:16 direto permanecem inalterados. Se alguma adaptação compartilhada for indispensável, será localizada, justificada e testada antes de pedir aprovação.
