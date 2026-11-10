## ADDED Requirements

### Requirement: Artefato com identidade e vínculo explícitos

O módulo SHALL representar cada artefato de composição pela identidade `(store_id, campaign_id, operation_id, role)` e SHALL persistir o vínculo com loja, campanha e operação. O módulo SHALL validar server-side que a campanha pertence à loja informada e SHALL NOT aceitar caminho de storage, loja, campanha ou operação arbitrários fornecidos pelo cliente como prova de autorização. O `operation_id` SHALL ser tratado como identidade estável da orquestração: a mesma operação e o mesmo papel resolvem o mesmo artefato; operações distintas produzem artefatos distintos.

Toda operação que lê ou grava bytes — persistência, recuperação e resolução de fonte — SHALL exigir um contexto de autorização `owner` ou `system`, derivado pelo servidor e nunca do payload do cliente. `owner` SHALL validar a propriedade da loja; `system` SHALL ser capacidade de servidor/orquestrador e SHALL NOT dispensar o vínculo loja↔campanha.

#### Scenario: Identidade válida é persistida

- **WHEN** a persistência recebe loja, campanha e operação válidas, com a campanha pertencendo à loja
- **THEN** o artefato SHALL ser gravado com os três vínculos e o papel informado
- **AND** uma leitura pela mesma identidade SHALL localizar o mesmo artefato

#### Scenario: Contexto de autorização é obrigatório

- **WHEN** uma operação de persistência, recuperação ou resolução de fonte não recebe contexto `owner` ou `system` válido
- **THEN** a operação SHALL ser recusada
- **AND** nenhum byte SHALL ser lido ou gravado

#### Scenario: Campanha de outra loja é recusada

- **WHEN** a campanha informada não pertence à loja informada
- **THEN** a persistência SHALL ser recusada com conflito de identidade
- **AND** nenhum objeto ou linha SHALL ser criado

#### Scenario: Caminho arbitrário não é aceito

- **WHEN** o chamador fornece um caminho de storage em vez de uma identidade
- **THEN** o módulo SHALL recusar a operação
- **AND** o caminho SHALL NOT ser usado para autorizar leitura, escrita ou assinatura

#### Scenario: Operações distintas não colidem

- **WHEN** dois artefatos do mesmo papel são persistidos para a mesma campanha e loja, mas com operações diferentes
- **THEN** cada um SHALL manter sua própria linha e seu próprio caminho
- **AND** nenhum SHALL sobrescrever o outro

### Requirement: Papéis, formatos e dimensões reais

O módulo SHALL distinguir `square_original` (1:1, 1024×1024), `square_prepared` (1:1, 1152×1152) e `vertical` (9:16, 1080×1920). O MIME SHALL ser `image/jpeg` na v1. A validação SHALL aplicar limites de bytes e pixels antes da decodificação completa e SHALL decodificar os bytes por completo com o decodificador real, não apenas ler cabeçalho, extensão ou metadado declarado. Dimensão, formato ou MIME incompatíveis com o papel SHALL ser recusados sem publicar o artefato.

#### Scenario: Limites são aplicados antes do decode

- **WHEN** os bytes excedem o limite configurado de bytes ou pixels
- **THEN** o módulo SHALL recusar a validação antes da decodificação completa
- **AND** nenhum objeto ou linha SHALL ser criado

#### Scenario: Quadrado original é aceito

- **WHEN** bytes JPEG 1024×1024 são persistidos com o papel `square_original`
- **THEN** o artefato SHALL ser aceito com formato 1:1
- **AND** largura e altura persistidas SHALL ser exatamente 1024 e 1024

#### Scenario: Cópia preparada é aceita

- **WHEN** bytes JPEG 1152×1152 são persistidos com o papel `square_prepared`
- **THEN** o artefato SHALL ser aceito com formato 1:1
- **AND** largura e altura persistidas SHALL ser exatamente 1152 e 1152

#### Scenario: Vertical é aceito

- **WHEN** bytes JPEG 1080×1920 são persistidos com o papel `vertical`
- **THEN** o artefato SHALL ser aceito com formato 9:16
- **AND** largura e altura persistidas SHALL ser exatamente 1080 e 1920

#### Scenario: Dimensão incompatível com o papel é recusada

- **WHEN** bytes 1080×1920 são apresentados como `square_original`
- **THEN** a persistência SHALL ser recusada
- **AND** nenhum objeto ou linha SHALL ser criado

