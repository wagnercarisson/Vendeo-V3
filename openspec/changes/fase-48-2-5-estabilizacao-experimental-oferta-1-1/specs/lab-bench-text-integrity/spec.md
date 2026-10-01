## ADDED Requirements

### Requirement: Preflight local determinístico de integridade textual

Antes de compor o prompt, a bancada SHALL executar localmente um detector determinístico, puro e testável de possíveis problemas nos textos livres editáveis pelo operador: `product.name`, `product.description`, `product.mandatoryArtworkText` e `promptBase`. `promptBase` SHALL ser coberto por ser texto livre enviado a `/compose` e reutilizado em `/runs`. O detector SHALL avaliar no mínimo possíveis erros ortográficos, pontuação duplicada, espaços anormais, palavras repetidas e anomalias simples de digitação. SHALL excluir preço e validade (validação estrutural própria), enums/valores controlados como intenção, selo e formato, e branding importado somente para leitura. Alertas SHALL identificar campo, trecho suspeito e motivo; SHALL ser sugestões, nunca afirmações absolutas. O detector SHALL NOT usar IA, corrigir automaticamente, alterar silenciosamente texto ou julgar semanticamente o `promptBase`. A autorização `keep_exactly` conserva cada byte dos valores originais, inclusive `promptBase` e grafia de nome aprovada pelo usuário.

#### Scenario: Entrada sem alertas permite composição
- **WHEN** o usuário solicita “Compor prompt” e o detector não encontra alertas
- **THEN** a composição prossegue sem revisão por IA

#### Scenario: Alertas interrompem composição e localizam suspeitas
- **WHEN** o detector encontra um ou mais possíveis problemas
- **THEN** a composição fica bloqueada
- **AND** cada alerta apresenta campo, trecho e motivo em linguagem de sugestão

#### Scenario: Campos estruturados não recebem verificação ortográfica
- **WHEN** preço, validade, selo, intenção ou formato são informados
- **THEN** eles permanecem sob sua validação própria/controlada
- **AND** não são submetidos ao detector textual

#### Scenario: Detector é determinístico e sem IA
- **WHEN** a mesma entrada é examinada novamente
- **THEN** os mesmos alertas ordenados são retornados
- **AND** nenhuma chamada de IA, rede ou correção ocorre

### Requirement: Decisão explícita e temporária sobre alertas

Diante de alertas, o usuário SHALL poder editar/corrigir as entradas ou selecionar “Manter exatamente como informado”. A autorização de manutenção SHALL valer apenas para a revisão atual dos textos examinados; qualquer alteração posterior em `product.name`, `product.description`, `product.mandatoryArtworkText` ou `promptBase` SHALL invalidá-la e exigir nova validação. Marcas, nomes próprios, abreviações e termos técnicos podem ser mantidos. `keep_exactly` preserva `promptBase` byte a byte, sem correção automática ou julgamento semântico. A composição SHALL prosseguir somente depois da decisão explícita.

#### Scenario: Usuário corrige texto suspeito
- **WHEN** o usuário edita os campos após ver alertas
- **THEN** o sistema revalida os valores atuais
- **AND** compõe somente após ausência de alertas pendentes ou decisão válida

#### Scenario: Usuário mantém texto exatamente
- **WHEN** o usuário escolhe “Manter exatamente como informado” para a revisão atual
- **THEN** o texto original é preservado sem transformação
- **AND** a composição pode prosseguir

#### Scenario: Alteração posterior invalida autorização
- **WHEN** qualquer campo textual abrangido muda após a autorização
- **THEN** a autorização anterior é descartada
- **AND** uma nova validação e decisão são exigidas

#### Scenario: Nome próprio ou termo técnico é mantido
- **WHEN** uma palavra sinalizada for marca, nome próprio, abreviação ou termo técnico
- **THEN** o usuário pode manter exatamente esse texto
- **AND** o detector não o substitui nem afirma erro absoluto

### Requirement: Evidência de revisão textual entre composição e execução

O endpoint `POST /compose` SHALL executar o detector server-side e aceitar os valores livres atuais (`product.name`, `product.description`, `product.mandatoryArtworkText` e `promptBase`) e a versão ativa da política textual resolvida no servidor. Quando houver alertas sem decisão declarada, SHALL retornar `422 text_integrity_review_required`, alertas tipados por campo/trecho/motivo/regra e uma revisão determinística associada aos valores enviados, sem prompt compilado. Para reenvio com decisão `keep_exactly`, SHALL recalcular alertas/revisão e aceitar somente correspondência byte a byte de conteúdo e versão; alteração ou evidência obsoleta SHALL retornar `409 text_integrity_review_stale` com alertas/estado atualizados. Sem alertas, compõe e devolve evidência `decision: no_alerts`. O endpoint `POST /runs` SHALL receber essa evidência junto do snapshot e do `promptBase` do preflight e, antes de persistir execução ou invocar provider, recalcular detector e revisão sobre todos os campos livres cobertos, incluindo `promptBase`; SHALL rejeitar versão, conteúdo, decisão ou revisão divergentes com `409 text_integrity_review_stale`. A evidência é efêmera: a UI registra a escolha explícita de manter, e o servidor verifica consistência dos valores e decisão declarada, sem alegar prova independente do clique. Não há tabela, sessão, assinatura ou mecanismo adicional.

#### Scenario: Compose bloqueia alerta sem decisão
- **WHEN** `/compose` encontra alertas sem decisão `keep_exactly` válida
- **THEN** retorna `422 text_integrity_review_required` com alertas e revisão atual
- **AND** não retorna prompt compilado

#### Scenario: Compose emite evidência para texto sem alertas
- **WHEN** `/compose` encontra zero alertas
- **THEN** retorna evidência com versão ativa, revisão determinística e `decision: no_alerts`
- **AND** retorna a composição do prompt

#### Scenario: Compose aceita manter somente o mesmo conteúdo
- **WHEN** `/compose` recebe `keep_exactly` com a revisão e versão atuais
- **THEN** recalcula e confirma a correspondência exata dos valores
- **AND** retorna evidência vinculada à revisão, versão e decisão

#### Scenario: Runs recusa evidência obsoleta
- **WHEN** `/runs` recebe decisão ausente, revisão divergente, versão obsoleta ou snapshot textual diferente
- **THEN** retorna `409 text_integrity_review_stale` antes de persistir execução ou chamar provider
- **AND** fornece estado/alertas atuais quando aplicável

#### Scenario: Alteração do prompt-base invalida a evidência
- **WHEN** `/runs` recebe `promptBase` diferente daquele incluído na revisão textual aprovada em `/compose`
- **THEN** retorna `409 text_integrity_review_stale` antes de persistir execução ou chamar provider
- **AND** não normaliza nem corrige o `promptBase`
