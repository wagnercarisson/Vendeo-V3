## MODIFIED Requirements

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
