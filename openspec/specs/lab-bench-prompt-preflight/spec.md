# Lab Bench Prompt Preflight

> Synced from `fase-48-2-3-fidelidade-experimental-bancada` (ADDED), `fase-48-2-4-experimento-deterministico-oferta-1-1` (MODIFIED/ADDED), and `fase-48-2-5-estabilizacao-experimental-oferta-1-1` (MODIFIED).

## Purpose

Define o compositor determinístico mínimo (puro, sem IA), a estrutura de blocos canônicos do prompt compilado, a etapa de preview/edição/aprovação, a invalidação por mudança de entradas e a persistência mínima da evidência do preflight.

## Requirements

### Requirement: Compositor determinístico mínimo e puro

A bancada SHALL compor o prompt final a partir da identidade local + dados estruturados de produto/campanha + prompt-base manual, por um compositor **puro e sem IA**, governado por **políticas independentes e versionadas** resolvidas explicitamente a partir da configuração multidimensional. O compositor SHALL NOT reescrever o prompt-base, interpretar criatividade, avaliar qualidade, fazer deduplicação semântica, chamar provider nem promover qualquer artefato para produção.

#### Scenario: Composição é pura e sem IA

- **WHEN** o prompt é composto
- **THEN** nenhuma chamada de IA é realizada
- **AND** o compositor apenas serializa dados estruturados e o prompt-base

#### Scenario: Prompt-base é preservado

- **WHEN** o compositor compõe o prompt
- **THEN** o prompt-base é incluído sem reescrita
- **AND** repetições do prompt-base são preservadas

#### Scenario: Políticas governam a composição

- **WHEN** o prompt é composto
- **THEN** as políticas habilitadas da configuração multidimensional são resolvidas explicitamente
- **AND** as versões das políticas integram a evidência

### Requirement: Estrutura de blocos canônicos

O prompt compilado SHALL usar os blocos `[IDENTIDADE E DIREÇÃO VISUAL]`, `[DIREÇÃO TIPOGRÁFICA]`, `[PRODUTO E IMAGENS DE REFERÊNCIA]`, `[CONDIÇÕES COMERCIAIS]`, `[INTENÇÃO E FORMATO]`, `[INSTRUÇÕES DO PROMPT-BASE]` e `[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]`, com **um único bloco canônico por dado estruturado**, omitindo blocos vazios e sem repetir deliberadamente o mesmo campo em vários blocos.

#### Scenario: Cada dado tem um bloco canônico

- **WHEN** um dado estruturado é composto
- **THEN** ele aparece em um único bloco canônico
- **AND** o compositor não o repete deliberadamente em outros blocos

#### Scenario: Blocos vazios são omitidos

- **WHEN** um bloco não possui dados
- **THEN** ele é omitido do prompt compilado

#### Scenario: Tipografia integra o bloco próprio

- **WHEN** a loja possui `typography_direction`
- **THEN** a tipografia integra o bloco `[DIREÇÃO TIPOGRÁFICA]`
- **AND** esse bloco integra o prompt compilado

#### Scenario: preserveImageContext reflete no bloco adequado

- **WHEN** `preserveImageContext` é aplicável (Destaque/Exclusivo)
- **THEN** ele é refletido no bloco `[PRODUTO E IMAGENS DE REFERÊNCIA]`
- **AND** não é duplicado em outro bloco

### Requirement: Ausência de contexto experimental gerado pelo compositor

O compositor e os blocos por ele gerados SHALL NOT introduzir contexto de laboratório, experimento, baseline, comparação de variantes ou avaliação, nem incluir bloco "Objetivo experimental". A proibição SHALL ser aplicada **à origem do conteúdo gerado pelo compositor** e SHALL NOT ser uma blacklist lexical aplicada ao prompt completo. O prompt-base manual SHALL ser preservado integralmente: o compositor SHALL NOT filtrar nem reescrever palavras legítimas como "teste", "comparação" ou "avaliação" quando fornecidas pelo operador. A aprovação humana permanece responsável pelo texto final.

#### Scenario: Blocos gerados não introduzem contexto experimental

- **WHEN** o compositor gera os blocos estruturados
- **THEN** nenhum bloco gerado introduz contexto de laboratório, experimento, baseline, comparação de variantes ou avaliação
- **AND** nenhum bloco "Objetivo experimental" é gerado

#### Scenario: Prompt-base é preservado sem filtragem lexical

