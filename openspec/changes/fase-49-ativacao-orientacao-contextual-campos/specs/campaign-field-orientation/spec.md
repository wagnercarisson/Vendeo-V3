# Campaign Field Orientation

> Capability nova (ADDED) pela `fase-49-ativacao-orientacao-contextual-campos`. Define o **conteúdo de orientação** dos campos da campanha em `/campanhas/nova`: descrição do produto (apenas copy/publicação), preços/intenção com feedback dinâmico preservando as 3 regras atuais, informações obrigatórias na arte (multi-linha, visível) e as fronteiras canônicas entre áreas — sem alterar body, prompts ou pipeline.

## ADDED Requirements

### Requirement: Descrição do produto — rótulo, microcopy e placeholder reais

O sistema SHALL renomear conceitualmente o campo genérico "Descrição" para **"Descrição do produto"**, mantendo o contrato interno existente (`fields.description` → body `description` → `brief.product.description` → `CopyDirectorInput.description`).

- Microcopy SHALL orientar a informar características, benefícios ou formas de uso que ajudam a apresentar o produto na comunicação da campanha.
- O placeholder promocional atual SHALL ser substituído por um exemplo real de produto (ex.: "Tênis leve para corrida e uso diário, com solado antiderrapante.").
- O campo SHALL permanecer opcional, com o mesmo limite de caracteres (`maxLength 120`) e o mesmo contador.

#### Scenario: Label e microcopy de descrição do produto

- **WHEN** a seção Produto do formulário de campanha é renderizada
- **THEN** o campo exibe o label "Descrição do produto"
- **AND** exibe microcopy sobre características, benefícios ou formas de uso
- **AND** o placeholder é um exemplo real de produto (não promocional)

#### Scenario: Contrato interno da descrição preservado

- **WHEN** o usuário preenche a descrição do produto e submete
- **THEN** o body continua enviando `description` com o valor informado
- **AND** o mapeamento para `brief.product.description` e `CopyDirectorInput.description` permanece inalterado

### Requirement: Descrição do produto alimenta apenas copy/publicação (fence do Diretor de Arte)

Nesta fase, a descrição do produto SHALL continuar alimentando **apenas** o comportamento produtivo atual (geração de copy/publicação). O sistema SHALL NOT:

- enviar `product.description` ao Diretor de Arte (briefing do diretor);
- alterar prompts, briefing do Diretor, pipeline ou comportamento visual;
- exibir o aviso negativo "Este campo não define, neste momento, a composição visual da arte".

#### Scenario: Descrição chega ao copy e não ao diretor

- **WHEN** uma campanha com `product.description` é processada
- **THEN** o `CopyDirectorInput` contém a descrição
- **AND** o briefing do Diretor de Arte não contém a descrição
- **AND** nenhum prompt do diretor foi alterado por esta fase

#### Scenario: Nenhum aviso negativo sobre composição visual

- **WHEN** o campo "Descrição do produto" é renderizado
- **THEN** não há aviso afirmando que o campo não define a composição visual da arte

### Requirement: Preços com labels de significado, ajuda expansível e feedback dinâmico

O sistema SHALL tornar explícito o significado dos campos de preço e explicar as combinações sem ocupar altura permanente:

- Labels: **"Preço de venda (final)"** e **"Preço anterior (original)"** (chaves `discountedPriceCents`/`originalPriceCents` inalteradas).
- Hint curto por campo.
- Ajuda expansível **"Como os preços mudam a campanha?"** preservando o conteúdo das 3 regras atuais:
  - preço anterior + preço de venda → **Oferta**;
  - somente preço de venda → **Oferta ou Destaque**;
  - sem preço → **Destaque ou Exclusividade**.
- **Feedback dinâmico** por função pura, conforme os valores preenchidos:
  - dois preços → "A campanha será apresentada como oferta: de R$ X por R$ Y.";
  - só preço de venda → "Com apenas o preço de venda, você poderá escolher entre Oferta e Destaque.";
  - **só preço anterior** (preço anterior preenchido e preço de venda ainda vazio) → mensagem **neutra**, ex.: "Informe o preço de venda para completar a oferta." — **não** exibir "Sem preço...";
  - sem nenhum preço → "Sem preço, a campanha será de Destaque ou Exclusividade.".

A inferência de intenção (`inferIntent`), o seletor de intenção, as opções disponíveis, os schemas e os contratos SHALL permanecer inalterados — o feedback apenas espelha o comportamento real. O estado intermediário "só preço anterior" SHALL NOT criar validação nova nem bloquear o avanço: `inferIntent` continua caindo no caminho sem preço (comportamento atual preservado) e a ajuda expansível segue listando apenas as 3 regras reais de intenção.

#### Scenario: Feedback dinâmico com os dois preços

- **WHEN** os dois preços estão preenchidos (maiores que zero)
- **THEN** o feedback dinâmico informa que a campanha será apresentada como oferta, citando os valores
- **AND** o seletor de intenção disponibiliza apenas "Oferta" (como hoje)

#### Scenario: Feedback dinâmico com apenas o preço de venda

- **WHEN** apenas o preço de venda está preenchido
- **THEN** o feedback dinâmico informa que será possível escolher entre Oferta e Destaque
- **AND** as opções disponíveis no seletor correspondem a Oferta e Destaque (como hoje)

#### Scenario: Feedback dinâmico com apenas o preço anterior