#### Scenario: Bytes truncados ou não JPEG são recusados

- **WHEN** os bytes estão truncados, não decodificam por completo ou não são JPEG
- **THEN** o artefato SHALL ser classificado como inválido
- **AND** SHALL NOT ser publicado como artefato íntegro

### Requirement: Persistência imutável com metadados reais e proveniência

O módulo SHALL calcular bytes e checksum SHA-256 a partir dos bytes efetivamente gravados e SHALL persistir dimensões e MIME derivados da decodificação. O caminho SHALL ser determinístico a partir da identidade e do papel, e o upload SHALL usar `upsert: false`. A linha persistida SHALL ser imutável: UPDATE e DELETE SHALL ser recusados. A proveniência SHALL registrar origem, artefato de origem e campanha de origem quando aplicável, por allowlist server-side. Para derivados, a origem SHALL ser revalidada server-side: artefato interno por linha/bytes/checksum ou campanha entregue (legado ou novo fluxo 1:1) por descritor canônico com checksum, sem criar linha fictícia.

O upload SHALL gravar, no mesmo request dos bytes, uma evidência durável normalizada nos metadados do objeto, contendo identidade, papel, origem, referência de origem, dimensões, MIME, bytes, checksum e digest de proveniência. A evidência SHALL exigir `sourceArtifactId` para artefato interno e `sourceCampaignId`/`sourceOrigin` para campanha entregue. A evidência SHALL sobreviver à falha do insert da linha e SHALL ser verificada antes de qualquer adoção de objeto órfão. Bytes sozinhos SHALL NOT comprovar a origem.

#### Scenario: Metadados vêm dos bytes

- **WHEN** o artefato é persistido
- **THEN** largura, altura, MIME, tamanho em bytes e checksum SHALL corresponder aos bytes gravados
- **AND** valores declarados pelo chamador SHALL NOT prevalecer sobre a decodificação

#### Scenario: Original permanece intacto após derivados

- **WHEN** `square_prepared` ou `vertical` é persistido a partir de um `square_original`
- **THEN** a linha e o objeto do original SHALL permanecer inalterados
- **AND** o derivado SHALL referenciar o artefato de origem

#### Scenario: Linha imutável

- **WHEN** uma tentativa de UPDATE ou DELETE atinge uma linha de artefato
- **THEN** o banco SHALL recusar a operação
- **AND** o artefato SHALL permanecer como foi gravado

#### Scenario: Proveniência não é arbitrária

- **WHEN** a persistência recebe proveniência
- **THEN** apenas campos permitidos SHALL ser registrados
- **AND** campos desconhecidos ou malformados SHALL NOT ser persistidos

#### Scenario: Origem de derivado é revalidada

- **WHEN** um artefato derivado é persistido com origem em artefato interno ou campanha entregue
- **THEN** o módulo SHALL revalidar a origem server-side, incluindo checksum
- **AND** SHALL aceitar campanha entregue com `origin: "legacy_campaign"` ou `origin: "new_flow_1_1"`, aplicando a revalidação específica de cada origem
- **AND** SHALL NOT criar linha fictícia para a campanha entregue

#### Scenario: Evidência durável acompanha o upload

- **WHEN** um artefato é gravado no Storage
- **THEN** o mesmo upload SHALL gravar a evidência normalizada de identidade, conteúdo e proveniência nos metadados do objeto
- **AND** a evidência SHALL sobreviver à falha do insert da linha

#### Scenario: Órfão sem evidência não é adotado

- **WHEN** o objeto existe no caminho determinístico com os mesmos bytes, mas a evidência durável está ausente ou malformada
- **THEN** o resultado SHALL ser `provenance_conflict`
- **AND** o módulo SHALL NOT adotar o objeto silenciosamente

#### Scenario: Órfão com evidência incompatível não é adotado

- **WHEN** o objeto existe com os mesmos bytes, mas a evidência de identidade/proveniência diverge da apresentada
- **THEN** o resultado SHALL ser `provenance_conflict`
- **AND** o objeto existente SHALL permanecer inalterado

### Requirement: Repetição idempotente

O módulo SHALL tratar repetição da mesma identidade com o mesmo conteúdo **e a mesma proveniência** como reutilização, sem criar linha duplicada, sem novo upload efetivo e sem sobrescrever o resultado anterior. A idempotência SHALL ser garantida também sob concorrência, pela unicidade da chave natural no banco, por releitura após conflito e pela revalidação de upload recusado. Um objeto íntegro já existente no caminho determinístico, mas sem linha, SHALL ser adotado somente quando conteúdo, proveniência e evidência durável do objeto forem compatíveis.