- **WHEN** o operador fornece um prompt-base contendo palavras como "teste", "comparação" ou "avaliação"
- **THEN** o prompt-base é preservado integralmente
- **AND** o compositor não filtra nem reescreve essas palavras

#### Scenario: Verificação é por origem do conteúdo

- **WHEN** a ausência de contexto experimental é verificada
- **THEN** a verificação incide sobre o conteúdo gerado pelo compositor
- **AND** não é aplicada como blacklist cega sobre o prompt completo

### Requirement: Preflight com preview, edição e aprovação

A bancada SHALL oferecer etapa explícita anterior à geração: (1) usuário preenche dados; (2) solicita “Compor prompt”; (3) detector determinístico local verifica possíveis problemas nos textos livres abrangidos; (4) sem alertas, a composição continua; (5) com alertas, a composição para e a UI apresenta um rótulo humano para o campo e uma mensagem curta de possível problema, sem exibir o trecho detectado, o texto completo ou o `ruleId`; (6) para cada alerta, a UI oferece botão nativo “Verificar”, que rola ao campo correspondente e lhe dá foco visível, operável por teclado; (7) o usuário edita/corrige ou escolhe “Manter exatamente como informado”; (8) após decisão válida, o prompt compilado é exibido, pode ser editado e exige aprovação explícita; (9) somente então habilita estimativa e confirmação financeira. Rótulos humanos SHALL corresponder a `product.name` → “Nome do produto”, `product.description` → “Descrição”, `product.mandatoryArtworkText` → “Informações obrigatórias” e `promptBase` → “Prompt-base”. A confirmação financeira permanece separada da aprovação do prompt. A verificação textual não usa IA, não corrige automaticamente nem altera conteúdo silenciosamente; alertas são sugestões, não afirmações absolutas. `keep_exactly` permanece escolha explícita para a revisão atual.

#### Scenario: Composição ocorre sem alertas

- **WHEN** o usuário solicita composição e o preflight textual não aponta alertas
- **THEN** o sistema continua a composição determinística
- **AND** apresenta o prompt para revisão humana

#### Scenario: Prompt compilado é editável e exige aprovação

- **WHEN** a revisão textual é válida e a composição foi concluída
- **THEN** o prompt compilado completo é exibido e pode ser editado
- **AND** a aprovação explícita do prompt é exigida antes da estimativa/execução
- **AND** a confirmação financeira permanece um passo separado

#### Scenario: Alerta interrompe a composição

- **WHEN** o preflight encontra possível problema textual
- **THEN** não compõe ainda
- **AND** apresenta o rótulo humano do campo e uma mensagem curta de possível problema, sem mostrar trecho ou identificador técnico da regra
- **AND** oferece “Verificar”, que move o foco visível ao campo correspondente e funciona por teclado
- **AND** permite corrigir ou manter exatamente como informado

#### Scenario: Campo sinalizado é localizado pelo operador

- **WHEN** o operador aciona “Verificar” em um alerta
- **THEN** a página rola até o campo coberto correspondente e coloca nele o foco visível
- **AND** a ação pode ser acionada por teclado
- **AND** nenhuma alteração ou normalização do valor ocorre

#### Scenario: Decisão autoriza apenas revisão atual

- **WHEN** o usuário decide manter o texto da revisão atual
- **THEN** o conteúdo é enviado sem alteração à composição
- **AND** qualquer alteração posterior dos campos invalida a decisão e exige nova validação

#### Scenario: Nenhuma revisão textual por IA

- **WHEN** os textos são validados ou liberados pelo usuário
- **THEN** nenhuma chamada de IA ou correção automática ocorre
- **AND** preço/validade e valores controlados permanecem fora do detector

### Requirement: Invalidação por mudança de entradas ou pós-aprovação

Qualquer alteração em dados que efetivamente **componham o texto ou as referências** SHALL invalidar o prompt compilado/aprovado e exigir nova composição e aprovação. Isso inclui loja/branding, produto/campanha, imagens/referências, condições comerciais, intenção/formato/tipo de conteúdo/estrutura/tema, textos obrigatórios e **prompt-base**. Alterar o prompt final depois da aprovação também SHALL invalidar a aprovação.

A **configuração de execução** (`presetId`, `modelo`, `qualidade`) SHALL NOT invalidar o prompt compilado/aprovado nem exigir nova composição: esses campos não participam da composição textual. Alterá-los SHALL invalidar **somente** a estimativa e a confirmação financeira.

#### Scenario: Mudança de entrada que compõe o texto invalida

