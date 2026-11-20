## 1. Subfatia A — Fundação financeira e entregas

> Entrega técnica intermediária, sem orquestração integrada e sem disponibilidade ao lojista. Nenhuma migration é aplicada nesta subfatia.

- [x] 1.1 Definir o contrato puro conjunto de formato em módulo dedicado que reconhece `campaignFormat: "1:1+9:16"` + `formatContractVersion: "f60.7-two-format-v1"` e delega os casos não conjuntos aos resolvedores existentes, mantendo `1:1`, `9:16` e históricos byte-compatíveis.
- [x] 1.2 Definir o contrato puro conjunto de origem em módulo dedicado que reconhece `generationOrigin: "two_format_two_stage"` + sua versão e delega os casos não conjuntos, distinguindo origem conjunta de `9_16_two_stage`, histórico e indeterminado.
- [x] 1.3 Definir o contrato estrito de declaração conjunta em módulo dedicado, sem conectar ao schema de produção; a extensão do `NewFlowGenerateImageRequestSchema` e o dispatch permanecem na Subfatia C para não expor a opção conjunta antes da jornada.
- [x] 1.4 Preparar apenas os tipos puros necessários ao contrato conjunto; atualização de restauração, formulário e review permanece na Subfatia C.
- [x] 1.5 Auditar todos os consumidores de `resolveCampaignFormat` e `resolveCampaignGenerationOrigin` para tratar o novo caso sem fallback silencioso, garantindo que fluxos individuais, download, pendências e restauração continuem fail-closed apenas quando apropriado.
- [x] 1.6 Cobrir com testes puros: par conjunto válido, versão ausente/desconhecida, par incoerente, lista de formatos recusada, 1:1 sem chaves e 9:16 individual inalterado.
- [x] 1.7 Definir o modelo de vínculo entrega↔formato↔operação financeira: duas linhas por requisição conjunta, identidade financeira própria, papel do artefato e unicidade por campanha/operação/formato.
- [x] 1.8 Autorar a tabela forward-only, índices, FKs, RLS e `REVOKE ALL` de `service_role` seguido de `GRANT SELECT`, sem backfill e sem alterar tabelas existentes além de referenciá-las.
- [x] 1.9 Autorar a RPC de abertura conjunta idempotente que valida o contrato persistido, impede uma segunda operação conjunta na mesma campanha antes de reservar, compara a seleção recebida com a seleção congelada no replay, reutiliza a abertura v2, insere os dois vínculos e reserva os dois créditos na mesma transação.
- [x] 1.10 Autorar a RPC de entrega por formato que valida vínculo/artefato, adquire o lock da campanha antes dos locks específicos, executa `mark_art_uploaded` + `deliver` da identidade correta e re-projeta a campanha na mesma transação.
- [x] 1.11 Autorar a RPC de estorno por formato que trava a mesma linha financeira da operação conjunta usada por `product_9_16_acquire_step`, verifica execução ativa e finalidade durável compartilhada antes de encerrar somente a identidade comprovadamente não entregue, mantém o lock da campanha antes dos locks específicos e re-projeta sem rebaixar entrega existente.
- [x] 1.12 Autorar a RPC de projeção idempotente com lock comum da campanha, dois vínculos coerentes da mesma operação sem `LIMIT 1`, preferência quadrada, fallback vertical e preservação de `ready`.
- [x] 1.13 Conferir `amount = 1`, CHECKs, grants e semântica das RPCs existentes; documentar timestamp UTC real e checagem de unicidade do prefixo antes da criação da migration.
- [x] 1.14 Criar testes estáticos/contratuais do SQL e dos envelopes, sem executar migration, banco, Docker ou homolog.
- [x] 1.15 Implementar cliente server-only das novas RPCs com client injetável, validação fechada de envelope e erros tipados; não alterar os clientes existentes.
- [x] 1.16 Definir o contrato do modelo de leitura por formato (`delivered`, `processing`, `absent`, `unknown`, `unavailable`), com crédito devolvido, referência de suporte e miniatura preferida, preservando o outro formato entregue quando crédito/artefato de um formato falha, usando fakes de banco.
- [x] 1.17 Definir os contratos de acesso por formato (preview/download/miniatura) e a elegibilidade do caminho canônico de `square_original`, sem montar UI ou rotas.
- [x] 1.18 Cobrir leitura/acesso com testes contratuais: formato entregue, processando, ausente, indeterminado, crédito devolvido, miniatura preferida e ausência de fallback para o original.
- [x] 1.19 Confirmar que a Subfatia A não altera a semântica dos fluxos 1:1/9:16 individuais, não expõe opção conjunta e não aplica migration.