#### Scenario: Repetição com o mesmo conteúdo reutiliza

- **WHEN** a mesma identidade é persistida novamente com bytes idênticos e proveniência compatível
- **THEN** o resultado SHALL ser `reused`
- **AND** SHALL existir exatamente uma linha e um objeto para a identidade
- **AND** nenhum conteúdo anterior SHALL ser sobrescrito

#### Scenario: Concorrência não duplica

- **WHEN** duas persistências concorrentes usam a mesma identidade, o mesmo conteúdo e a mesma proveniência
- **THEN** o banco SHALL manter exatamente uma linha
- **AND** ambas as chamadas SHALL resolver para o mesmo artefato, sem duplicação

#### Scenario: Upload disputado converge com os mesmos bytes

- **WHEN** duas chamadas verificam “objeto ausente” e disputam o upload, e a segunda é recusada porque a primeira gravou
- **THEN** a segunda SHALL reler e validar o objeto existente
- **AND** com os mesmos bytes, proveniência e evidência compatíveis SHALL convergir para um único registro (`reused`)
- **AND** SHALL NOT sobrescrever o objeto

#### Scenario: Upload disputado com bytes diferentes é conflito

- **WHEN** o upload é recusado porque outro gravador já criou o objeto com bytes diferentes
- **THEN** o resultado SHALL ser `content_conflict`
- **AND** o objeto existente SHALL permanecer inalterado

#### Scenario: Corrida com mesmos bytes e proveniências diferentes

- **WHEN** duas chamadas disputam o mesmo path com os mesmos bytes, mas proveniências diferentes
- **THEN** a evidência do primeiro objeto SHALL vencer
- **AND** a segunda chamada SHALL reler a evidência e receber `provenance_conflict`
- **AND** SHALL NOT adotar o objeto silenciosamente

#### Scenario: Upload com resultado ambíguo não presume ausência

- **WHEN** o upload termina em timeout, erro de rede ou resultado ambíguo
- **THEN** o resultado SHALL ser `indeterminate` ou `persistence_failure`
- **AND** o módulo SHALL NOT presumir ausência nem sobrescrever o objeto

#### Scenario: Órfão íntegro é adotado

- **WHEN** o objeto existe no caminho determinístico com o mesmo conteúdo e evidência compatível, mas a linha está ausente
- **THEN** o módulo SHALL inserir a linha correspondente
- **AND** SHALL devolver `reused`, sem sobrescrever o objeto

### Requirement: Recusa explícita de conflito

O módulo SHALL recusar explicitamente conflito de conteúdo, de identidade, de metadados e de proveniência. Mesma identidade com checksum diferente SHALL ser `content_conflict`; caminho já vinculado a outra identidade SHALL ser `identity_conflict`; linha persistida divergente dos bytes SHALL ser `metadata_conflict`; mesmos bytes com origem/proveniência incompatíveis SHALL ser `provenance_conflict`. Evidência durável ausente, malformada ou incompatível em objeto órfão SHALL ser `provenance_conflict`, sem adoção. Em nenhum caso o módulo SHALL sobrescrever, corrigir silenciosamente ou apagar o resultado existente.

#### Scenario: Conteúdo diferente na mesma identidade

- **WHEN** a mesma identidade é persistida com bytes cujo checksum difere do artefato existente
- **THEN** o resultado SHALL ser `content_conflict`
- **AND** o artefato existente SHALL permanecer inalterado

#### Scenario: Mesma imagem com proveniência incompatível

- **WHEN** a mesma identidade e os mesmos bytes são reapresentados com origem, artefato de origem, campanha de origem ou proveniência diferentes
- **THEN** o resultado SHALL ser `provenance_conflict`
- **AND** SHALL NOT devolver `reused` silenciosamente
- **AND** o artefato existente SHALL permanecer inalterado

#### Scenario: Caminho vinculado a outra identidade

- **WHEN** o caminho determinístico já está associado a outra loja, campanha, operação ou papel
- **THEN** o resultado SHALL ser `identity_conflict`
- **AND** nenhuma linha SHALL ser criada ou alterada

#### Scenario: Metadados persistidos divergem dos bytes

- **WHEN** largura, altura, MIME, tamanho ou checksum persistidos não correspondem aos bytes
- **THEN** o resultado SHALL ser `metadata_conflict`
- **AND** o módulo SHALL NOT reescrever a linha para “corrigir” a divergência

