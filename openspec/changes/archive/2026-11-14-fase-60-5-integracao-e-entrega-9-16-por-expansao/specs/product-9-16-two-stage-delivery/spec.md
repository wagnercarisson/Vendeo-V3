# Product 9:16 Two-Stage Delivery

## Purpose

Define a entrega do novo 9:16 por expansão: um único vertical final 1080×1920 JPEG + copy, projeção da campanha entregue, acesso autorizado de detalhe/listagem/preview/thumbnail/download pela F60.1, sem duplicar o arquivo em `campaign-images` e sem expor a base 1024 ou o preparado 1152. Inclui a leitura de campanhas históricas e a resolução administrativa de pendências por origem canônica.

## ADDED Requirements

### Requirement: Entrega composta por um vertical final e a copy

O sistema SHALL entregar ao lojista apenas o vertical final JPEG 1080×1920 e a copy da campanha. O vertical SHALL ser o artefato `vertical` persistido pela F60.1, com checksum e evidência durável. A entrega SHALL NOT incluir a base 1024, o preparado 1152, o retorno bruto 1152×2048, metadados internos de tentativa ou qualquer outro papel de artefato.

#### Scenario: Entrega contém um único arquivo visual de entrega

- **WHEN** a campanha 9:16 por expansão é entregue
- **THEN** exatamente um arquivo visual de entrega SHALL estar acessível ao lojista
- **AND** ele SHALL ser JPEG 1080×1920
- **AND** a copy entregue SHALL acompanhar a campanha
- **AND** a miniatura de exibição dos cards SHALL ser um derivado separado, não uma segunda entrega

#### Scenario: Papéis internos não são entregues

- **WHEN** detalhe, listagem, preview ou download resolvem a campanha
- **THEN** somente o papel `vertical` SHALL ser consultado como fonte
- **AND** o original vertical SHALL ser usado em preview/download; a miniatura derivada SHALL ser usada apenas nos cards
- **AND** `square_original` e `square_prepared` SHALL permanecer inacessíveis ao lojista

#### Scenario: Vertical ausente não é substituído

- **WHEN** o vertical final está ausente
- **THEN** o sistema SHALL NOT usar a base, o preparado ou o bruto como substituto
- **AND** SHALL NOT expor URL, download ou thumbnail da campanha

### Requirement: Um único vertical de entrega com miniatura derivada de exibição

O sistema SHALL manter o vertical de entrega em um único objeto no bucket interno de artefatos de composição. O sistema SHALL NOT copiar, mover, reenviar ou registrar uma segunda cópia do vertical em `campaign-images` nem em outro bucket/path. O sistema SHALL gerar uma **miniatura derivada de exibição** (≤288 px, WebP) a partir do vertical, no bucket `campaign-images`, para os cards/listagem. A miniatura SHALL NOT ser tratada como segunda cópia da entrega; detalhe/preview e download SHALL usar o vertical original.

#### Scenario: Nenhuma segunda cópia do vertical é criada

- **WHEN** a entrega do vertical é concluída
- **THEN** SHALL existir um único objeto visual de entrega da campanha no bucket interno
- **AND** nenhum objeto com os bytes do vertical SHALL ser escrito em `campaign-images`

#### Scenario: Miniatura derivada é gerada para o card

- **WHEN** o vertical é entregue
- **THEN** o sistema SHALL gerar, de forma best-effort, uma miniatura WebP derivada
- **AND** a listagem SHALL assinar essa miniatura
- **AND** falha da miniatura SHALL NOT bloquear entrega, crédito ou download

#### Scenario: Preview e download usam o original

- **WHEN** o lojista abre o detalhe ou baixa a campanha
- **THEN** o sistema SHALL usar o vertical original no bucket interno
- **AND** SHALL NOT usar a miniatura como arte de entrega

#### Scenario: Consumidores antigos não recebem path interno como se fosse campaign-images

- **WHEN** um consumidor lê `campaigns.storage_path` de uma campanha 9:16 por expansão
- **THEN** ele SHALL resolver o bucket pela origem persistida
- **AND** SHALL NOT tentar baixar o path interno de `campaign-images`

### Requirement: Acesso somente após entrega autorizada

O sistema SHALL expor visualização, thumbnail e download somente quando a autoridade financeira estiver `delivered`, a origem for `9_16_two_stage`, o vínculo loja↔campanha↔operação for válido e o artefato vertical for compatível. Nenhuma URL assinada, thumbnail ou download SHALL ser produzido antes de `delivered`. Operação reservada, desconhecida, estornada ou origem divergente SHALL retornar indisponível.

#### Scenario: Operação reservada não expõe arte

- **WHEN** a operação está `reserved`, `art_uploaded` ou desconhecida
- **THEN** o sistema SHALL NOT criar URL assinada, thumbnail ou download
- **AND** SHALL NOT inferir entrega pela presença de objeto no Storage

#### Scenario: Operação entregue expõe o vertical