## 2. Gate A — Revisão e aceite da fundação

- [x] 2.1 Executar typecheck/lint/diff e as suítes focadas da Subfatia A; validar OpenSpec strict.
- [x] 2.2 Revisar contratos de formato/origem, schema/RPCs, clientes, leitura e acesso, com atenção a idempotência, identidades financeiras e preservação dos fluxos atuais.
- [x] 2.3 Registrar aceite ou correções da Subfatia A antes de iniciar a orquestração; nenhuma migration é aplicada neste gate.

## 3. Subfatia B — Orquestração conjunta e proteção administrativa

> Entrega técnica intermediária. A opção conjunta ainda não fica disponível ao lojista.

- [x] 3.1 Implementar o preflight estrito da seleção administrativa antes da abertura conjunta, reutilizando catálogo/pricing e sem provider, reserva ou operação.
- [x] 3.2 Implementar a abertura conjunta no serviço dedicado, com idempotência, conflito de seleção/origem e leitura dos dois IDs financeiros.
- [x] 3.3 Implementar a etapa de base reutilizando `runSquareBase`/`runBaseStep` com a identidade da operação conjunta, sem duplicar briefing, copy ou imagem.
- [x] 3.4 Implementar a sonda de integridade do `square_original` (papel, formato, 1024×1024, JPEG, checksum) e a liquidação da entrega quadrada imediatamente após a base, na ordem artefato persistido/verificado → token de publicação → RPC de confirmação + projeção, sem novo upload.
- [x] 3.5 Implementar a projeção e a miniatura quadrada após a confirmação do quadrado, antes de preparação/expansão.
- [x] 3.6 Implementar `deliverTwoFormatVertical` dedicado, sem usar `deliverVertical` como confirmador; reutilizar `control.resume`, sonda vertical, `beginPublication` após o artefato persistido/verificado e a RPC atômica de entrega por formato, sem novo upload.
- [x] 3.7 Implementar a finalização de falha da base: ausência comprovada estorna os dois formatos, gravando o desfecho `failed` da identidade financeira do quadrado pela RPC existente (`product_1_1_record_generation_outcome`) antes do estorno, conforme handoff já previsto em A; indeterminação não estorna nem repete; arte íntegra liquida a entrega; falha entre desfecho e estorno e falha entre os dois estornos permanecem seguras e retomáveis.
- [x] 3.8 Implementar a falha definitiva de preparação/expansão com estorno somente do vertical e preservação do quadrado entregue.
- [x] 3.9 Implementar a recuperação que atua somente no formato faltante: não refaz base/copy/quadrado entregue, não reabre estorno e não cria cobrança silenciosa.
- [x] 3.10 Implementar a liquidação de artefato existente com confirmação pendente, sem chamada de provider.
- [x] 3.11 Implementar o reparo idempotente de projeção e miniatura em replay/reload, cobrindo falha entre confirmação, projeção e leitura.
- [x] 3.12 Reconhecer o vínculo conjunto na lista de pendências, exibindo campanha, formato e operação de entrega **no serviço/read model; a UI administrativa não é entregue nesta subfatia**.
- [x] 3.13 Usar a sonda `square_original` para a pendência quadrada e a sonda vertical existente para o vertical, nunca a sonda 1:1 legada para o quadrado conjunto.
- [x] 3.14 Implementar o bloqueio de resolução incompatível e a resolução de entrega/estorno por formato com evidência server-side, auditoria, projeção pela RPC/07 (não no serviço de resolução) e bloqueio de etapa ativa; o estorno do quadrado grava o desfecho `failed` da própria identidade antes do refund, e `unknown` persistido bloqueia sem sobrescrita.
- [x] 3.15 Garantir que ausência/indeterminação não autorize estorno presumido e que o formato já entregue não seja estornado.
- [x] 3.16 Cobrir com testes integrados offline pelos componentes reais, com fakes apenas nas fronteiras de banco/provider: percurso completo, base única, entrega quadrada, vertical dedicado, entrega parcial, estorno por formato, indeterminação, replay, concorrência, resposta tardia, reload, recuperação somente do faltante, ordem artefato persistido/verificado → token → RPC sem novo upload/duplicação da imagem, handoff `record_generation_outcome → refund` e as janelas de falha entre desfecho e estorno e entre os dois estornos.
- [x] 3.17 Cobrir a proteção administrativa: pendência quadrada correta, pendência vertical, entrega com artefato íntegro, estorno sem evidência recusado, etapa ativa bloqueada e formato entregue não estornado.
- [x] 3.18 Confirmar que a Subfatia B não possui entrypoint público/UI da opção conjunta e que a atomicidade de confirmação+projeção é exercida pela RPC, não por chamadas separadas.