### Requirement: Recuperação e validação server-side

O módulo SHALL recuperar artefatos por identidade e validar os bytes contra a linha persistida, devolvendo resultado tipado. A ausência do artefato SHALL ser determinada pela ausência da linha persistida. Quando a linha existir, a ausência do objeto SHALL ser confirmada apenas quando o Storage provar que o objeto não existe; erro, timeout, autorização, indisponibilidade ou resposta ambígua SHALL ser `indeterminate` e SHALL NOT ser tratados como ausência. A recuperação SHALL ser server-side, SHALL exigir contexto de autorização derivado pelo servidor e SHALL NOT criar URL assinada ou URL pública.

#### Scenario: Recuperação exige autorização

- **WHEN** a recuperação é chamada sem contexto `owner` ou `system` válido
- **THEN** a operação SHALL ser recusada
- **AND** nenhum byte SHALL ser baixado ou devolvido

#### Scenario: Sem linha persistida

- **WHEN** não existe linha de artefato para a identidade consultada
- **THEN** o resultado SHALL ser `absent`
- **AND** nenhum objeto órfão SHALL ser promovido a artefato sem persistência explícita

#### Scenario: Artefato íntegro é recuperado

- **WHEN** a linha existe e os bytes decodificam com dimensão, MIME, tamanho e checksum iguais aos persistidos
- **THEN** o resultado SHALL ser `integral`
- **AND** os bytes e metadados SHALL ser devolvidos ao chamador server-side

#### Scenario: Ausência provada

- **WHEN** o Storage confirma que o objeto do caminho determinístico não existe
- **THEN** o resultado SHALL ser `absent`

#### Scenario: Erro de Storage não é ausência

- **WHEN** o Storage responde com erro, timeout, autorização ou indisponibilidade
- **THEN** o resultado SHALL ser `indeterminate`
- **AND** SHALL NOT ser classificado como `absent`

#### Scenario: Divergência de metadados é detectada

- **WHEN** os bytes recuperados não correspondem à dimensão, MIME, tamanho ou checksum persistidos
- **THEN** o resultado SHALL indicar `metadata_conflict` ou `invalid`
- **AND** o artefato SHALL NOT ser considerado íntegro

#### Scenario: Nenhuma URL é criada na recuperação

- **WHEN** o módulo recupera ou valida um artefato
- **THEN** SHALL NOT chamar `createSignedUrl` ou `getPublicUrl`
- **AND** SHALL NOT devolver URL de download

### Requirement: Privacidade interna independente do caminho

Artefatos internos de composição SHALL ser gravados em bucket dedicado, privado, sem política de leitura para `anon` ou `authenticated`. O conhecimento do caminho SHALL NOT autorizar leitura. O módulo SHALL NOT liberar download, assinar URL, alterar status de campanha ou executar qualquer efeito de entrega. A fronteira de privacidade para `anon`/`authenticated` SHALL ser a política do bucket, não o nome do path.

`service_role` ignora RLS. Portanto, a ausência de políticas de `UPDATE`/`DELETE` no bucket SHALL NOT ser apresentada como garantia de imutabilidade contra uma service key. A não sobrescrita dos objetos SHALL ser garantida pelo comportamento do módulo (`upsert:false`, nenhum delete), e a imutabilidade da linha SHALL ser garantida por grants/trigger.

#### Scenario: Lojista autenticado não lê artefato interno

- **WHEN** um usuário autenticado da loja tenta ler um artefato interno pelo caminho conhecido
- **THEN** a política do bucket SHALL negar a leitura
- **AND** o artefato SHALL permanecer acessível somente ao servidor

#### Scenario: Privacidade e imutabilidade têm garantias distintas

- **WHEN** se avalia a proteção de um artefato interno
- **THEN** a leitura por `anon`/`authenticated` SHALL ser negada pela política do bucket
- **AND** a imutabilidade da linha SHALL ser garantida por grants/trigger
- **AND** a não sobrescrita do objeto SHALL ser garantida pelo comportamento do módulo (`upsert:false`, sem delete)
- **AND** a ausência de política de `UPDATE`/`DELETE` SHALL NOT ser usada como prova contra `service_role`

#### Scenario: Caminho conhecido não é autorização

- **WHEN** um cliente envia ou adivinha o caminho de um artefato interno
- **THEN** o módulo SHALL NOT usar esse caminho para autorizar leitura ou download

