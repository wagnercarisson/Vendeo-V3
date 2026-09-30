# Lab Bench Prompt Preflight — delta (F48.2.4)

## MODIFIED Requirements

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

### Requirement: Invalidação por mudança de entradas ou pós-aprovação

Qualquer alteração em dados usados pela composição SHALL invalidar o prompt compilado/aprovado e exigir nova composição e aprovação. Isso inclui loja/branding, produto/campanha, imagens/referências, intenção/formato/configuração multidimensional, **prompt-base**, prompt final aprovado e **modelo/qualidade** quando afetarem a execução. Alterar o prompt final depois da aprovação também SHALL invalidar a aprovação.

#### Scenario: Mudança de entrada invalida

- **WHEN** um dado usado na composição muda
- **THEN** o prompt compilado/aprovado é invalidado
- **AND** uma nova composição e aprovação é exigida

#### Scenario: Edição pós-aprovação invalida

- **WHEN** o prompt final é alterado após a aprovação
- **THEN** a aprovação é invalidada
- **AND** o caminho de geração é bloqueado até nova aprovação

#### Scenario: Mudança de prompt-base ou de modelo/qualidade invalida

- **WHEN** o prompt-base ou o modelo/qualidade muda após a aprovação
- **THEN** a aprovação é invalidada
- **AND** uma nova composição e aprovação é exigida

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

## ADDED Requirements

### Requirement: Revalidação server-side da composição aprovada

Antes de qualquer chamada paga, o servidor SHALL **recompor** o prompt a partir das entradas atuais e SHALL exigir que o resultado seja idêntico ao prompt compilado registrado na aprovação. Divergência SHALL invalidar a aprovação (`approval_invalidated`) antes da chamada paga.

#### Scenario: Composição divergente invalida a aprovação

- **WHEN** o servidor recomputa a composição e o resultado diverge do prompt compilado aprovado
- **THEN** a execução é recusada com `approval_invalidated`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Composição consistente prossegue

- **WHEN** o servidor recomputa a composição e o resultado é idêntico ao prompt compilado aprovado
- **THEN** a execução prossegue com o prompt final aprovado
