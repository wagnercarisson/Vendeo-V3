## MODIFIED Requirements

### Requirement: Caminho secundário para conhecer o Vendeo

A abertura SHALL oferecer somente o grupo visual de botões, sem card, resumo,
complemento ou expansível. O encerramento SHALL oferecer o conjunto de acesso
dentro do único card de oferta da página.

Os dois conjuntos SHALL preservar os mesmos rótulos e a mesma composição por
estado da flag. No desktop, com o cadastro fechado, o CTA “Solicitar acesso
gratuito” e o link “Conheça o Vendeo” ficam lado a lado, com a mesma altura; com
o cadastro aberto, Google e e-mail ficam lado a lado em colunas iguais e o link
institucional fica centralizado abaixo do par. No mobile, todos empilham com a
mesma largura e o mesmo alinhamento.

Na abertura, todas as ações de aquisição SHALL ser links locais para o card do
encerramento (`#floriculturas-oferta`) e SHALL NOT iniciar OAuth, abrir cadastro
ou navegar para fora da página. No estado aberto, a abertura SHALL NOT renderizar
o `GoogleButton` funcional; usa links locais com aparência equivalente. O link
“Conheça o Vendeo” continua apontando para `/`, na mesma aba, sem âncora.

No encerramento, o card mantém as ações reais conforme a flag: Google/OAuth e
e-mail (`/signup`) com o cadastro aberto, ou solicitação (`/#acesso`) com o
cadastro fechado. O link “Conheça o Vendeo” permanece em `/`.

O link secundário SHALL NOT apontar para `/#acesso` e SHALL NOT alterar a home nem
os CTAs dos demais consumidores.

#### Scenario: Abertura com prévia local, sem card

- **WHEN** a página é renderizada
- **THEN** a abertura exibe apenas o grupo visual de botões
- **AND** não exibe card, resumo, complemento nem expansível
- **AND** “Conheça o Vendeo” aponta para `/`

#### Scenario: Ações da abertura apenas navegam por âncora

- **WHEN** o cadastro está fechado
- **THEN** “Solicitar acesso gratuito” da abertura aponta para `#floriculturas-oferta`
- **WHEN** o cadastro está aberto
- **THEN** os controles “Continuar com Google” e “Continuar com email” da abertura
  são links locais para `#floriculturas-oferta`
- **AND** nenhum deles inicia OAuth ou abre `/signup`

#### Scenario: Encerramento com o único card e ações reais

- **WHEN** a página é renderizada
- **THEN** existe exatamente um card de oferta, no encerramento
- **AND** com a flag desligada, o CTA do card aponta para `/#acesso`
- **AND** com a flag ligada, o card mantém Google/OAuth e e-mail para `/signup`

#### Scenario: Lado a lado no desktop e empilhado no mobile

- **WHEN** a página é exibida em desktop
- **THEN** o CTA principal e o link secundário SHALL ficar lado a lado com a mesma
  altura no cadastro fechado
- **AND** com o cadastro aberto, Google e e-mail SHALL ficar lado a lado e o link
  institucional centralizado abaixo
- **AND** em mobile SHALL empilhar com a mesma largura e alinhamento

#### Scenario: Link secundário não usa a âncora de acesso

- **WHEN** o link “Conheça o Vendeo” é inspecionado
- **THEN** o destino SHALL ser `/`
- **AND** SHALL NOT ser `/#acesso`

## ADDED Requirements

### Requirement: Único card compacto de oferta no encerramento

O encerramento SHALL conter um único card compacto de oferta, reutilizando cores,
bordas, fontes e hierarquia do card da home. O card SHALL exibir o resumo “28 dias
gratuitos e até 20 créditos.”, o complemento “Sem cartão de crédito. Oferta para
novas contas elegíveis.” e o expansível “Como funciona o teste gratuito?”.

Com o cadastro fechado, o card SHALL exibir ainda o CTA “Solicitar acesso
gratuito”, o apoio “Solicite seu convite para experimentar o Vendeo.” e, nos
detalhes, a informação de que solicitar acesso não inicia o período do teste. Com
o cadastro aberto, o card SHALL preservar “Continuar com Google” e “Continuar com
email” e SHALL NOT exibir o CTA fechado, o apoio de convite nem a nota de período.

Os textos SHALL vir da fonte local única `src/components/landing/public-offer-copy.ts`,
sem duplicação entre a versão completa e a compacta. A abertura SHALL NOT repetir
esses textos.

O card SHALL ter um ID único e estável (`floriculturas-oferta`) como destino das
âncoras da abertura, com `tabindex="-1"` e margem de rolagem suficiente para que
o início do card fique visível e focável pelo teclado. O expansível SHALL ser
nativo, acionável pelo teclado e independente.

#### Scenario: Card único com a comunicação aprovada

- **WHEN** `/floriculturas` é renderizada em qualquer estado da flag
- **THEN** existe exatamente um card de oferta
- **AND** ele exibe o resumo, o complemento e o expansível aprovados
- **AND** a abertura não repete nenhum desses textos

#### Scenario: Estados da flag no card único

- **WHEN** o cadastro está fechado
- **THEN** o card exibe “Solicitar acesso gratuito”, o apoio de convite e a nota
  de que solicitar acesso não inicia o período
- **WHEN** o cadastro está aberto
- **THEN** o card exibe Google e e-mail e não exibe CTA fechado, apoio de convite
  nem nota de período

#### Scenario: Destino de âncora visível e acessível

- **WHEN** um link da abertura é acionado pelo mouse ou pelo teclado
- **THEN** a navegação leva ao início do card (`#floriculturas-oferta`)
- **AND** o card é focável (`tabindex="-1"`) e não fica oculto sob o topo
- **AND** o expansível do card permanece acionável pelo teclado

#### Scenario: Sem overflow em mobile

- **WHEN** a página é exibida em viewport de 390 px
- **THEN** o card e o rótulo “Solicitar acesso gratuito” SHALL permanecer dentro
  da largura disponível
- **AND** não SHALL haver overflow horizontal