#### Scenario: Nenhuma entrega é criada

- **WHEN** um artefato interno é persistido ou recuperado
- **THEN** o módulo SHALL NOT marcar campanha como entregue, confirmar crédito, liberar download ou gerar URL
- **AND** a existência do arquivo SHALL NOT ser tratada como aquisição do formato

### Requirement: Reconhecimento seguro de fonte quadrada reutilizável

O módulo SHALL distinguir duas classes de fonte reutilizável.

**Fonte de campanha já entregue** (legado ou novo fluxo 1:1): SHALL validar propriedade, vínculo loja↔campanha, status de campanha `ready`, formato 1:1, caminho canônico, integridade por conteúdo e dimensão/MIME compatíveis.

**Fonte interna** (`square_original`/`square_prepared`): SHALL validar identidade, autorização, papel e integridade do artefato, sem exigir campanha `ready`, entrega quadrada ou formato global 1:1. Uma campanha vertical em processamento com quadrado interno íntegro SHALL ser fonte reutilizável.

O módulo SHALL NOT migrar, renomear, copiar ou reclassificar o legado, e SHALL NOT aceitar caminho arbitrário do cliente como fonte.

#### Scenario: Campanha legada quadrada é reutilizável

- **WHEN** a campanha pertence à loja autorizada, está pronta, resolve para 1:1 e seu `storage_path` canônico aponta para JPEG 1080×1080 íntegro
- **THEN** o resultado SHALL ser `reusable`
- **AND** o descritor SHALL conter origem legada, caminho, dimensões, MIME, bytes e checksum

#### Scenario: Arte 1:1 do novo fluxo é reutilizável

- **WHEN** a campanha está pronta, resolve para 1:1 e `campaigns.storage_path` aponta para o path canônico `product-1-1/.../art-1024.jpg` com JPEG 1024×1024 íntegro
- **THEN** o resultado SHALL ser `reusable`
- **AND** o descritor SHALL registrar a origem do novo fluxo 1:1

#### Scenario: Campanha 1:1 atual é origem de preparado

- **WHEN** o resolvedor reconhece uma campanha 1:1 atual como `reusable` com `origin: "new_flow_1_1"` e o orquestrador persiste um `square_prepared` com `delivered_campaign_source` apontando para esse descritor
- **THEN** a persistência SHALL revalidar o descritor específico do novo fluxo 1:1, incluindo path, dimensão, MIME e checksum
- **AND** o preparado SHALL ser persistido com `sourceCampaignId` e proveniência `sourceOrigin: "new_flow_1_1"`
- **AND** nenhuma linha fictícia da campanha de origem SHALL ser criada

#### Scenario: Artefato interno é reutilizável

- **WHEN** existe um artefato interno `square_original` ou `square_prepared` vinculado à loja, campanha e operação autorizadas, com bytes íntegros
- **THEN** o resultado SHALL ser `reusable`
- **AND** o descritor SHALL referenciar o artefato e sua proveniência

#### Scenario: Campanha vertical em processamento com quadrado interno íntegro

- **WHEN** a campanha está em processamento e resolve para 9:16, mas existe `square_original`/`square_prepared` interno íntegro vinculado à loja, campanha e operação autorizadas
- **THEN** o resultado SHALL ser `reusable`
- **AND** o módulo SHALL NOT exigir campanha `ready`, entrega quadrada ou formato global 1:1 para a fonte interna

#### Scenario: Propriedade ou vínculo inválido é recusado

- **WHEN** a loja não pertence ao usuário autorizado ou a campanha não pertence à loja
- **THEN** o resultado SHALL ser `not_reusable`
- **AND** nenhum byte SHALL ser retornado como fonte

#### Scenario: Campanha entregue não quadrada é recusada

- **WHEN** a fonte é uma campanha já entregue que resolve para 9:16, está em geração/erro ou não possui arte 1:1 canônica
- **THEN** o resultado SHALL ser `not_reusable`
- **AND** o módulo SHALL NOT reinterpretar a campanha como quadrada

#### Scenario: Caminho arbitrário é recusado

- **WHEN** o caminho canônico não pertence à loja/campanha ou não corresponde a um padrão reconhecido
- **THEN** o resultado SHALL ser `not_reusable`
- **AND** o módulo SHALL NOT ler o objeto

#### Scenario: Fonte de campanha entregue não é alterada

