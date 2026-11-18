## 1. Subfatia A — Fundação financeira e entregas

> Entrega técnica intermediária, sem orquestração integrada e sem disponibilidade ao lojista. Nenhuma migration é aplicada nesta subfatia.

- [ ] 1.1 Definir o contrato puro conjunto de formato em módulo dedicado que reconhece `campaignFormat: "1:1+9:16"` + `formatContractVersion: "f60.7-two-format-v1"` e delega os casos não conjuntos aos resolvedores existentes, mantendo `1:1`, `9:16` e históricos byte-compatíveis.
- [ ] 1.2 Definir o contrato puro conjunto de origem em módulo dedicado que reconhece `generationOrigin: "two_format_two_stage"` + sua versão e delega os casos não conjuntos, distinguindo origem conjunta de `9_16_two_stage`, histórico e indeterminado.
- [ ] 1.3 Definir o contrato estrito de declaração conjunta em módulo dedicado, sem conectar ao schema de produção; a extensão do `NewFlowGenerateImageRequestSchema` e o dispatch permanecem na Subfatia C para não expor a opção conjunta antes da jornada.
- [ ] 1.4 Preparar apenas os tipos puros necessários ao contrato conjunto; atualização de restauração, formulário e review permanece na Subfatia C.
- [ ] 1.5 Auditar todos os consumidores de `resolveCampaignFormat` e `resolveCampaignGenerationOrigin` para tratar o novo caso sem fallback silencioso, garantindo que fluxos individuais, download, pendências e restauração continuem fail-closed apenas quando apropriado.
- [ ] 1.6 Cobrir com testes puros: par conjunto válido, versão ausente/desconhecida, par incoerente, lista de formatos recusada, 1:1 sem chaves e 9:16 individual inalterado.
- [ ] 1.7 Definir o modelo de vínculo entrega↔formato↔operação financeira: duas linhas por requisição conjunta, identidade financeira própria, papel do artefato e unicidade por campanha/operação/formato.
- [ ] 1.8 Autorar a tabela forward-only, índices, FKs, RLS e `REVOKE ALL` de `service_role` seguido de `GRANT SELECT`, sem backfill e sem alterar tabelas existentes além de referenciá-las.
- [ ] 1.9 Autorar a RPC de abertura conjunta idempotente que valida o contrato persistido, impede uma segunda operação conjunta na mesma campanha antes de reservar, compara a seleção recebida com a seleção congelada no replay, reutiliza a abertura v2, insere os dois vínculos e reserva os dois créditos na mesma transação.
- [ ] 1.10 Autorar a RPC de entrega por formato que valida vínculo/artefato, adquire o lock da campanha antes dos locks específicos, executa `mark_art_uploaded` + `deliver` da identidade correta e re-projeta a campanha na mesma transação.
- [ ] 1.11 Autorar a RPC de estorno por formato que verifica a execução ativa da operação conjunta antes de encerrar somente a identidade comprovadamente não entregue, adquire o lock da campanha antes dos locks específicos e re-projeta sem rebaixar entrega existente.
- [ ] 1.12 Autorar a RPC de projeção idempotente com lock comum da campanha, dois vínculos coerentes da mesma operação sem `LIMIT 1`, preferência quadrada, fallback vertical e preservação de `ready`.
- [ ] 1.13 Conferir `amount = 1`, CHECKs, grants e semântica das RPCs existentes; documentar timestamp UTC real e checagem de unicidade do prefixo antes da criação da migration.
- [ ] 1.14 Criar testes estáticos/contratuais do SQL e dos envelopes, sem executar migration, banco, Docker ou homolog.
- [ ] 1.15 Implementar cliente server-only das novas RPCs com client injetável, validação fechada de envelope e erros tipados; não alterar os clientes existentes.
- [ ] 1.16 Definir o contrato do modelo de leitura por formato (`delivered`, `processing`, `absent`, `unknown`, `unavailable`), com crédito devolvido, referência de suporte e miniatura preferida, preservando o outro formato entregue quando crédito/artefato de um formato falha, usando fakes de banco.
- [ ] 1.17 Definir os contratos de acesso por formato (preview/download/miniatura) e a elegibilidade do caminho canônico de `square_original`, sem montar UI ou rotas.
- [ ] 1.18 Cobrir leitura/acesso com testes contratuais: formato entregue, processando, ausente, indeterminado, crédito devolvido, miniatura preferida e ausência de fallback para o original.
- [ ] 1.19 Confirmar que a Subfatia A não altera a semântica dos fluxos 1:1/9:16 individuais, não expõe opção conjunta e não aplica migration.