## 4. Gate B — Revisão e aceite da orquestração

- [x] 4.1 Executar typecheck/lint/diff e as suítes integradas offline da Subfatia B; validar OpenSpec strict.
- [x] 4.2 Revisar orquestração, entrega parcial, recuperação e proteção administrativa antes de qualquer validação real de banco.
- [x] 4.3 Registrar aceite ou correções da Subfatia B; confirmar que a opção conjunta permanece indisponível ao lojista.

> **Aceite local/offline de B (2026-11-19):** `3.1–3.18` e `4.1–4.3` concluídos no escopo local/offline, com o histórico de correções preservado nos SUMMARYs e em `60.7-B-VERIFICATION.md`. **Wiring administrativo/UI continua ADIADO** — `3.12`/`3.14` entregam serviço, read model e resolução server-side, não uma tela. A opção conjunta permanece indisponível ao lojista. O Gate de banco (`5.x`) foi **executado parcialmente no homolog em 2026-11-19** com **17 cenários de banco PASS**, mas **S13/S14 são regressão legada e S17 é offline**; **o aceite do gate aguarda o complemento e a revisão** e não é automático. Este relatório não aprova produção ou Subfatia C.

## 5. Gate de banco — Validação real da migration

> Gate separado e explicitamente autorizado. Sem geração paga, provider, novo ambiente ou produção. Testes estáticos/offline não substituem esta etapa.

- [x] 5.1 Obter autorização explícita para aplicar a migration no homolog existente e registrar backup/identidade do alvo antes da aplicação.
- [x] 5.2 Aplicar somente a migration conjunta no homolog autorizado e verificar schema, RLS, grants, RPCs, CHECKs e ausência de alteração em dados existentes.
- [x] 5.3 Validar no PostgreSQL: abertura atômica das duas reservas, saldo insuficiente sem estado parcial, idempotência, conflito de seleção, concorrência, entrega/estorno por formato, projeção e resposta tardia.
- [x] 5.4 Validar que as RPCs/consultas dos fluxos 1:1/9:16 individuais e históricos permanecem intactas.
- [x] 5.5 Registrar evidência e limitações; se a autorização não existir, bloquear a liberação da Subfatia C e não declarar a migration validada.

> **Execução do Gate de banco (2026-11-19):** `5.1–5.5` executados e **aceitos com limitações**. Primeiro: backup, aplicação transacional, ledger 156→157 e **17 cenários de banco PASS**; S13/S14 apenas regressão legada e S17 offline. Depois: **complemento base 10/10 PASS** com `resolveJointPending` real (J2 comprova o handoff do outcome próprio do quadrado) e PostgREST real, **sem Storage de arte**. **Pendências obrigatórias transferidas para C:** arte íntegra pela jornada conectada e preservação de conteúdo (janela C; histórico não comprovado). Ver `60.7-C-PLAN.md`. A Subfatia C foi executada e aceita tecnicamente com ressalvas.

## 6. Subfatia C — Jornada e apresentação

> **Reconciliação 2026-11-20:** Subfatia C concluída e aceita tecnicamente com ressalvas (C1–C6). Itens 6.1–8.6 marcados com base em `60.7-C1-VERIFICATION.md`…`60.7-C6-ACCEPTANCE.md` e `60.7-VERIFICATION.md`. Disponibilidade local/homolog não é publicação; produção, deploy e sync/archive permanecem separados.
>
> **Reabertura pontual 2026-11-20:** **6.5** (checkboxes) e **6.8** (custo/saldo unificado) foram reabertas para a correção documentada em `60.7-C2-REOPEN-PLAN.md`. As demais tasks permanecem concluídas; nenhum código foi alterado ainda.
>
> **Complemento documental 2026-11-20:** **6.22** (clareza da tela de acompanhamento) e **6.23** (robustez do NDJSON/reidratação) foram adicionadas conforme `60.7-C2-C6-COMPLEMENT-PLAN.md` e implementadas offline em `649ce913`, com evidência em `60.7-C2-C6-COMPLEMENT-REPORT.md`. **6.24** (linha “Formato” da revisão) e **6.25** (transição para a campanha pronta) foram implementadas offline em `3d65c7fb`, com evidência em `60.7-C2-C6-TRANSITION-REPORT.md`. **Os três complementos e a aprovação visual foram aceitos em 2026-11-20; C2/C6 reconfirmados no HEAD de implementação `3d65c7fb`.** Sync/archive não executados.

