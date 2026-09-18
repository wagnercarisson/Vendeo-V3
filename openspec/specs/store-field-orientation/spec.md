# Store Field Orientation

## Purpose

Conteúdo de orientação dos campos de identidade da loja em `/loja`: dados fiscais × nome público, tom de voz (crítico) com descrição por opção, posicionamento (label/hint/exemplo) e a distinção posicionamento × descrição curta × slogan — mapeado aos consumidores reais e à regra real de desbloqueio da Direção Visual.

> Added by `fase-49-ativacao-orientacao-contextual-campos` (D3/D4/D5/D6/D7/D14).

## Requirements

### Requirement: Dados fiscais separados da identidade pública

O sistema SHALL separar conceitualmente e visualmente, na aba Dados, os **dados fiscais/cadastrais** (CNPJ, Razão Social, Nome Fantasia) da **identidade pública** (`Nome da Loja`).

- Os dados fiscais SHALL ser apresentados como uma subseção de dados cadastrais/oficiais (Receita Federal).
- O campo `Nome da Loja` SHALL exibir microcopy deixando claro que é o **nome público** usado no Vendeo para identificar e assinar as campanhas.
- Os atalhos existentes "Usar nome fantasia como nome da loja" e "Usar razão social como nome da loja" SHALL ser preservados (sem remoção ou renomeação).
- A separação SHALL NOT alterar o comportamento atual: CNPJ continua opcional (draft mode), lookup/read-only/fallback e readiness preservados.

#### Scenario: Nome da Loja com microcopy de nome público

- **WHEN** a aba Dados é renderizada
- **THEN** o campo `Nome da Loja` exibe microcopy informando que é o nome público usado no Vendeo para identificar e assinar as campanhas

#### Scenario: Dados fiscais agrupados como dados cadastrais

- **WHEN** a aba Dados é renderizada em modo criação
- **THEN** CNPJ, Razão Social e Nome Fantasia aparecem agrupados como dados cadastrais/oficiais
- **AND** a microcopy deixa claro que são dados oficiais usados para verificação/cadastro

#### Scenario: Atalhos de nome preservados

- **WHEN** o lookup de CNPJ retorna dados resolvidos
- **THEN** os atalhos "Usar nome fantasia como nome da loja" e/ou "Usar razão social como nome da loja" continuam disponíveis e copiam o valor para `Nome da Loja`

#### Scenario: Comportamento fiscal inalterado

- **WHEN** a loja é salva sem CNPJ
- **THEN** o modo draft e o aviso de fiscal pendente permanecem inalterados
- **AND** nenhum bloqueio novo de navegação é introduzido

### Requirement: Tom de voz como campo crítico com descrição contextual

O sistema SHALL tratar `Tom de Voz` como campo crítico e necessário para avançar à Direção Visual, refletindo a regra já existente (`computeTabUnlock` → `needs_tone_of_voice`), e SHALL explicar positivamente o que ele orienta: títulos, legendas e chamadas; personalidade da marca; clima da direção visual; energia, linguagem e tratamento criativo — **sem substituir** segmento/subsegmento como base da identidade.

Para cada uma das 8 opções existentes (profissional, moderno, elegante, divertido, acolhedor, jovem, tradicional, luxuoso), o sistema SHALL exibir uma **descrição contextual curta** quando a opção estiver selecionada.

#### Scenario: Hint do tom de voz explica o uso

- **WHEN** o campo `Tom de Voz` é renderizado
- **THEN** o hint inline explica que a escolha orienta títulos, legendas e o clima visual das campanhas
- **AND** deixa claro que complementa (não substitui) segmento e subsegmento como base da identidade

#### Scenario: Descrição contextual por opção selecionada

- **WHEN** o usuário seleciona uma das 8 opções de tom de voz
- **THEN** a descrição curta correspondente à opção selecionada é exibida
- **AND** a descrição é positiva e descreve a personalidade/energia da escolha

#### Scenario: Regra real de desbloqueio refletida (não alterada)

- **WHEN** o tom de voz está vazio e o usuário tenta avançar para a Direção Visual
- **THEN** a Direção Visual permanece bloqueada com o motivo real (`needs_tone_of_voice`)
- **AND** a orientação de campo é coerente com esse bloqueio (não promete que o campo é opcional)

### Requirement: Posicionamento compreensível com hint e exemplo expansível

O sistema SHALL tornar o campo `Posicionamento` compreensível, mantendo a chave `positioning`/`store.positioning`:

- O label principal SHALL ser "Como você quer que sua loja seja percebida?", com "Posicionamento da marca" como termo secundário.
- Um hint SHALL informar que o campo deve trazer **público, proposta e diferencial**.
- A microcopy SHALL reconhecer que posicionamento e descrição curta ajudam o Vendeo a **compreender a identidade da loja**, com efeito **direto na copy** e **indireto no perfil/direção visual** — **sem** prometer uma transformação visual específica.
- O placeholder atual (`Ex: A melhor loja de...`) SHALL ser substituído por um começo de frase útil.
- Um **exemplo positivo em ajuda expansível** SHALL apresentar a estrutura "Somos uma loja de [categoria] para [público], reconhecida por [diferencial].".
- O sistema SHALL NOT criar validador semântico que bloqueie respostas curtas ou de adjetivo único.

#### Scenario: Label e termo secundário

- **WHEN** o campo de posicionamento é renderizado
- **THEN** o label principal exibe "Como você quer que sua loja seja percebida?"
- **AND** "Posicionamento da marca" aparece como termo secundário

#### Scenario: Exemplo em ajuda expansível

- **WHEN** o usuário aciona a ajuda do campo de posicionamento
- **THEN** o exemplo positivo com a estrutura `[categoria] / [público] / [diferencial]` é revelado
- **AND** a ajuda inicia colapsada

#### Scenario: Sem bloqueio por adjetivo único

- **WHEN** o usuário informa um posicionamento curto (ex.: um único adjetivo)
- **THEN** nenhum erro de validação é exibido e o avanço não é bloqueado por esse motivo
- **AND** nenhuma regex de intenção ou validador semântico é aplicado

### Requirement: Distinção entre posicionamento, descrição curta e slogan

O sistema SHALL tornar evidente a diferença entre os três campos da aba Posicionamento, por microcopy curta no ponto de decisão:

- **Posicionamento:** como a loja deseja ser percebida — **recomendado** (ajuda a copy e a compreensão da identidade; efeito indireto no perfil/direção visual).
- **Descrição curta:** o que a loja vende, para quem e algum diferencial factual — **recomendada** (ajuda a copy e a compreensão da identidade; efeito indireto no perfil/direção visual).
- **Slogan:** frase pública já adotada pela loja — **opcional**, com microcopy "se sua loja já utiliza um"; **NÃO** deve ser marcado como recomendado, para não induzir o lojista a inventar um slogan só para completar o formulário.

Os três campos SHALL permanecer não bloqueantes, sem campos novos e sem validação nova.

#### Scenario: Microcopy distingue os três campos

- **WHEN** a aba Posicionamento é renderizada
- **THEN** os campos de posicionamento, descrição curta e slogan exibem microcopy que explicita a diferença de propósito
- **AND** nenhum dos três exige preenchimento para avançar (fora o tom de voz, que é o crítico)

#### Scenario: Slogan é opcional, não recomendado

- **WHEN** o campo Slogan é renderizado
- **THEN** ele aparece como **opcional**, com microcopy "se sua loja já utiliza um"
- **AND** **não** exibe o indicador "Recomendado"