- **WHEN** a operação está `delivered` e o vertical é compatível
- **THEN** o sistema SHALL permitir detalhe, visualização e download
- **AND** SHALL usar TTL curto para a URL de visualização

#### Scenario: Origem ou vínculo divergente

- **WHEN** a campanha, a loja, a operação ou a origem não conferem
- **THEN** o sistema SHALL falhar fechado
- **AND** SHALL NOT assinar, baixar ou revelar a existência do artefato

### Requirement: Projeção da campanha entregue reconhece a fonte de composição

O sistema SHALL projetar a campanha como entregue somente após validar a operação `delivered`, o vínculo loja↔campanha e a linha `vertical` de `campaign_composition_artifacts` com path, dimensão e MIME compatíveis. A projeção SHALL atualizar `status = ready`, limpar o erro e apontar `storage_path` para o path determinístico do vertical interno. A projeção SHALL NOT tocar a arte 1:1, aprovação comercial ou crédito, e SHALL ser idempotente.

#### Scenario: Projeção aplicada após entrega

- **WHEN** o crédito está `delivered` e a linha vertical é compatível
- **THEN** a campanha SHALL ficar `ready`
- **AND** `storage_path` SHALL apontar para o vertical interno
- **AND** o erro SHALL ser limpo

#### Scenario: Projeção sem arte válida é recusada

- **WHEN** a linha vertical está ausente, incompatível ou não corresponde ao path esperado
- **THEN** a campanha SHALL NOT ser marcada `ready`
- **AND** SHALL NOT haver URL, download ou thumbnail

#### Scenario: Projeção repetida é idempotente

- **WHEN** a projeção é executada novamente após já ter sido aplicada
- **THEN** ela SHALL retornar o estado já projetado
- **AND** SHALL NOT duplicar atualização, entrega, cobrança ou auditoria

### Requirement: Detalhe, listagem, preview e download resolvem por origem

O sistema SHALL resolver o acesso visual pela origem persistida e pelo formato. Campanhas `9_16_two_stage` SHALL usar o adaptador de vertical F60.1; campanhas históricas 9:16 SHALL usar o store vertical direto existente; campanhas 1:1 SHALL permanecer no caminho atual. O detalhe SHALL exibir o vertical na moldura 9:16; a listagem SHALL exibir o card 9:16; o download SHALL devolver os bytes autoritativos com nome seguro.

#### Scenario: Detalhe da campanha nova

- **WHEN** o lojista abre o detalhe de uma campanha 9:16 por expansão entregue
- **THEN** a imagem exibida SHALL ser o vertical F60.1
- **AND** a moldura SHALL ser 9:16
- **AND** a copy entregue SHALL ser exibida quando disponível

#### Scenario: Listagem da campanha nova

- **WHEN** uma campanha 9:16 por expansão entregue aparece na listagem
- **THEN** o card SHALL identificá-la como 9:16
- **AND** a imagem do card SHALL vir da miniatura derivada do vertical
- **AND** campanhas não entregues SHALL permanecer sem imagem/placeholder

#### Scenario: Download da campanha nova

- **WHEN** o lojista baixa uma campanha 9:16 por expansão entregue
- **THEN** o sistema SHALL devolver o JPEG 1080×1920 autoritativo
- **AND** SHALL usar nome de arquivo seguro
- **AND** SHALL NOT redirecionar para uma URL de exibição pública

#### Scenario: Campanha histórica continua no caminho atual

- **WHEN** o detalhe/listagem/download resolve uma campanha 9:16 histórica entregue
- **THEN** o sistema SHALL usar o store vertical direto existente
- **AND** SHALL preservar os bytes e o comportamento atuais

### Requirement: Copy entregue e recuperação sem regenerar imagem ou cobrar crédito

O sistema SHALL exibir a copy entregue da operação `9_16_two_stage` quando existir. A recuperação de copy SHALL usar o conteúdo congelado da operação, SHALL ser somente texto e SHALL NOT regenerar imagem, confirmar crédito, estornar ou reservar novo crédito. Falha da copy SHALL NOT esconder o vertical entregue.

#### Scenario: Copy disponível aparece com o vertical

- **WHEN** a operação entregue possui copy persistida
- **THEN** o detalhe SHALL exibir a copy
- **AND** o vertical SHALL permanecer visível

#### Scenario: Copy ausente não bloqueia o vertical

- **WHEN** a copy está ausente, pendente ou falhou
- **THEN** o vertical entregue SHALL continuar visível e baixável
- **AND** a superfície de recuperação de copy SHALL permanecer disponível

#### Scenario: Recuperação de copy não gera imagem

- **WHEN** o lojista recupera a copy de uma operação entregue
- **THEN** somente o texto SHALL ser gerado/persistido
- **AND** SHALL NOT haver nova imagem, novo crédito, confirmação ou estorno

### Requirement: Resultado desconhecido não oferece recuperação de imagem ao lojista