> Gate C concluído em 2026-11-20; disponibilidade local/homolog não é publicação. Plano macro em `60.7-C-PLAN.md` (blocos C1–C6, cada um com Review Stop). Subfatia C concluída e aceita tecnicamente com ressalvas.

- [x] 6.1 Implementar o dispatch dedicado no `generate-image` para o formato conjunto, com validação da flag vertical aplicável, fingerprint congelado, `inputFiles`/`resumeContext` e ausência de efeitos antes da validação.
- [x] 6.2 Implementar a rota/continuação da operação conjunta, reutilizando o schema e os limites existentes, sem aceitar conteúdo novo do navegador.
- [x] 6.3 Estender o `NewFlowGenerateImageRequestSchema` para aceitar o valor conjunto exato, mantendo a recusa de listas/formatos desconhecidos e sem permitir que o dispatch individual trate o pedido conjunto como 1:1/9:16.
- [x] 6.4 Atualizar os tipos e o transporte de restauração/formulário/review para o formato conjunto, sem alterar a representação de `1:1` e `9:16` individuais.
- [x] 6.5 Substituir as opções de radio por dois checkboxes: Quadrado 1:1 e Vertical 9:16, com mapeamento 1:1 / 9:16 / 1:1+9:16, pelo menos um formato marcado, flag OFF sem conversão silenciosa e saída explícita “Usar somente Quadrado” para draft pausado.
- [x] 6.6 Persistir o formato conjunto no draft, body, fingerprint e restauração, sem alterar o body de `1:1` nem o de `9:16` individual.
- [x] 6.7 Atualizar a revisão para exibir os dois formatos e o custo total de 2 créditos quando o formato conjunto estiver selecionado.
- [x] 6.8 **[REABERTA 2026-11-20; corrigida no offline]** Unificar a checagem de saldo do formulário e da revisão: conjunto = 2 créditos; individuais mantêm `campaign_generation`; saldo 1 bloqueia o conjunto; estados carregando/indisponível/operação desabilitada/saldo desconhecido continuam bloqueando. Sem alterar reservas, pricing ou custo individual.
- [x] 6.9 Bloquear submissão conjunta quando a flag vertical aplicável estiver OFF, preservando o formato restaurado e sem trocar silenciosamente para 1:1/9:16.
- [x] 6.10 Adaptar `listCampaigns` para carregar os indicadores conjuntos em lote, mantendo 1:1/9:16/histórico no caminho atual e sem expor `input_snapshot`.
- [x] 6.11 Implementar o card conjunto com um único card, chips/indicadores, estado parcial, link do formato entregue para `?format=` e ausência/processamento sem ação.
- [x] 6.12 Adaptar as miniaturas da listagem para usar o caminho derivado do formato preferido, nunca o original como fallback.
- [x] 6.13 Adaptar o dashboard para exibir a campanha conjunta uma única vez, contar uma vez, indicar os dois formatos e usar a miniatura derivada preferida.
- [x] 6.14 Adaptar a página de detalhe para reconhecer a origem conjunta antes dos ramos individuais e carregar o modelo por formato.
- [x] 6.15 Implementar a seleção/tabs 1:1 e 9:16 com `?format=` e pré-seleção validada no servidor.
- [x] 6.16 Implementar preview individual por formato somente após `delivered` e artefato compatível, com URL assinada curta e sem assinar formato ausente/indeterminado.
- [x] 6.17 Implementar download individual por formato na rota existente, com `?format=`, fallback preferido e falha fechada, preservando 1:1/9:16 individual e histórico.
- [x] 6.18 Implementar as miniaturas derivadas do quadrado e do vertical, estendendo a elegibilidade apenas para o caminho canônico do `square_original`.
- [x] 6.19 Adaptar a tela de processamento e o polling para indicar os dois formatos e continuar acompanhando enquanto qualquer formato estiver em processamento.
- [x] 6.20 Exibir a copy compartilhada uma única vez no detalhe, inclusive em entrega parcial, sem duplicar o painel por formato.
- [x] 6.21 Cobrir com testes de UI/read model: card único, indicador abre o formato correto, processamento não gera, ausência sem ação, miniatura quadrada preferida, placeholder sem original, preview/download por formato, formato não entregue sem arte, copy única e reload.
- [x] 6.22 Revisar a tela de acompanhamento da geração em linguagem de lojista: cabeçalho “Geração da campanha” sem subtítulo de preenchimento; resumo read-only dos dois formatos sem helpers de seleção; uma única mensagem principal por estado (“A geração está em processamento. Aguarde.”, “Quase pronto!”, “Clique em ‘Continuar geração’ para concluir.”, “Não foi possível atualizar o andamento.”); ações somente quando necessárias; rótulos de etapa compreensíveis, sem “Projeção” na interface; sem “Retomar quando autorizado” e sem novo retry pago. **[ACEITO EM 2026-11-20]**
- [x] 6.23 Corrigir a robustez do acompanhamento: leitor NDJSON inicial/continuação com flush do decoder e buffer final sem newline, chunks fragmentados, terminal de resposta único, limpeza de continuação pendente em `result`/`error`/`unknown`, reidratação sem concorrência com o stream inicial e resposta de status obsoleta sem sobrescrever estado mais novo. **[ACEITO EM 2026-11-20]**
- [x] 6.24 Apresentar a linha “Formato” da revisão conforme a seleção, sem dimensões em pixels: “Quadrado 1:1 (Feed)”, “Vertical 9:16 (Stories/Reels)” e “Quadrado 1:1 (Feed) + Vertical 9:16 (Stories/Reels)”. Não alterar dimensões reais, schemas, eventos, artefatos ou contratos técnicos. **[ACEITO EM 2026-11-20]**
- [x] 6.25 Implementar estado explícito de transição para a campanha pronta: “Abrindo sua campanha...” com cabeçalho de geração e resumo read-only; não reexibir formulário/revisão; navegar uma única vez; preservar delivered/partial/refunded; oferecer abertura manual da campanha existente sem nova geração, continuação, reserva ou cobrança. **[ACEITO EM 2026-11-20]**