## 2. Gate A — Revisão e aceite da fundação

- [ ] 2.1 Executar typecheck/lint/diff e as suítes focadas da Subfatia A; validar OpenSpec strict.
- [ ] 2.2 Revisar contratos de formato/origem, schema/RPCs, clientes, leitura e acesso, com atenção a idempotência, identidades financeiras e preservação dos fluxos atuais.
- [ ] 2.3 Registrar aceite ou correções da Subfatia A antes de iniciar a orquestração; nenhuma migration é aplicada neste gate.

## 3. Subfatia B — Orquestração conjunta e proteção administrativa

> Entrega técnica intermediária. A opção conjunta ainda não fica disponível ao lojista.

- [ ] 3.1 Implementar o preflight estrito da seleção administrativa antes da abertura conjunta, reutilizando catálogo/pricing e sem provider, reserva ou operação.
- [ ] 3.2 Implementar a abertura conjunta no serviço dedicado, com idempotência, conflito de seleção/origem e leitura dos dois IDs financeiros.
- [ ] 3.3 Implementar a etapa de base reutilizando `runSquareBase`/`runBaseStep` com a identidade da operação conjunta, sem duplicar briefing, copy ou imagem.
- [ ] 3.4 Implementar a sonda de integridade do `square_original` (papel, formato, 1024×1024, JPEG, checksum) e a liquidação da entrega quadrada imediatamente após a base, na ordem artefato persistido/verificado → token de publicação → RPC de confirmação + projeção, sem novo upload.
- [ ] 3.5 Implementar a projeção e a miniatura quadrada após a confirmação do quadrado, antes de preparação/expansão.
- [ ] 3.6 Implementar `deliverTwoFormatVertical` dedicado, sem usar `deliverVertical` como confirmador; reutilizar `control.resume`, sonda vertical, `beginPublication` após o artefato persistido/verificado e a RPC atômica de entrega por formato, sem novo upload.
- [ ] 3.7 Implementar a finalização de falha da base: ausência comprovada estorna os dois formatos; indeterminação não estorna nem repete; arte íntegra liquida a entrega.
- [ ] 3.8 Implementar a falha definitiva de preparação/expansão com estorno somente do vertical e preservação do quadrado entregue.
- [ ] 3.9 Implementar a recuperação que atua somente no formato faltante: não refaz base/copy/quadrado entregue, não reabre estorno e não cria cobrança silenciosa.
- [ ] 3.10 Implementar a liquidação de artefato existente com confirmação pendente, sem chamada de provider.
- [ ] 3.11 Implementar o reparo idempotente de projeção e miniatura em replay/reload, cobrindo falha entre confirmação, projeção e leitura.
- [ ] 3.12 Reconhecer o vínculo conjunto na lista de pendências, exibindo campanha, formato e operação de entrega.
- [ ] 3.13 Usar a sonda `square_original` para a pendência quadrada e a sonda vertical existente para o vertical, nunca a sonda 1:1 legada para o quadrado conjunto.
- [ ] 3.14 Implementar o bloqueio de resolução incompatível e a resolução de entrega/estorno por formato com evidência server-side, auditoria, projeção conjunta e bloqueio de etapa ativa.
- [ ] 3.15 Garantir que ausência/indeterminação não autorize estorno presumido e que o formato já entregue não seja estornado.
- [ ] 3.16 Cobrir com testes integrados offline pelos componentes reais, com fakes apenas nas fronteiras de banco/provider: percurso completo, base única, entrega quadrada, vertical dedicado, entrega parcial, estorno por formato, indeterminação, replay, concorrência, resposta tardia, reload, recuperação somente do faltante e ordem artefato persistido/verificado → token → RPC sem novo upload/duplicação da imagem.
- [ ] 3.17 Cobrir a proteção administrativa: pendência quadrada correta, pendência vertical, entrega com artefato íntegro, estorno sem evidência recusado, etapa ativa bloqueada e formato entregue não estornado.
- [ ] 3.18 Confirmar que a Subfatia B não possui entrypoint público/UI da opção conjunta e que a atomicidade de confirmação+projeção é exercida pela RPC, não por chamadas separadas.

