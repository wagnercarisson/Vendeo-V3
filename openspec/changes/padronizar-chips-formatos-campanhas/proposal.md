## Why

Os formatos de campanha são apresentados de maneiras diferentes conforme a superfície e o fluxo de origem. A listagem e o dashboard exibem chips apenas para campanhas conjuntas e apenas para formatos entregues; o detalhe usa links com os rótulos crus `1:1`/`9:16`. Campanhas individuais e legadas mostram um único rótulo solto. Isso dificulta comparar campanhas, esconde estados de ausência/processamento e pode sugerir que um formato não entregue está disponível.

Esta change cria uma apresentação única para **Quadrado 1:1** e **Vertical 9:16** nas três superfícies, sem alterar as autoridades de entrega, os gates existentes nem o comportamento financeiro.

## What Changes

- Introduzir um modelo de apresentação tipado e seguro para os dois formatos, com estados explícitos: `delivered`, `absent`, `processing`, `refunded`, `unknown`/`unavailable`.
- Criar um componente visual compartilhado de chips, consumido por listagem, dashboard e detalhe, com os mesmos nomes, vocabulário de estados e explicações; a evidência disponível pode variar por superfície, mas o significado não.
- Definir entrega parcial apenas quando os dois formatos foram solicitados e apenas um foi entregue; campanha individual pronta não é parcial.
- Não converter erro de campanha em ausência comprovada: sem evidência explícita, o formato fica `unknown`; a lista pode ter menos informação que o detalhe, mas o vocabulário e a semântica dos estados são os mesmos.
- Exibir **sempre os dois chips** nas superfícies de campanha:
  - formato entregue com aparência de disponível;
  - formato ausente em cinza, sem `+` e sem promessa de geração;
  - processamento com indicador próprio, distinto de entregue;
  - unknown/unavailable com indicação honesta de informação indisponível, nunca “Não gerado”;
  - estorno conhecido visível como parte do estado, não escondido como ausência simples.
- **BREAKING (UX)**: na listagem e no dashboard, os chips passam a ser somente informativos. Deixam de navegar individualmente para `?format=`. Preservar as ações atuais de abrir campanha e baixar.
- No detalhe, preservar a seleção entre formatos já entregues de campanhas conjuntas, com destaque distinto para o formato ativo. Formato não entregue não recebe link de preview/download nem ação de geração. Campanhas individuais/legadas mantêm seu acesso atual ao formato existente.
- Preservar integralmente o tratamento estrito de `?format=` no fluxo conjunto: inválido, vazio, duplicado ou não entregue não cai silenciosamente no preferido.
- Garantir acessibilidade: não depender apenas da cor; explicação por hover/foco e também no celular; evitar botões desabilitados que tornem a explicação inacessível.
- Localizar rótulos e explicações em `pt-BR` e `es-419`, conforme o catálogo existente.
- Aplicar o tema dark e os tokens de `openspec/design-system/MASTER.md`, sem light mode e sem emojis como ícones.
- **Revisão visual (2026-11-21/22, fase 61 aberta):** a primeira implementação foi aceita tecnicamente, mas não visualmente. Os chips passam a exibir apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” saem do texto visível e permanecem no modelo/descrição acessível. O controle “?” separado é removido: o próprio chip é `<a>` para seleção entregue no detalhe e `<button type="button">` quando a ação é apenas explicar; a ajuda flutuante é ancorada no chip, sem deslocar card, linha ou arte. Não altera builders, classificação, lifecycle, autoridades, financeiro ou consultas.
- Manter a leitura conjunta em lote, sem N+1 e sem novas consultas por card. Priorizar dados já disponíveis e comprovar zero chamadas adicionais causadas pelos chips contra a mesma página antes/depois; a assinatura de miniaturas legadas permanece como está.

**Fora desta fatia:** geração, expansão, entrega financeira, confirmação de custo, modal, reserva, estorno, pricing, provider, flag, RPC, migration, backfill, alteração de campanhas existentes, reconstrução da base quadrada, inspeção de bytes, alteração de copy/miniaturas/aprovação/recuperação, e qualquer definição de elegibilidade futura para receber outro formato.

## Capabilities

### New Capabilities

- `campaign-format-presentation`: contrato de apresentação dos formatos 1:1 e 9:16 — modelo tipado, estados, componente compartilhado, acessibilidade e localização — aplicado às superfícies de campanha sem alterar as autoridades de entrega.

### Modified Capabilities

- `campaign-list-ui`: o card passa a exibir os dois chips informativos com estados padronizados; a navegação individual por chip deixa de existir nesta fatia.
- `dashboard-operational-composition`: as campanhas disponíveis passam a exibir os dois chips informativos com os mesmos estados da listagem, sem duplicar a linha e sem nova consulta por card.
- `campaign-page-ui`: o detalhe passa a usar os chips compartilhados, com destaque do formato ativo, estados não entregues visíveis e preservação estrita da seleção `?format=`.

## Impact

- **UI compartilhada**: novo componente em `src/components/campaign/` e modelo tipado de apresentação.
- **Leitura e adaptação**: `src/lib/campaign/list.ts`, `src/lib/dashboard/campaigns.ts`, `src/lib/campaign/display.ts`, `src/lib/campaign/format-resolution.ts` e `src/lib/product-two-format/list-summary.ts`.
- **Superfícies**: `src/app/(app)/campanhas/client.tsx`, `src/components/dashboard/available-campaign-card.tsx`, `src/components/dashboard/dashboard-campaigns.tsx`, `src/app/(app)/campanhas/[id]/page.tsx` e `src/app/(app)/campanhas/[id]/client.tsx`.
- **Textos**: catálogos e tipos de `campaign-list`, `dashboard` e `campaign-detail` em `pt-BR` e `es-419`.
- **Testes**: matriz de fluxos/estados, paridade entre superfícies, acessibilidade, localização, responsividade e contagem de consultas.
- **Sem alterações** em banco, Storage, APIs financeiras, migrations, RPCs ou dados persistidos. Nenhum acesso a homolog/produção.