- **WHEN** uma fonte de campanha entregue (legado ou novo fluxo 1:1) é reconhecida como reutilizável
- **THEN** nenhuma linha, arquivo, path ou classificação existente SHALL ser alterada
- **AND** nenhuma cópia SHALL ser criada automaticamente

### Requirement: Persistência não é entrega nem crédito

O módulo SHALL limitar-se a persistir, localizar, recuperar e validar artefatos. Ele SHALL NOT reservar, confirmar, estornar ou comprar créditos; SHALL NOT alterar `campaigns.status` ou `campaigns.storage_path`; SHALL NOT criar UI, seletor, rota, flag, orquestrador ou download; SHALL NOT excluir objetos ou linhas automaticamente.

#### Scenario: Persistência não confirma crédito

- **WHEN** um artefato é persistido
- **THEN** nenhuma RPC ou serviço de crédito SHALL ser chamado
- **AND** nenhum estado financeiro SHALL ser alterado

#### Scenario: Persistência não projeta entrega

- **WHEN** um artefato é persistido
- **THEN** `campaigns` SHALL permanecer inalterada pelo módulo
- **AND** nenhum download SHALL ser liberado

#### Scenario: Nenhuma exclusão automática

- **WHEN** a persistência falha após o upload ou encontra um órfão
- **THEN** o módulo SHALL NOT apagar o objeto automaticamente
- **AND** SHALL devolver resultado tipado para repetição ou tratamento futuro

### Requirement: Verificação em estágios separados

A verificação SHALL separar testes offline, integração autorizada e promoção produtiva. Testes offline SHALL usar Storage e banco simulados, mas SHALL exercitar o decodificador real com imagens determinísticas, sem rede, banco ou IA, e SHALL cobrir identidade, autorização, original intacto, idempotência, corrida de upload, conflito, proveniência, evidência durável de órfão, metadados incompatíveis, origem legada, novo fluxo 1:1, base interna e privacidade. Integração real SHALL exigir autorização específica e ambiente descartável/homolog, e SHALL provar leitura negada a usuário autenticado da própria loja com caminho conhecido. Promoção produtiva SHALL ser gate separado, e conclusão local SHALL NOT ser declarada prontidão de produção.

#### Scenario: Testes offline não dependem de ambiente real

- **WHEN** os contratos do módulo são verificados
- **THEN** Storage e banco SHALL ser simulados de forma determinística
- **AND** o decodificador real SHALL ser exercitado com imagens determinísticas
- **AND** nenhuma chamada de rede, escrita real ou chamada paga SHALL ocorrer

#### Scenario: Decodificador real rejeita bytes inválidos

- **WHEN** os testes offline fornecem JPEG válido, JPEG truncado, não-JPEG ou dimensão incorreta
- **THEN** o decodificador real SHALL classificar corretamente os bytes
- **AND** os limites de bytes e pixels SHALL ser aplicados antes do decode completo

#### Scenario: Evidência durável de órfão é verificada offline

- **WHEN** os testes simulam falha de insert após upload e repetem a persistência
- **THEN** a evidência no objeto SHALL permitir a adoção somente quando identidade, conteúdo e proveniência forem compatíveis
- **AND** evidência ausente, malformada ou incompatível SHALL resultar em `provenance_conflict`, sem adoção

#### Scenario: Fluxo 1:1 atual é coberto de ponta a ponta

- **WHEN** os testes resolvem uma campanha 1:1 atual e persistem um `square_prepared` com essa origem
- **THEN** o preparado SHALL ser aceito com `sourceOrigin: "new_flow_1_1"`
- **AND** a revalidação específica do path/dimensão/MIME/checksum SHALL ocorrer

#### Scenario: Integração exige autorização

- **WHEN** a migration ou o módulo é validado contra banco/Storage reais
- **THEN** a execução SHALL depender de autorização específica
- **AND** SHALL ocorrer em ambiente descartável ou homolog autorizado, não em produção

#### Scenario: Integração prova leitura negada

- **WHEN** um usuário autenticado da própria loja tenta ler um artefato interno pelo caminho conhecido no ambiente autorizado
- **THEN** a leitura SHALL ser negada
- **AND** a prova SHALL ser comportamental, não apenas inspeção de nomes de políticas

#### Scenario: Produção é gate separado

- **WHEN** a implementação local e a integração autorizada forem concluídas
- **THEN** a promoção produtiva SHALL permanecer pendente de autorização, migration revisada e checklist próprios
- **AND** nenhuma ativação, flag ou UI SHALL ser inferida desta fatia
