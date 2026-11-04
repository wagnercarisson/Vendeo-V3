## Why

A oferta e o acesso estão espalhados por componentes e páginas: o texto completo
vive em `offer-section.tsx`, o CTA fechado em `acquisition-cta.tsx` e a composição
de `/floriculturas` em um terceiro componente. A comunicação aprovada mudou
(“28 dias gratuitos e até 20 créditos”, “Solicitar acesso gratuito”, novo rótulo
do expansível), e manter cópias manuais tende a divergir entre home e futuras
páginas. Uma fonte local única resolve o problema sem serviço externo, painel ou
banco.

## What Changes

- Criar `src/components/landing/public-offer-copy.ts` como fonte única dos textos
  da oferta e do acesso, consumida por home, `/floriculturas` e futuras páginas.
- Aplicar a comunicação aprovada:
  - resumo “28 dias gratuitos e até 20 créditos.”;
  - complemento “Sem cartão de crédito. Oferta para novas contas elegíveis.”;
  - expansível “Como funciona o teste gratuito?”;
  - botão fechado “Solicitar acesso gratuito”;
  - apoio fechado “Solicite seu convite para experimentar o Vendeo.”;
  - nota de que solicitar acesso não inicia o período, somente no cadastro fechado.
- Criar um card compartilhado com duas variantes de apresentação (`full` na home,
  `compact` no encerramento de `/floriculturas`), reutilizando cores, bordas,
  fontes e hierarquia do card atual.
- Manter a abertura de `/floriculturas` apenas com o grupo visual de botões em
  modo âncora: os controles de aquisição navegam para o card final
  (`#floriculturas-oferta`) sem iniciar OAuth nem abrir cadastro.
- Renderizar um único card de oferta, no encerramento de `/floriculturas`, com as
  ações reais (Google/OAuth, e-mail ou solicitação) e um ID estável de âncora.
- Preservar a composição aprovada dos CTAs: Google/e-mail lado a lado no desktop
  e “Conheça o Vendeo” centralizado abaixo; mobile empilhado. Cadastro fechado
  mantém primário + institucional lado a lado.
- Adicionar `label` opcional ao `GoogleButton` (default inalterado) para que o
  landing consuma a fonte sem alterar login/cadastro.
- Atualizar as specs de landing, `/floriculturas` e CTA de acesso; sem nova fase,
  sem migration, sem backend e sem alteração de flag.
- **Fora desta change:** serviço externo, CMS, painel, elegibilidade individual,
  regras de crédito/onboarding/billing, metadata, sitemap, imagens, fontes,
  header/rodapé e refatoração de login/cadastro.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `landing-conversion-experience`: a oferta passa a ser renderizada por um card
  compartilhado com a nova copy aprovada, fonte única e nota de cadastro fechado
  condicional.
- `floriculturas-demonstration-page`: a abertura mantém apenas o grupo visual de
  botões em modo âncora e o encerramento recebe o único card compacto de oferta,
  com ID estável, ações reais e expansível independente.
- `access-request-history`: o rótulo do CTA de acesso fechado muda para
  “Solicitar acesso gratuito” e o apoio fechado é exibido no card, preservando
  destino, formulário, contrato da API e comportamento por flag.

## Impact

- **Código:** novos `public-offer-copy.ts`, `offer-card.tsx` e
  `google-g-glyph.tsx`; alterações em `offer-section.tsx`, `acquisition-cta.tsx`
  (modo `localHref`), `access-cta-group.tsx`, `google-button.tsx` (prop opcional)
  e `src/app/(marketing)/floriculturas/page.tsx`.
- **Specs:** `landing-conversion-experience`, `floriculturas-demonstration-page`,
  `access-request-history`.
- **Testes:** `offer-section`, `access-cta-group`, `acquisition-cta`,
  `floriculturas-page`, `landing-page` e novo teste do card/fonte.
- **Banco/API/dependências:** nenhum. Sem migration, rota de API, flag, OAuth,
  crédito, billing ou geração paga.
- **Operação:** a fonte é local; atualizar a comunicação exige deploy, como
  aprovado.
