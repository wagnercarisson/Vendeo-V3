# landing-conversion-experience Specification

## Purpose
TBD - created by archiving change fase-51-1-landing-visual-produto. Update Purpose after archive.
## Requirements
### Requirement: Estrutura da landing com blocos de função única

A landing pública (`src/app/page.tsx` + `src/components/landing/*`) SHALL ser uma página curta, visual e orientada à conversão, em português e mobile-first, composta por blocos em que cada um responde a uma pergunta distinta, na ordem: hero; transformação e simplicidade; apresentação do produto; identidade e controle; abordagens de divulgação; oferta de teste gratuito; FAQ e rodapé legal.

- Nenhum bloco principal SHALL repetir a função de outro.
- A apresentação do produto (prova de flexibilidade visual) e as abordagens de divulgação (prova de diferentes formas de comunicar o produto) SHALL ocupar blocos distintos, com funções distintas.
- "Como funciona" SHALL ser absorvido pelo bloco de transformação, não reimplementado como bloco separado.
- A seção "Novidades" SHALL ocupar posição secundária ou o rodapé.

#### Scenario: Página renderiza os blocos na ordem e sem duplicação

- **WHEN** a landing é renderizada
- **THEN** os blocos hero, transformação, apresentação do produto, identidade e controle, abordagens de divulgação, oferta de teste gratuito, FAQ/rodapé aparecem nessa ordem
- **AND** não existe um bloco separado "Como funciona" duplicando a transformação
- **AND** "Novidades" aparece em posição secundária ou no rodapé

#### Scenario: Mobile não empurra mensagem e CTA para muito abaixo

- **WHEN** a landing é exibida em viewport mobile pequena
- **THEN** a mensagem principal e o CTA do hero permanecem visíveis sem exigir rolagem por uma imagem excessivamente grande

### Requirement: Narrativa e copy orientadas ao resultado

A landing SHALL comunicar a transformação de informações simples em campanha pronta, usando a headline "O que seu negócio quer divulgar vira uma campanha pronta para publicar." e a subheadline "Você informa o básico. O Vendeo prepara a campanha completa — com arte e texto — pronta para publicar."

- A narrativa SHALL deixar claro que o usuário escolhe como apresentar e que o Vendeo prepara a campanha, **sem exigir que uma string literal específica apareça integralmente** (o hero usa "Você define como quer apresentar."; a preparação pelo sistema fica na subheadline e no bloco de identidade).
- Nenhum bloco SHALL exigir conhecimento de termos internos (por exemplo `briefing`, `intenção`, `F56`) para compreender o benefício.
- A landing SHALL NOT explicar regras internas de inferência nem sugerir que a intenção seja sempre uma seleção explícita do usuário.

#### Scenario: Headline e subheadline presentes

- **WHEN** a landing é renderizada
- **THEN** a headline e a subheadline aprovadas são exibidas
- **AND** a narrativa deixa claro que o usuário escolhe como apresentar e que o Vendeo prepara a campanha (sem exigir a string antiga na íntegra)

#### Scenario: Sem termos internos expostos

- **WHEN** o conteúdo público da landing é renderizado
- **THEN** nenhum bloco exige termos internos (`briefing`, `intenção`, `F56`) para comunicar o benefício

### Requirement: Direção e função das imagens

A landing SHALL definir, antes da seleção dos exemplos definitivos, a função, a proporção e o requisito de cada imagem, de modo que a troca de campanhas não exija refazer o layout:

- **Hero:** provar qualidade (campanha protagonista; proporção estável).
- **Transformação:** provar simplicidade (informações simples → campanha).
- **Apresentação do produto:** provar flexibilidade visual (estúdio/ambientado/fundo original, com a mesma abordagem).
- **Identidade:** provar coerência de marca com exemplos.
- **Abordagens de divulgação:** provar diferentes formas de comunicar o produto (oferta/destaque/exclusivo, com o mesmo cenário e identidade).

Imagens que não acrescentem uma prova SHALL ser eliminadas. Exemplos finais SHALL ser selecionados e aprovados por humano antes da conclusão da entrega; placeholders SHALL poder apoiar a aprovação visual. A landing SHALL NOT inventar depoimentos, resultados comerciais ou provas de identidade.

#### Scenario: Cada bloco tem imagem com função de prova

- **WHEN** a composição da landing é revisada
- **THEN** cada imagem corresponde a uma única função de prova (qualidade, simplicidade, flexibilidade ou coerência)
- **AND** imagens sem função de prova foram eliminadas