- **WHEN** apenas o preço anterior está preenchido (preço de venda vazio)
- **THEN** o feedback dinâmico exibe uma mensagem neutra orientando a informar o preço de venda para completar a oferta
- **AND** **não** exibe "Sem preço, a campanha será de Destaque ou Exclusividade."
- **AND** nenhuma validação nova é disparada e o avanço não é bloqueado

#### Scenario: Feedback dinâmico sem preço

- **WHEN** nenhum preço está preenchido
- **THEN** o feedback dinâmico informa que a campanha será de Destaque ou Exclusividade
- **AND** as opções disponíveis no seletor correspondem a Destaque e Exclusividade (como hoje)

#### Scenario: Regras de combinação preservadas na ajuda

- **WHEN** o usuário aciona a ajuda expansível "Como os preços mudam a campanha?"
- **THEN** as 3 regras atuais são exibidas (dois preços = Oferta; só venda = Oferta ou Destaque; sem preço = Destaque ou Exclusividade)
- **AND** a ajuda inicia colapsada

### Requirement: Informações obrigatórias na arte visíveis com microcopy positiva

O sistema SHALL orientar o campo de texto obrigatório na arte sem escondê-lo e com exemplos positivos:

- Label **"Informações obrigatórias na arte"** (alternativa "Detalhes obrigatórios na arte", decidida na UAT, é aceitável).
- Microcopy: "Informe características ou detalhes que precisam aparecer na imagem. Use uma linha para cada item.".
- Placeholder multi-linha com exemplo de produto (ex.: `Intensidade 8` / `Torra clássica` / `Peso líquido 500 g`).
- O campo SHALL permanecer diretamente visível na seção de avisos (não atrás de checkbox ou fluxo secundário).
- O sistema SHALL NOT exibir advertências negativas permanentes ("Não repita preço...", "Não repita validade...", "Não use para aviso ilustrativo...").

O comportamento atual de inclusão obrigatória e legível na arte (incluindo múltiplos itens) SHALL ser preservado, sem alteração de prompts.

#### Scenario: Label, microcopy e placeholder multi-linha

- **WHEN** o campo de informações obrigatórias é renderizado
- **THEN** o label e a microcopy orientam a informar características/detalhes que precisam aparecer na imagem, uma linha por item
- **AND** o placeholder exibe um exemplo real com múltiplas linhas de detalhes do produto

#### Scenario: Campo permanece visível

- **WHEN** a seção de avisos é renderizada
- **THEN** o campo de informações obrigatórias está diretamente visível
- **AND** não depende de marcar um checkbox ou abrir um fluxo secundário para aparecer

#### Scenario: Sem advertências negativas permanentes

- **WHEN** o formulário de campanha é renderizado
- **THEN** não há avisos permanentes instruindo a não repetir preço, validade ou aviso ilustrativo

#### Scenario: Transporte e arte inalterados

- **WHEN** o usuário preenche informações obrigatórias com múltiplas linhas
- **THEN** o body continua enviando `mandatoryArtworkText` no mesmo contrato
- **AND** nenhum prompt do diretor foi alterado por esta fase

### Requirement: Fronteiras canônicas entre as informações da campanha

O sistema SHALL deixar explícita a responsabilidade canônica de cada área, de forma que a prevenção de duplicação venha da organização das seções, labels e microcopy positiva (nunca de avisos negativos ou validadores semânticos):

- **Descrição do produto** → contexto para comunicação/copy.
- **Informações obrigatórias na arte** → características ou detalhes que precisam aparecer na imagem.
- **Preços** → valores comerciais.
- **Validade** → período, data ou limitação ("enquanto durarem os estoques").
- **Aviso ilustrativo** → controle próprio.
- **Selo promocional** → campo próprio.

#### Scenario: Cada informação tem uma única área canônica

- **WHEN** o formulário de campanha é renderizado
- **THEN** descrição do produto, informações obrigatórias, preços, validade, aviso ilustrativo e selo promocional aparecem em áreas distintas e reconhecíveis
- **AND** nenhuma área é apresentada como duplicata de outra

#### Scenario: Prevenção de duplicação sem validador semântico

- **WHEN** o usuário informa conteúdo semelhante em áreas diferentes (ex.: uma característica na descrição e nas informações obrigatórias)
- **THEN** nenhum validador semântico bloqueia ou alerta de forma negativa
- **AND** a revisão estruturada do brief é o ponto de conferência

### Requirement: Microcopy de orientação em fonte única com correspondência ao comportamento

A orientação dos campos da campanha SHALL viver em módulo de conteúdo puro (sem JSX, sem side-effects), consumido por componentes e testes, e os testes SHALL provar que a orientação corresponde ao comportamento real do sistema.

#### Scenario: Feedback de preço corresponde à inferência real

- **WHEN** os testes comparam o feedback dinâmico com `inferIntent`/opções disponíveis
- **THEN** as combinações reais de preço (dois preços, só venda, sem preço) produzem feedback e opções coerentes entre si
- **AND** o estado intermediário "só preço anterior" produz feedback neutro coerente com o caminho sem preço da inferência
- **AND** nenhuma mensagem promete um intent que o seletor não oferece

#### Scenario: Strings sem duplicação divergente

- **WHEN** componentes e testes usam a mesma microcopy
- **THEN** as strings provêm do módulo de conteúdo único
- **AND** não há cópias divergentes
