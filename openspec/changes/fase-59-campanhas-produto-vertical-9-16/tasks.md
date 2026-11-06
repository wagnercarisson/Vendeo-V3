## 1. Contrato e prova técnica

- [x] 1.1 Inspeção read-only de constraints, índices e RPCs atuais (`product_1_1_campaign_artifacts`, `product_1_1_campaign_credit_operations`, tentativas, pendências, `projectDeliveredCampaign`); registrar evidência e confirmar que não há migration estrutural necessária.
- [x] 1.2 Criar módulo puro de formato (`resolveCampaignFormat`, `formatContractVersion`, erro de formato desconhecido) com testes de ausência das duas chaves = `1:1`, `9:16` com versão reconhecida, versão ausente/inválida/não suportada e par formato/versão incoerente, todos fail-closed.
- [x] 1.3 Criar política versionada `safe-area-9-16-v1` com percentuais, pixels para 1080 × 1920, retângulo inferior direito e classificação de proveniência; testes de cálculo e versão.
- [x] 1.4 Criar contrato puro de dimensões e paths: 1152 × 2048 divisível por 16, 1080 × 1920 entregue, path vertical e regex; testes de rejeição de dimensões/paths inválidos.
- [x] 1.5 Escrever o plano da prova de provider (matriz derivada do par principal/fallback efetivo do 1:1, critérios, teto US$ 3,00, evidências a coletar) **com a estimativa conservadora vertical definida antes da primeira chamada**, loader com `maxRetries: 0`/credencial validada e parada em dimensão divergente ou custo não apurado; registrar o checkpoint humano de autorização de gasto.
- [x] 1.6 **Checkpoint pago:** executar a prova de provider em homolog com o par principal/fallback e qualidades da configuração efetiva do 1:1, usando a mesma fonte `ai_model_pricing`, 3 amostras 1152 × 2048 por par único + 1 controle 1024 × 1024 por par; parar e apresentar evidência se a dimensão vertical não for suportada, sem trocar a configuração.
- [x] 1.7 Consolidar evidências da prova (dimensão solicitada × devolvida, latência, custo, falhas) e decidir quais pares seguem elegíveis; nenhuma substituição silenciosa.
- [x] 1.8 Conferir a fonte oficial de áreas seguras (Meta) e/ou capturar sobreposições de Stories/Reels; registrar o que é documentado, conservador e pendente.

## 2. Composição vertical

- [x] 2.1 Criar política de formato `9:16` e resolver de políticas vertical, reutilizando intenção, produto, identidade, fundo e integridade do 1:1.
- [x] 2.2 Adicionar resolver opcional ao compositor de prompt, com default 1:1, e provar por teste que a saída 1:1 permanece idêntica.
- [x] 2.3 Compor o prompt vertical: canvas 9:16, preenchimento total, áreas seguras, proibição de guias/faixas/letterbox, essencial sem legenda externa.
- [x] 2.4 Criar fixtures de composição (3 intenções × 3 fundos) e teste de diferença controlada: só formato/área segura mudam em relação ao 1:1.
- [x] 2.5 Revisar o prompt vertical contra o baseline aprovado e registrar critérios visuais de aceite (produto, preço, identidade, legibilidade, área segura).

## 3. Geração, arte e persistência

- [x] 3.1 Criar módulo de path vertical `{store}/{campaign}/product-9-16/{operation}/art-1080x1920.jpg` com testes de pattern e isolamento do path 1:1.
- [x] 3.2 Implementar pipeline `resizeVerticalToJpeg1080x1920` (fonte exata 1152 × 2048, fator 0,9375, sRGB, JPEG 90) com testes de dimensão, proporção, sem faixas e decode completo.
- [x] 3.3 Implementar store vertical (upload imutável, metadados reais em `product_1_1_campaign_artifacts`, probe tipado, download, URL assinada) com testes de integridade e path.
- [x] 3.4 Adicionar reconhecimento do path vertical ao mecanismo de miniaturas e provar WebP 162 × 288, `upsert:false`, sem crop/upscale e falha isolada.
- [x] 3.5 Adicionar `imageSize`, `composePrompt` e `beforeReservation` opcionais à engine, com defaults 1:1, e provar por testes que o caminho 1:1 não muda; a guarda pré-reserva exige estimativa vertical e teto antes de reserva/provider.
- [x] 3.6 Criar o entrypoint vertical (perfil de formato) injetando gateway 1152 × 2048, store vertical, compositor vertical e path esperado de projeção.
- [x] 3.7 Adicionar `expectedArtifactPath` opcional à projeção de entrega, com default 1:1, e testar projeção vertical `ready`/`error`.
- [x] 3.8 Integrar crédito no perfil vertical e testar reserva, `art_uploaded`, `delivered`, estorno único e resultado desconhecido com fakes.
- [x] 3.9 Tornar a recuperação/pendências ciente do formato (interface mínima de probe + injeção vertical), sem alterar o comportamento 1:1.
- [x] 3.10 Testar idempotência por `campaignId`/`operationId`, conflito de formato (409), concorrência sem dupla cobrança e reenvio sem provider.
- [x] 3.11 Implementar estimativa de custo ciente de 1152 × 2048 (multiplicador vertical versionado ou prova de equivalência) e gate por chamada que bloqueia sem estimativa ou sem saldo; retries contam no teto.
- [x] 3.12 Propagar o formato e o path esperado pela cadeia de recuperação: rota `image-recovery`, `ProductOneToOneArtifactRecovery`, repositório/resolução de pendências e `projectDeliveredCampaign`; teste ponta a ponta até detalhe/listagem sem nova geração.