#### Scenario: Troca de campanha sem refazer layout

- **WHEN** uma campanha aprovada substitui um placeholder em um bloco
- **THEN** o layout do bloco permanece inalterado

### Requirement: Escopo de capacidades comunicadas

A landing SHALL comunicar as capacidades aprovadas do produto: campanhas de produto em formato 1:1; apresentação em estúdio, ambientada ou preservando o fundo original; e abordagens de oferta, destaque e exclusivo, que SHALL aparecer nos exemplos.

- A landing SHALL NOT anunciar serviços, informativos ou formatos fora desse escopo.
- A landing SHALL NOT ativar o fluxo, alterar flags ou permissões, nem condicionar a comunicação à ativação do novo fluxo.
- A landing SHALL NOT apresentar essas capacidades como funcionalidades futuras ou "em breve"; elas são a promessa de valor do produto.

#### Scenario: Apenas capacidades do escopo aparecem

- **WHEN** o conteúdo da landing é revisado
- **THEN** somente formato 1:1, estúdio/ambientado/fundo original e oferta/destaque/exclusivo são promovidos
- **AND** serviços, informativos e outros formatos não são anunciados

#### Scenario: Capacidades comunicadas sem ativar o fluxo

- **WHEN** a landing é renderizada
- **THEN** as capacidades aprovadas são comunicadas como valor do produto
- **AND** nenhuma flag é ativada, nenhuma permissão é alterada e a página não depende da ativação do fluxo
- **AND** a comunicação não é enquadrada como funcionalidade futura ou "em breve"

### Requirement: Conteúdo demonstrativo estático sem geração ao vivo

A landing SHALL usar conteúdo demonstrativo predefinido para representar a transformação. A landing SHALL NOT chamar a API de geração, produzir arte ao vivo ou executar geração paga.

#### Scenario: Página não invoca geração

- **WHEN** a landing é carregada e utilizada
- **THEN** nenhuma chamada à API de geração é feita
- **AND** nenhuma geração de campanha é executada

### Requirement: Oferta comunicada em componente independente e com fonte única

A landing SHALL exibir a oferta em um card compartilhado e independente
(`OfferCard`, variante `full`), cujos textos vêm de uma fonte local única
(`src/components/landing/public-offer-copy.ts`), sem leitura de env, flag, rede
ou banco de dados.

O card SHALL exibir, como mensagem principal curta, exatamente “28 dias gratuitos
e até 20 créditos.” e, como complemento, exatamente “Sem cartão de crédito.
Oferta para novas contas elegíveis.”.

O expansível SHALL usar o rótulo exato “Como funciona o teste gratuito?” e
concentrar as condições em informação secundária: o período começa após concluir
o cadastro e a configuração inicial da loja; 5 créditos iniciais e mais 5 nos
dias 7, 14 e 21, no processamento diário, até o máximo de 20 créditos no período;
os créditos acumulam, inclusive parcelas liberadas durante ausência, e os
créditos gratuitos restantes vencem ao final do período.

- A distribuição, o acúmulo, o início e o vencimento SHALL constar
  **obrigatoriamente** apenas em informação secundária/expansível, nunca na
  mensagem principal.
- Com o cadastro fechado, os detalhes SHALL informar que solicitar acesso não
  inicia o período do teste. Essa nota SHALL NOT aparecer com o cadastro aberto.
- A landing SHALL NOT prometer 20 campanhas, uso ilimitado ou participação por
  raiz de CNPJ.
- A landing SHALL continuar sem implementar concessões, calendário, saldo,
  expiração, notificações ou mudanças na contabilidade.

#### Scenario: Mensagem principal curta e detalhes no expansível

- **WHEN** a seção de oferta é renderizada
- **THEN** a mensagem principal exibe exatamente “28 dias gratuitos e até 20 créditos.”
- **AND** o complemento exibe exatamente “Sem cartão de crédito. Oferta para novas contas elegíveis.”
- **AND** as condições (28 dias, 5 + 5 + 5 + 5, máximo 20, acúmulo, início após
  cadastro/configuração inicial e vencimento do gratuito restante) constam apenas
  no expansível
- **AND** nenhuma promessa de 20 campanhas, uso ilimitado ou raiz de CNPJ é feita

#### Scenario: Cadastro fechado não inicia o período

