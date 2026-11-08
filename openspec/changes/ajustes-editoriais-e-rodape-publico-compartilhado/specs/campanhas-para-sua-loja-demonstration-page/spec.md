## MODIFIED Requirements

### Requirement: Copy aprovada sem acréscimos

A página SHALL usar exatamente a copy aprovada pelo responsável para H1, texto de
abertura, linha de apoio, títulos e rótulos dos casos, marcadores de formato,
frase-alinhada, explicação, kit, aviso, bloco de rotina, chamada final e texto de
apoio.

A copy aprovada é a registrada em
`.planning/quick/261107-pdp-pagina-publica-praticidade-e-identidade/261107-pdp-COPY.md`,
com os dois ajustes editoriais aprovados em 2026-11-08 para o bloco de rotina,
incluindo o kit exato da cama:

- Título: `Cama Pet Comfort: aconchego para seu pet`
- Legenda: `Um destaque cheio de carinho na vitrine do Pet Shop Bicho Fofo: a Cama Pet Comfort é macia e confortável, perfeita para dar ao seu companheiro um cantinho especial de descanso. Seu pet merece esse mimo! 🐾`
- Hashtags: `#CamaPetComfort #ConfortoPet #Petshop #DestaquePet #BichoFofo`
- Chamada: `Venha conhecer na loja!`

O bloco de rotina SHALL usar exatamente:

- H2: `Feito para a rotina de quem atende, repõe e ainda divulga.`
- Parágrafo: `Quem administra uma loja precisa conciliar atendimento, estoque, fornecedores e divulgação. O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.`

A página SHALL NOT prometer conversão, aumento de vendas, alcance, tráfego, posição
no Google ou resultado comercial. SHALL NOT publicar a média de ~30 segundos,
contador ou prazo garantido. SHALL NOT sugerir publicação automática. SHALL NOT
explicar campos obrigatórios, badges, onboarding ou configuração técnica. SHALL
NOT reproduzir preço em texto, metadata ou dado estruturado.

#### Scenario: Kit exato e sem controles

- **WHEN** o kit da cama é renderizado
- **THEN** os quatro campos SHALL aparecer uma única vez cada, em HTML
- **AND** SHALL NOT existir botão “Copiar”, captura de tela ou controle operacional

#### Scenario: Aviso e frase-alinhada únicos

- **WHEN** a página é renderizada
- **THEN** o aviso demonstrativo aprovado SHALL aparecer uma única vez, após o kit
- **AND** a frase `Produtos diferentes. Formatos diferentes. A mesma identidade da sua loja.` SHALL aparecer uma única vez, no caso 2
- **AND** SHALL NOT existir bloco público adicional de advertência

#### Scenario: Bloco de rotina com os dois ajustes e a continuação preservada

- **WHEN** o bloco de rotina é renderizado
- **THEN** o H2 SHALL ser exatamente `Feito para a rotina de quem atende, repõe e ainda divulga.`
- **AND** o parágrafo SHALL começar com `Quem administra uma loja precisa conciliar atendimento, estoque, fornecedores e divulgação.`
- **AND** o parágrafo SHALL terminar com `O Vendeo encurta o caminho entre o produto que está na vitrine e a publicação que precisa sair.`
- **AND** os textos `Feita para a rotina de quem atende, repõe e ainda divulga.` e `Quem toca uma loja pequena acumula funções.` SHALL NOT aparecer
- **AND** nenhum outro texto da página SHALL mudar

#### Scenario: Nenhuma promessa comercial

- **WHEN** o HTML e a metadata são inspecionados
- **THEN** SHALL NOT haver promessa de vendas, conversão, alcance, tráfego, posição ou publicação automática
- **AND** SHALL NOT haver `R$` no texto HTML ou na metadata

### Requirement: Link único na home

A home SHALL exibir o link `Campanhas sem complicação`, apontando para
`/campanhas-para-sua-loja`, em um rodapé compartilhado que agrupa os destinos de
conteúdo sob “Explore o Vendeo”, ao lado de `Floriculturas` e `Padarias`.

O rodapé compartilhado SHALL preservar o conteúdo visível atual da home e os
demais links existentes. A nova composição SHALL NOT criar bloco de conteúdo,
alterar a ordem dos blocos, substituir imagens, alterar CTAs ou reescrever textos
existentes.

#### Scenario: Link presente e demais preservados

- **WHEN** o rodapé da home é renderizado
- **THEN** o link `Campanhas sem complicação` SHALL apontar para `/campanhas-para-sua-loja`
- **AND** `Floriculturas` e `Padarias` SHALL permanecer com seus destinos e rótulos
- **AND** o grupo “Explore o Vendeo” SHALL conter os três destinos
- **AND** nenhum outro conteúdo visível da home SHALL mudar