## 7. Gate C — Revisão, aceite e liberação da jornada

- [x] 7.1 Executar typecheck/lint/build/diff e as suítes focadas da Subfatia C; validar OpenSpec strict.
- [x] 7.2 Revisar a jornada completa e confirmar ausência de publicação/ativação produtiva; disponibilidade local/homolog com a flag vertical ON é esperada e não conta como publicação.
- [x] 7.3 Registrar aceite ou correções; nenhuma ativação de produção, deploy, flag ou pricing é executada neste gate.
- [x] 7.4 **Pendência obrigatória do Gate de banco — arte íntegra pela jornada conectada:** validar a entrega 1:1/9:16 com artefato canônico integral (bytes + evidência) pela rota/jornada efetivamente conectada, incluindo a entrega administrativa quando o wiring estiver disponível; nenhum fake de DB/RPC/Storage; arte de lojista real nunca. Critérios C4-A1..A6 em `60.7-C-PLAN.md`.
- [x] 7.5 **Pendência obrigatória do Gate de banco — preservação de conteúdo:** **C5a** deve capturar a baseline **antes da primeira escrita de C no homolog**, com autorização específica, e **C5b** comparar fingerprints de conteúdo das linhas não sintéticas no fechamento; qualquer diferença inexplicada bloqueia C. A janela C é verificável; o passado permanece não comprovado e restore exige autorização separada. Critérios C5-A1..A5 em `60.7-C-PLAN.md`.

## 8. Gates finais e limites

- [x] 8.1 Executar as suítes de preservação de 1:1, 9:16 individual, histórico, copy, artefatos, download, miniaturas, listagem e pendências.
- [x] 8.2 Executar as suítes focadas da entrega conjunta, incluindo percurso completo, entrega parcial, confirmação/estorno por formato, replay, concorrência, indeterminação, reload e recuperação somente do faltante.
- [x] 8.3 Executar `npm run typecheck`, lint, build, `git diff --check` e `openspec validate --changes --strict`.
- [x] 8.4 Documentar o mapa técnico final, as decisões implementadas, as limitações e as evidências offline no summary da fase.
- [x] 8.5 Preparar o roteiro objetivo de validação manual futura no homolog existente, sem gerar imagem, chamar provider, aplicar migration ou acessar produção nesta rodada.
- [x] 8.6 Confirmar que nenhuma flag/pricing foi alterada, nenhum provider foi chamado e nenhum merge/push/deploy foi executado; a aplicação da migration permanece restrita ao Gate de banco autorizado.