- **WHEN** `publicSignupEnabled` é `false`
- **THEN** o expansível informa que solicitar acesso não inicia o período do teste
- **AND** o CTA fechado exibe “Solicitar acesso gratuito”
- **AND** o apoio exibe “Solicite seu convite para experimentar o Vendeo.”

#### Scenario: Cadastro aberto preserva caminhos e remove a nota fechada

- **WHEN** `publicSignupEnabled` é `true`
- **THEN** o card exibe “Continuar com Google” e “Continuar com email”
- **AND** não exibe o CTA fechado, o apoio de convite nem a nota de que solicitar
  acesso não inicia o período
- **AND** os destinos e handlers de autenticação permanecem inalterados

#### Scenario: Fonte única sem literais duplicados

- **WHEN** os componentes públicos da oferta são revisados
- **THEN** os textos aprovados são importados de `public-offer-copy.ts`
- **AND** os componentes não repetem os literais antigos “Experimente o Vendeo em
  sua loja”, “Como funcionam os créditos do teste gratuito?” ou “No beta fechado,
  solicitar acesso…”

### Requirement: Controles de acesso e ações secundárias

A landing SHALL reutilizar `publicSignupEnabled`/`getLaunchConfig()` em todos os CTAs de aquisição, incluindo os dos blocos de transformação, identidade e oferta. "Entrar" SHALL ser ação secundária, destinada a quem já possui conta, e SHALL NOT ser usada como ação universal de aquisição.

#### Scenario: Ação "Entrar" é secundária

- **WHEN** a landing é renderizada em qualquer modo da flag
- **THEN** "Entrar" aparece como ação secundária
- **AND** a ação principal de aquisição segue o modo da flag

#### Scenario: Transformação, identidade e oferta respeitam a flag

- **WHEN** a flag de signup público está desligada
- **THEN** os CTAs de aquisição da transformação, da identidade e da oferta direcionam para a solicitação de acesso
- **WHEN** a flag de signup público está ligada
- **THEN** os CTAs de aquisição da transformação, da identidade e da oferta direcionam para os caminhos de cadastro existentes

### Requirement: Acessibilidade e preservação de links e estados existentes

A landing SHALL preservar a estrutura semântica e a acessibilidade (hierarquia de headings, landmarks, foco visível, alvos de toque de ao menos 44px) e os links legais existentes (`/termos`, `/privacidade`, `/uso-aceitavel` e Contato). O formulário de solicitação de acesso SHALL seguir o modo da chave: com a chave fechada, o formulário SHALL estar presente com os estados preservados; com a chave aberta, o formulário SHALL estar oculto e os caminhos de cadastro existentes SHALL estar disponíveis.

#### Scenario: Chave fechada — formulário presente e estados preservados

- **WHEN** `publicSignupEnabled` é `false`
- **THEN** o formulário de solicitação está presente
- **AND** os estados de envio/sucesso/erro do formulário continuam disponíveis
- **AND** os links legais existentes permanecem funcionais

#### Scenario: Chave aberta — formulário oculto e cadastro disponível

- **WHEN** `publicSignupEnabled` é `true`
- **THEN** o formulário de solicitação não é exibido
- **AND** os caminhos de cadastro existentes (Google e email) estão disponíveis
- **AND** os links legais existentes permanecem funcionais

#### Scenario: Estrutura semântica preservada

- **WHEN** a landing é renderizada
- **THEN** a hierarquia de headings e os landmarks acessíveis são mantidos

### Requirement: Fronteira e independência da fatia

A landing SHALL ser implementada preferencialmente em `src/app/page.tsx`, `src/components/landing/*`, assets próprios e testes correspondentes. A landing SHALL NOT alterar código da F56, ledger, migrations, serviços de crédito, onboarding, telas autenticadas, APIs de geração, autenticação, elegibilidade, semântica de flags ou o contrato do `POST /api/access-requests`. Qualquer necessidade de alterar layout global, `globals.css`, design system ou dependências SHALL ser identificada e justificada previamente, preferindo estilos locais e componentes existentes.

#### Scenario: Nenhuma alteração em contratos compartilhados

- **WHEN** a implementação da landing é revisada
- **THEN** autenticação, elegibilidade, semântica de flags e o contrato do `POST /api/access-requests` permanecem inalterados
- **AND** nenhum código da F56, crédito, migration, onboarding ou tela autenticada é alterado

#### Scenario: Alteração global justificada

- **WHEN** surge a necessidade de tocar layout global, `globals.css`, design system ou dependências
- **THEN** a necessidade é exposta e justificada antes da alteração