## 4. Integração da criação e entrega

- [x] 4.1 Estender o schema do fluxo novo com `campaignFormat` opcional e testes de payload 1:1 inalterado e formato inválido 400.
- [x] 4.2 Congelar `campaignFormat`/`formatContractVersion` no `input_snapshot` vertical, incluir no hash de conteúdo e provar que o snapshot 1:1 não ganha chaves.
- [x] 4.3 Despachar o vertical na rota antes da reserva, com mismatch 409 e nenhum efeito colateral; testar caminho 1:1 intocado.
- [x] 4.4 Adicionar estado, body e fingerprint do formato no hook do formulário, garantindo que trocar o formato gera nova identidade de rascunho.
- [x] 4.5 Adicionar o seletor de formato com rótulos e helper aprovados, apenas sob elegibilidade e flag; testes de acessibilidade e de ausência fora do escopo.
- [x] 4.6 Adicionar a chave global `product_9_16_enabled` ao serviço e ao painel admin, com leitura fail-closed e testes de flag ausente/inválida.
- [x] 4.7 **Checkpoint de migration:** se aprovado, criar a migration data-only de seed da flag com timestamp UTC real, verificar unicidade e aplicar somente em homolog.
- [x] 4.8 Despachar download por formato persistido (`9:16` vertical, `1:1`/ausente inalterado, malformado 503) e testar attachment e bloqueio antes de `delivered`.
- [x] 4.9 Despachar o detalhe da campanha por formato para probe/URL vertical, mantendo o 1:1 intocado.
- [x] 4.10 Integrar lista/miniatura e projeção para reconhecer o path vertical, sem redesenhar cards.
- [x] 4.11 Registrar formato e dimensões solicitada/devolvida/entregue na telemetria por tentativa, sem prompt/chave/bytes.
- [x] 4.12 Atualizar documentação operacional e o runbook com flag, paths, dimensões, política de área segura e procedimento de rollback.
- [x] 4.13 Transportar formato/versão no `CampaignFormRestore`, preservar a escolha no rascunho/revisão/nova tentativa e bloquear submissão com flag OFF sem trocar silenciosamente para `1:1`; testes de restauração.

## 5. Validação

- [x] 5.1 Rodar suítes focadas novas (formato, safe area, prompt, arte, thumbnail, crédito, recuperação, download, UI).
- [x] 5.2 Rodar a regressão 1:1 existente sem alterar expectativas; qualquer falha bloqueia a entrega.
- [x] 5.3 Rodar typecheck, lint e build; registrar resultados e limitações conhecidas.
- [x] 5.4 Rodar `openspec validate --strict` nesta change e nas specs principais afetadas.
- [x] 5.5 Preparar homolog com lojas de teste, saldo controlado e flag vertical ligada; registrar baseline e ambiente.
- [x] 5.6 Executar a matriz funcional vertical em homolog (intenções e fundos acordados): geração, arte 1080 × 1920, crédito, download, miniatura e projeção.
- [ ] 5.7 Executar a revisão visual com sobreposições de Stories/Reels: essencial dentro da área segura, sem faixas/guias, fundo preenchendo o canvas, peça compreensível sem legenda. **Reels pendente de preview real; máscara antiga é análise conservadora de risco, não validação de interface.** **Reels revisado e não aprovado; correções na quick pós-F59.**
- [x] 5.8 Executar cenários de falha/recuperação em homolog: resultado desconhecido, falha confirmada com estorno único, reenvio e operação já entregue.
- [x] 5.9 Executar uma geração manual 1:1 em homolog e comparar com o comportamento atual.
- [x] 5.10 Emitir relatório de aceite de homolog com evidências, limitações e critérios pendentes; **não** declarar produção aprovada.
- [x] 5.11 Preparar o gate separado de produção (deploy, ativação da flag, smoke e rollback) sem executá-lo nesta fase.
- [ ] 5.12 Testar o ciclo de flag: iniciar geração com ON, desligar e comprovar consulta, download, recuperação de imagem/copy e resolução administrativa preservados, com geração em andamento chegando ao terminal. **Parcial: consulta/download/restauração e in-flight comprovados; recuperação/resolução com flag OFF não executadas.** **Parcial: consulta/download/restauração e in-flight comprovados; recuperação/resolução com flag OFF não executadas.**
- [x] 5.13 Testar recuperação vertical completa (imagem + resolução administrativa) até detalhe/listagem, sem nova geração e sem projeção com path 1:1.
- [ ] 5.14 Testar restauração vertical com flag ON e OFF, incluindo bloqueio explicado e ausência de troca silenciosa para `1:1`. **Parcial: restauração com flag OFF comprovada; ON coberto por teste.** **Parcial: restauração com flag OFF comprovada; ON coberto por teste.**
- [ ] 5.15 Validar a estimativa vertical contra o custo reportado na prova e registrar o desvio; confirmar que o orçamento da UAT é separado do teto da prova. **Parcial: incremento contábil 0,1107; custo real por usage não reconciliado.** **Parcial: incremento contábil 0,1107; custo real por usage não reconciliado.**