O sistema SHALL NOT oferecer ao lojista a ação de recuperar imagem quando a operação `9_16_two_stage` tem resultado desconhecido. A resolução desse estado SHALL ser administrativa, auditada e baseada em evidência server-side. A ação de verificar novamente SHALL permanecer somente leitura.

#### Scenario: Painel desconhecido sem recuperação de imagem

- **WHEN** a operação 9:16 por expansão está desconhecida
- **THEN** a tela SHALL mostrar verificação e suporte
- **AND** SHALL NOT oferecer recuperação de imagem ou nova geração

#### Scenario: Verificação não executa etapa

- **WHEN** o lojista aciona verificar novamente
- **THEN** o sistema SHALL apenas consultar o estado persistido
- **AND** SHALL NOT adquirir etapa, chamar provider, confirmar ou estornar

### Requirement: Resolução administrativa reconhece a origem e usa evidência real

O sistema SHALL reconhecer operações `9_16_two_stage` na lista de pendências, exibindo etapa, tentativas e estado. A resolução administrativa SHALL recusar encerramento com execução ativa e SHALL exigir motivo/evidência server-side. A decisão de entregar SHALL exigir vertical F60.1 íntegro; a decisão de estornar SHALL exigir ausência comprovada. A resolução SHALL ser idempotente e auditada na mesma transação.

#### Scenario: Operação nova aparece na lista

- **WHEN** uma operação `9_16_two_stage` está não terminal e requer atenção
- **THEN** a listagem administrativa SHALL exibir a operação, origem e etapa
- **AND** SHALL indicar corretamente se há execução ativa

#### Scenario: Encerramento com etapa ativa é recusado

- **WHEN** um administrador tenta encerrar uma operação com etapa ativa
- **THEN** o sistema SHALL recusar fail-closed
- **AND** SHALL NOT abandonar a etapa ativa fora do caminho autorizado

#### Scenario: Entrega administrativa exige vertical íntegro

- **WHEN** um administrador decide entregar uma operação desconhecida
- **THEN** a sonda vertical F60.1 SHALL ser integral
- **AND** a projeção SHALL usar o path vertical validado
- **AND** a decisão SHALL ser auditada

#### Scenario: Estorno administrativo exige ausência

- **WHEN** um administrador decide estornar uma operação sem entrega
- **THEN** a sonda vertical SHALL ser `absent`
- **AND** exatamente um estorno SHALL ser aplicado
- **AND** a operação SHALL ficar terminal

#### Scenario: Resolução repetida é idempotente

- **WHEN** a mesma resolução administrativa é reapresentada
- **THEN** o sistema SHALL devolver o resultado já registrado
- **AND** SHALL NOT duplicar entrega, estorno ou auditoria

### Requirement: Campanhas históricas permanecem acessíveis sem conversão

O sistema SHALL manter campanhas 9:16 históricas entregues legíveis, visualizáveis e baixáveis pelo caminho atual. Uma campanha histórica SHALL NOT ser convertida, reclassificada ou reescrita para a origem `9_16_two_stage` por conveniência de leitura. Pendências históricas SHALL ter resolução segura sem nova geração.

#### Scenario: Histórico entregue mantém acesso

- **WHEN** uma campanha 9:16 histórica está entregue e íntegra
- **THEN** detalhe, visualização e download SHALL continuar funcionando
- **AND** nenhum marcador de origem nova SHALL ser gravado

#### Scenario: Histórico pendente não é convertido

- **WHEN** uma campanha 9:16 histórica está pendente ou desconhecida
- **THEN** o sistema SHALL mostrar estado seguro de atendimento
- **AND** SHALL NOT convertê-la para o novo fluxo nem gerar outra imagem

### Requirement: Nenhum artefato interno é exposto em logs, URLs ou respostas públicas

O sistema SHALL NOT retornar ao lojista paths internos, buckets internos, checksums internos, IDs de tentativa, tokens de publicação ou conteúdo da base/preparado. Respostas públicas SHALL conter apenas o necessário para exibir/baixar o vertical entregue e a copy. Diagnóstico técnico SHALL permanecer em logs/eventos internos.

#### Scenario: Resposta de detalhe não expõe artefato interno

- **WHEN** o detalhe de uma campanha 9:16 por expansão é renderizado
- **THEN** a resposta SHALL conter apenas a URL assinada do vertical e os dados públicos da campanha
- **AND** SHALL NOT conter path interno, bucket, checksum, token ou IDs de tentativa

#### Scenario: Download não revela metadados internos

- **WHEN** o vertical é baixado
- **THEN** a resposta SHALL conter os bytes, o MIME e o nome seguro
- **AND** SHALL NOT conter metadados de composição, evidência ou crédito

#### Scenario: Base e preparado permanecem inacessíveis

- **WHEN** qualquer rota pública ou autenticada de campanha é chamada
- **THEN** nenhuma URL, download ou thumbnail de `square_original`/`square_prepared` SHALL ser produzido
- **AND** nenhuma listagem de artefatos internos SHALL ser exposta