## 4. Gate B — Revisão e aceite da orquestração

- [ ] 4.1 Executar typecheck/lint/diff e as suítes integradas offline da Subfatia B; validar OpenSpec strict.
- [ ] 4.2 Revisar orquestração, entrega parcial, recuperação e proteção administrativa antes de qualquer validação real de banco.
- [ ] 4.3 Registrar aceite ou correções da Subfatia B; confirmar que a opção conjunta permanece indisponível ao lojista.

## 5. Gate de banco — Validação real da migration

> Gate separado e explicitamente autorizado. Sem geração paga, provider, novo ambiente ou produção. Testes estáticos/offline não substituem esta etapa.

- [ ] 5.1 Obter autorização explícita para aplicar a migration no homolog existente e registrar backup/identidade do alvo antes da aplicação.
- [ ] 5.2 Aplicar somente a migration conjunta no homolog autorizado e verificar schema, RLS, grants, RPCs, CHECKs e ausência de alteração em dados existentes.
- [ ] 5.3 Validar no PostgreSQL: abertura atômica das duas reservas, saldo insuficiente sem estado parcial, idempotência, conflito de seleção, concorrência, entrega/estorno por formato, projeção e resposta tardia.
- [ ] 5.4 Validar que as RPCs/consultas dos fluxos 1:1/9:16 individuais e históricos permanecem intactas.
- [ ] 5.5 Registrar evidência e limitações; se a autorização não existir, bloquear a liberação da Subfatia C e não declarar a migration validada.

## 6. Subfatia C — Jornada e apresentação

> Somente após o Gate C a opção conjunta fica disponível ao lojista.

