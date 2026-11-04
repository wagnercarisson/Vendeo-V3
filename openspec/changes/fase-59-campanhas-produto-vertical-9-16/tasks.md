## 1. Contrato e prova técnica

- [ ] 1.1 Inspeção read-only de constraints, índices e RPCs atuais (`product_1_1_campaign_artifacts`, `product_1_1_campaign_credit_operations`, tentativas, pendências, `projectDeliveredCampaign`); registrar evidência e confirmar que não há migration estrutural necessária.
- [ ] 1.2 Criar módulo puro de formato (`resolveCampaignFormat`, `formatContractVersion`, erro de formato desconhecido) com testes de ausência das duas chaves = `1:1`, `9:16` com versão reconhecida, versão ausente/inválida/não suportada e par formato/versão incoerente, todos fail-closed.
- [ ] 1.3 Criar política versionada `safe-area-9-16-v1` com percentuais, pixels para 1080 × 1920, retângulo inferior direito e classificação de proveniência; testes de cálculo e versão.
- [ ] 1.4 Criar contrato puro de dimensões e paths: 1152 × 2048 divisível por 16, 1080 × 1920 entregue, path vertical e regex; testes de rejeição de dimensões/paths inválidos.
- [ ] 1.5 Escrever o plano da prova de provider (matriz 14 chamadas, critérios, teto US$ 3,00, evidências a coletar) **com a estimativa conservadora vertical definida antes da primeira chamada** e registrar o checkpoint humano de autorização de gasto.
- [ ] 1.6 **Checkpoint pago:** executar a prova de provider em homolog com `gpt-image-2.5-sunburst` e `gpt-image-2`, qualidades `low`/`medium`, 3 amostras 1152 × 2048 por combinação + 1 controle 1024 × 1024 por modelo.
- [ ] 1.7 Consolidar evidências da prova (dimensão solicitada × devolvida, latência, custo, falhas) e decidir quais pares seguem elegíveis; nenhuma substituição silenciosa.
- [ ] 1.8 Conferir a fonte oficial de áreas seguras (Meta) e/ou capturar sobreposições de Stories/Reels; registrar o que é documentado, conservador e pendente.

## 2. Composição vertical

- [ ] 2.1 Criar política de formato `9:16` e resolver de políticas vertical, reutilizando intenção, produto, identidade, fundo e integridade do 1:1.
- [ ] 2.2 Adicionar resolver opcional ao compositor de prompt, com default 1:1, e provar por teste que a saída 1:1 permanece idêntica.
- [ ] 2.3 Compor o prompt vertical: canvas 9:16, preenchimento total, áreas seguras, proibição de guias/faixas/letterbox, essencial sem legenda externa.
- [ ] 2.4 Criar fixtures de composição (3 intenções × 3 fundos) e teste de diferença controlada: só formato/área segura mudam em relação ao 1:1.
- [ ] 2.5 Revisar o prompt vertical contra o baseline aprovado e registrar critérios visuais de aceite (produto, preço, identidade, legibilidade, área segura).

## 3. Geração, arte e persistência

- [ ] 3.1 Criar módulo de path vertical `{store}/{campaign}/product-9-16/{operation}/art-1080x1920.jpg` com testes de pattern e isolamento do path 1:1.
- [ ] 3.2 Implementar pipeline `resizeVerticalToJpeg1080x1920` (fonte exata 1152 × 2048, fator 0,9375, sRGB, JPEG 90) com testes de dimensão, proporção, sem faixas e decode completo.
- [ ] 3.3 Implementar store vertical (upload imutável, metadados reais em `product_1_1_campaign_artifacts`, probe tipado, download, URL assinada) com testes de integridade e path.
- [ ] 3.4 Adicionar reconhecimento do path vertical ao mecanismo de miniaturas e provar WebP 162 × 288, `upsert:false`, sem crop/upscale e falha isolada.
- [ ] 3.5 Adicionar `imageSize`, `composePrompt` e `beforeReservation` opcionais à engine, com defaults 1:1, e provar por testes que o caminho 1:1 não muda; a guarda pré-reserva exige estimativa vertical e teto antes de reserva/provider.
- [ ] 3.6 Criar o entrypoint vertical (perfil de formato) injetando gateway 1152 × 2048, store vertical, compositor vertical e path esperado de projeção.
- [ ] 3.7 Adicionar `expectedArtifactPath` opcional à projeção de entrega, com default 1:1, e testar projeção vertical `ready`/`error`.
- [ ] 3.8 Integrar crédito no perfil vertical e testar reserva, `art_uploaded`, `delivered`, estorno único e resultado desconhecido com fakes.
- [ ] 3.9 Tornar a recuperação/pendências ciente do formato (interface mínima de probe + injeção vertical), sem alterar o comportamento 1:1.
- [ ] 3.10 Testar idempotência por `campaignId`/`operationId`, conflito de formato (409), concorrência sem dupla cobrança e reenvio sem provider.
- [ ] 3.11 Implementar estimativa de custo ciente de 1152 × 2048 (multiplicador vertical versionado ou prova de equivalência) e gate por chamada que bloqueia sem estimativa ou sem saldo; retries contam no teto.
- [ ] 3.12 Propagar o formato e o path esperado pela cadeia de recuperação: rota `image-recovery`, `ProductOneToOneArtifactRecovery`, repositório/resolução de pendências e `projectDeliveredCampaign`; teste ponta a ponta até detalhe/listagem sem nova geração.