- **WHEN** um dado usado na composição do texto/referências muda
- **THEN** o prompt compilado/aprovado é invalidado
- **AND** uma nova composição e aprovação é exigida

#### Scenario: Edição pós-aprovação invalida

- **WHEN** o prompt final é alterado após a aprovação
- **THEN** a aprovação é invalidada
- **AND** o caminho de geração é bloqueado até nova aprovação

#### Scenario: Mudança de prompt-base invalida

- **WHEN** o prompt-base muda após a aprovação
- **THEN** a aprovação é invalidada
- **AND** uma nova composição e aprovação é exigida

#### Scenario: Mudança de preset/modelo/qualidade não invalida o prompt

- **WHEN** o `presetId`, o `modelo` ou a `qualidade` muda após a aprovação
- **THEN** o prompt compilado/aprovado permanece válido
- **AND** somente a estimativa e a confirmação financeira são invalidadas
- **AND** o mesmo prompt aprovado é reutilizado byte a byte

### Requirement: Execução envia exatamente o texto aprovado

A execução SHALL enviar exatamente o texto final visível e aprovado; nenhuma concatenação, instrução ou transformação SHALL ocorrer depois da aprovação. O `prompt_sent` SHALL ser **byte a byte** idêntico ao prompt final aprovado.

#### Scenario: prompt_sent é idêntico ao aprovado

- **WHEN** a geração é executada
- **THEN** o texto enviado ao provider é byte a byte idêntico ao prompt final aprovado
- **AND** nenhuma transformação ocorre após a aprovação

#### Scenario: Divergência byte a byte é recusada

- **WHEN** o prompt a ser enviado difere do prompt aprovado
- **THEN** a execução é recusada antes da chamada paga
- **AND** nenhum texto é enviado ao provider

### Requirement: Persistência mínima da evidência do preflight

A bancada SHALL registrar como evidência: prompt-base manual; **versão do prompt-base padrão e o conteúdo efetivamente usado**; blocos estruturados utilizados; prompt originalmente compilado; prompt final editado e aprovado; **versões do compositor e das políticas**; **referência canônica da identidade** (sem URL assinada); e `prompt_sent` idêntico ao prompt final aprovado. A bancada SHALL NOT criar nova tabela de versões, histórico de rascunhos, novo estado do run, sistema de candidatos, workflow de revisão automática, nem hashes persistidos ou infraestrutura de assinatura.

#### Scenario: Evidência do preflight é registrada

- **WHEN** uma geração é persistida
- **THEN** prompt-base, versão do prompt-base padrão, blocos, prompt compilado, prompt final aprovado, versões do compositor e das políticas e a referência canônica da identidade são registrados
- **AND** `prompt_sent` é idêntico ao prompt final aprovado

#### Scenario: Sem sobrecarga de persistência

- **WHEN** o preflight é implementado
- **THEN** nenhuma tabela de versões, histórico de rascunhos ou novo estado do run é criado
- **AND** rascunhos descartados existem apenas no estado da UI

### Requirement: Revalidação server-side da composição aprovada

Antes de qualquer chamada paga, o servidor SHALL **recompor** o prompt a partir das entradas atuais e SHALL exigir que o resultado seja idêntico ao prompt compilado registrado na aprovação. O servidor SHALL também comparar a **evidência textual** aprovada (`policyVersions`, `promptBaseVersion`, `composerVersion`, `identityReference`) campo a campo com os valores resolvidos no servidor, sem hash persistido. Divergência de composição ou de evidência textual SHALL invalidar a aprovação (`approval_invalidated`) antes da chamada paga. A **configuração de execução** (`presetId`/`modelo`/`qualidade`) SHALL NOT integrar a evidência textual nem a comparação de aprovação: o servidor SHALL validá-la como configuração de execução e persistí-la no run.

#### Scenario: Composição divergente invalida a aprovação

- **WHEN** o servidor recomputa a composição e o resultado diverge do prompt compilado aprovado
- **THEN** a execução é recusada com `approval_invalidated`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Composição consistente prossegue

- **WHEN** o servidor recomputa a composição e o resultado é idêntico ao prompt compilado aprovado
- **THEN** a execução prossegue com o prompt final aprovado

#### Scenario: Mesmo prompt aprovado com presets distintos prossegue

- **WHEN** o mesmo prompt aprovado é submetido com um `presetId`/modelo diferente do usado na aprovação
- **THEN** a revalidação de composição e de evidência textual prossegue
- **AND** a configuração de execução é validada e persistida no run
- **AND** nenhuma nova composição/aprovação é exigida