- [ ] 6.1 Implementar o dispatch dedicado no `generate-image` para o formato conjunto, com validação da flag vertical aplicável, fingerprint congelado, `inputFiles`/`resumeContext` e ausência de efeitos antes da validação.
- [ ] 6.2 Implementar a rota/continuação da operação conjunta, reutilizando o schema e os limites existentes, sem aceitar conteúdo novo do navegador.
- [ ] 6.3 Estender o `NewFlowGenerateImageRequestSchema` para aceitar o valor conjunto exato, mantendo a recusa de listas/formatos desconhecidos e sem permitir que o dispatch individual trate o pedido conjunto como 1:1/9:16.
- [ ] 6.4 Atualizar os tipos e o transporte de restauração/formulário/review para o formato conjunto, sem alterar a representação de `1:1` e `9:16` individuais.
- [ ] 6.5 Adicionar a terceira opção de formato no seletor, habilitada apenas com a geração vertical aplicável e com explicação de dois formatos.
- [ ] 6.6 Persistir o formato conjunto no draft, body, fingerprint e restauração, sem alterar o body de `1:1` nem o de `9:16` individual.
- [ ] 6.7 Atualizar a revisão para exibir os dois formatos e o custo total de 2 créditos quando o formato conjunto estiver selecionado.
- [ ] 6.8 Atualizar a checagem de saldo do formulário/rota para 2 créditos no formato conjunto, sem alterar `campaign_generation`, pricing ou o custo dos fluxos individuais.
- [ ] 6.9 Bloquear submissão conjunta quando a flag vertical aplicável estiver OFF, preservando o formato restaurado e sem trocar silenciosamente para 1:1/9:16.
- [ ] 6.10 Adaptar `listCampaigns` para carregar os indicadores conjuntos em lote, mantendo 1:1/9:16/histórico no caminho atual e sem expor `input_snapshot`.
- [ ] 6.11 Implementar o card conjunto com um único card, chips/indicadores, estado parcial, link do formato entregue para `?format=` e ausência/processamento sem ação.
- [ ] 6.12 Adaptar as miniaturas da listagem para usar o caminho derivado do formato preferido, nunca o original como fallback.
- [ ] 6.13 Adaptar o dashboard para exibir a campanha conjunta uma única vez, contar uma vez, indicar os dois formatos e usar a miniatura derivada preferida.
- [ ] 6.14 Adaptar a página de detalhe para reconhecer a origem conjunta antes dos ramos individuais e carregar o modelo por formato.
- [ ] 6.15 Implementar a seleção/tabs 1:1 e 9:16 com `?format=` e pré-seleção validada no servidor.
- [ ] 6.16 Implementar preview individual por formato somente após `delivered` e artefato compatível, com URL assinada curta e sem assinar formato ausente/indeterminado.
- [ ] 6.17 Implementar download individual por formato na rota existente, com `?format=`, fallback preferido e falha fechada, preservando 1:1/9:16 individual e histórico.
- [ ] 6.18 Implementar as miniaturas derivadas do quadrado e do vertical, estendendo a elegibilidade apenas para o caminho canônico do `square_original`.
- [ ] 6.19 Adaptar a tela de processamento e o polling para indicar os dois formatos e continuar acompanhando enquanto qualquer formato estiver em processamento.
- [ ] 6.20 Exibir a copy compartilhada uma única vez no detalhe, inclusive em entrega parcial, sem duplicar o painel por formato.
- [ ] 6.21 Cobrir com testes de UI/read model: card único, indicador abre o formato correto, processamento não gera, ausência sem ação, miniatura quadrada preferida, placeholder sem original, preview/download por formato, formato não entregue sem arte, copy única e reload.

## 7. Gate C — Revisão, aceite e liberação da jornada

- [ ] 7.1 Executar typecheck/lint/build/diff e as suítes focadas da Subfatia C; validar OpenSpec strict.
- [ ] 7.2 Revisar a jornada completa e confirmar que a opção conjunta só fica disponível após o aceite desta subfatia.
- [ ] 7.3 Registrar aceite ou correções; nenhuma ativação de produção, deploy, flag ou pricing é executada neste gate.

## 8. Gates finais e limites

- [ ] 8.1 Executar as suítes de preservação de 1:1, 9:16 individual, histórico, copy, artefatos, download, miniaturas, listagem e pendências.
- [ ] 8.2 Executar as suítes focadas da entrega conjunta, incluindo percurso completo, entrega parcial, confirmação/estorno por formato, replay, concorrência, indeterminação, reload e recuperação somente do faltante.
- [ ] 8.3 Executar `npm run typecheck`, lint, build, `git diff --check` e `openspec validate --changes --strict`.
- [ ] 8.4 Documentar o mapa técnico final, as decisões implementadas, as limitações e as evidências offline no summary da fase.
- [ ] 8.5 Preparar o roteiro objetivo de validação manual futura no homolog existente, sem gerar imagem, chamar provider, aplicar migration ou acessar produção nesta rodada.
- [ ] 8.6 Confirmar que nenhuma flag/pricing foi alterada, nenhum provider foi chamado e nenhum merge/push/deploy foi executado; a aplicação da migration permanece restrita ao Gate de banco autorizado.
