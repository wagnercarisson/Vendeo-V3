# Lab Bench Prompt Preflight

## ADDED Requirements

### Requirement: Compositor determinístico mínimo e puro

A bancada SHALL compor o prompt final a partir da identidade local + dados estruturados de produto/campanha + prompt-base manual, por um compositor **puro e sem IA**. O compositor SHALL NOT reescrever o prompt-base, interpretar criatividade, avaliar qualidade, fazer deduplicação semântica, chamar provider, promover qualquer artefato para produção nem substituir o futuro template criativo de Oferta 1:1.

#### Scenario: Composição é pura e sem IA

- **WHEN** o prompt é composto
- **THEN** nenhuma chamada de IA é realizada
- **AND** o compositor apenas serializa dados estruturados e o prompt-base

#### Scenario: Prompt-base é preservado

- **WHEN** o compositor compõe o prompt
- **THEN** o prompt-base é incluído sem reescrita
- **AND** repetições do prompt-base são preservadas

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

A bancada SHALL oferecer uma etapa explícita anterior à geração: (1) "Compor prompt"; (2) exibir o prompt compilado completo; (3) permitir edição manual do prompt compilado; (4) exigir aprovação explícita; (5) somente então habilitar o caminho de estimativa/confirmação da geração. A confirmação financeira da chamada paga SHALL permanecer separada da aprovação do prompt.

#### Scenario: Prompt compilado é exibido antes da aprovação

- **WHEN** o operador aciona "Compor prompt"
- **THEN** o prompt compilado completo é exibido
- **AND** pode ser editado manualmente

#### Scenario: Geração exige aprovação do prompt

- **WHEN** o operador tenta seguir para a estimativa/confirmação
- **THEN** a aprovação explícita do prompt é exigida antes
- **AND** a confirmação financeira permanece um passo separado

### Requirement: Invalidação por mudança de entradas ou pós-aprovação

Qualquer alteração em dados usados pela composição SHALL invalidar o prompt compilado/aprovado e exigir nova composição e aprovação. Alterar o prompt final depois da aprovação também SHALL invalidar a aprovação.

#### Scenario: Mudança de entrada invalida

- **WHEN** um dado usado na composição muda
- **THEN** o prompt compilado/aprovado é invalidado
- **AND** uma nova composição e aprovação é exigida

#### Scenario: Edição pós-aprovação invalida

- **WHEN** o prompt final é alterado após a aprovação
- **THEN** a aprovação é invalidada
- **AND** o caminho de geração é bloqueado até nova aprovação

### Requirement: Execução envia exatamente o texto aprovado

A execução SHALL enviar exatamente o texto final visível e aprovado; nenhuma concatenação, instrução ou transformação SHALL ocorrer depois da aprovação. O `prompt_sent` SHALL ser idêntico ao prompt final aprovado.

#### Scenario: prompt_sent é idêntico ao aprovado

- **WHEN** a geração é executada
- **THEN** o texto enviado ao provider é idêntico ao prompt final aprovado
- **AND** nenhuma transformação ocorre após a aprovação

### Requirement: Persistência mínima da evidência do preflight

A bancada SHALL registrar como evidência: prompt-base manual; blocos estruturados utilizados; prompt originalmente compilado; prompt final editado e aprovado; versão estática do compositor; e `prompt_sent` idêntico ao prompt final aprovado. A bancada SHALL NOT criar nova tabela de versões, histórico de rascunhos, novo estado do run, sistema de candidatos, workflow de revisão automática, nem hashes persistidos ou infraestrutura de assinatura.

#### Scenario: Evidência do preflight é registrada

- **WHEN** uma geração é persistida
- **THEN** prompt-base, blocos, prompt compilado, prompt final aprovado e versão do compositor são registrados
- **AND** `prompt_sent` é idêntico ao prompt final aprovado

#### Scenario: Sem sobrecarga de persistência

- **WHEN** o preflight é implementado
- **THEN** nenhuma tabela de versões, histórico de rascunhos ou novo estado do run é criado
- **AND** rascunhos descartados existem apenas no estado da UI