## 4. Integração da criação e entrega

- [ ] 4.1 Estender o schema do fluxo novo com `campaignFormat` opcional e testes de payload 1:1 inalterado e formato inválido 400.
- [ ] 4.2 Congelar `campaignFormat`/`formatContractVersion` no `input_snapshot` vertical, incluir no hash de conteúdo e provar que o snapshot 1:1 não ganha chaves.
- [ ] 4.3 Despachar o vertical na rota antes da reserva, com mismatch 409 e nenhum efeito colateral; testar caminho 1:1 intocado.
- [ ] 4.4 Adicionar estado, body e fingerprint do formato no hook do formulário, garantindo que trocar o formato gera nova identidade de rascunho.
- [ ] 4.5 Adicionar o seletor de formato com rótulos e helper aprovados, apenas sob elegibilidade e flag; testes de acessibilidade e de ausência fora do escopo.
- [ ] 4.6 Adicionar a chave global `product_9_16_enabled` ao serviço e ao painel admin, com leitura fail-closed e testes de flag ausente/inválida.
- [ ] 4.7 **Checkpoint de migration:** se aprovado, criar a migration data-only de seed da flag com timestamp UTC real, verificar unicidade e aplicar somente em homolog.
- [ ] 4.8 Despachar download por formato persistido (`9:16` vertical, `1:1`/ausente inalterado, malformado 503) e testar attachment e bloqueio antes de `delivered`.
- [ ] 4.9 Despachar o detalhe da campanha por formato para probe/URL vertical, mantendo o 1:1 intocado.
- [ ] 4.10 Integrar lista/miniatura e projeção para reconhecer o path vertical, sem redesenhar cards.
- [ ] 4.11 Registrar formato e dimensões solicitada/devolvida/entregue na telemetria por tentativa, sem prompt/chave/bytes.
- [ ] 4.12 Atualizar documentação operacional e o runbook com flag, paths, dimensões, política de área segura e procedimento de rollback.
- [ ] 4.13 Transportar formato/versão no `CampaignFormRestore`, preservar a escolha no rascunho/revisão/nova tentativa e bloquear submissão com flag OFF sem trocar silenciosamente para `1:1`; testes de restauração.

## 5. Validação

- [ ] 5.1 Rodar suítes focadas novas (formato, safe area, prompt, arte, thumbnail, crédito, recuperação, download, UI).
- [ ] 5.2 Rodar a regressão 1:1 existente sem alterar expectativas; qualquer falha bloqueia a entrega.
- [ ] 5.3 Rodar typecheck, lint e build; registrar resultados e limitações conhecidas.
- [ ] 5.4 Rodar `openspec validate --strict` nesta change e nas specs principais afetadas.
- [ ] 5.5 Preparar homolog com lojas de teste, saldo controlado e flag vertical ligada; registrar baseline e ambiente.
- [ ] 5.6 Executar a matriz funcional vertical em homolog (intenções e fundos acordados): geração, arte 1080 × 1920, crédito, download, miniatura e projeção.
- [ ] 5.7 Executar a revisão visual com sobreposições de Stories/Reels: essencial dentro da área segura, sem faixas/guias, fundo preenchendo o canvas, peça compreensível sem legenda.
- [ ] 5.8 Executar cenários de falha/recuperação em homolog: resultado desconhecido, falha confirmada com estorno único, reenvio e operação já entregue.
- [ ] 5.9 Executar uma geração manual 1:1 em homolog e comparar com o comportamento atual.
- [ ] 5.10 Emitir relatório de aceite de homolog com evidências, limitações e critérios pendentes; **não** declarar produção aprovada.
- [ ] 5.11 Preparar o gate separado de produção (deploy, ativação da flag, smoke e rollback) sem executá-lo nesta fase.
- [ ] 5.12 Testar o ciclo de flag: iniciar geração com ON, desligar e comprovar consulta, download, recuperação de imagem/copy e resolução administrativa preservados, com geração em andamento chegando ao terminal.
- [ ] 5.13 Testar recuperação vertical completa (imagem + resolução administrativa) até detalhe/listagem, sem nova geração e sem projeção com path 1:1.
- [ ] 5.14 Testar restauração vertical com flag ON e OFF, incluindo bloqueio explicado e ausência de troca silenciosa para `1:1`.
- [ ] 5.15 Validar a estimativa vertical contra o custo reportado na prova e registrar o desvio; confirmar que o orçamento da UAT é separado do teto da prova.
