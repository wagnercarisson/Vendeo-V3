## Why

A F56.1 entregou, isolada e testada por simulação, toda a infraestrutura do novo fluxo Produto 1:1 — capacidade própria `campaign_product_image`, configuração auditável do par principal/fallback, contrato de snapshot imutável, taxonomia de falhas, resposta pública `IMG-001` com referência opaca, adapter que propaga qualidade e pricing ciente de qualidade. Nada disso está ligado a uma geração real: não há ativação, não há snapshot de campanha real, não há débito transacional e não há download servido pelo caminho novo.

Fazer a integração agora, em caminho **controlado e isolado do fluxo legado**, permite responder a três riscos concretos antes de qualquer virada produtiva: (1) ativar o fluxo novo em loja errada ou por falha de leitura de flag; (2) cobrar o lojista por tentativa técnica ou debitar duas vezes; (3) perder a arte por uma falha de copy ou impedir o download por causa do gate de aprovação antigo. A primeira entrega gera, persiste e disponibiliza a arte para download **sem aprovação/reprovação humana e sem revisor automático**; aprovação, reprovação e correções permanecem na F56.3.

## What Changes

- **Duas chaves de ativação auditáveis no admin, desligadas por padrão.** Uma habilita o novo fluxo para lojas com `stores.is_test_store = true`; a outra habilita para todas as lojas. A decisão de roteamento é **obrigatoriamente server-side**. Chave desligada, ausente ou com falha de leitura mantém o **fluxo legado**. Precedência, rollback e comportamento de campanhas já criadas ficam definidos e testáveis.
- **Seleção explícita de intenção e fundo no formulário de Produto.** O lojista escolhe Oferta, Destaque ou Exclusivo e Fundo de estúdio, Cenário ambientado ou Manter cenário original. **Manter cenário original só é elegível com exatamente uma imagem de produto**; imagem de identidade não entra nessa contagem. Validação server-side, com erro de campo (não `IMG-001`).
- **Formato inicial único 1:1, saída 1024×1024.** As dimensões reais do arquivo persistido são registradas; o sistema **não** declara 1080×1080 para um arquivo de 1024×1024.
- **Incorporação versionada dos prompts e regras aprovados na bancada** (Produto v4, compositor v5 e as três intenções), em runtime de produção próprio. Nome completo com palavras, números e unidades; fidelidade às referências; primeira imagem/variante protagonista e auxiliares secundárias; identidade fiel; textos obrigatórios uma única vez; matriz comercial por intenção; fundo escolhido. **Sem** depender de configuração mutável da bancada em tempo de execução e **sem** alterar silenciosamente a intenção escolhida.
- **Par global modelo–qualidade congelado em snapshot da campanha.** A escolha inicial aprovada (`principal gpt-image-2.5-sunburst/medium`, `fallback gpt-image-2/medium`) permanece decisão humana não ativa; a execução consome a configuração F56.1. **Pricing explícito e completo para AMBOS os pares é pré-condição fail-closed** antes de reservar crédito ou chamar provider.
- **Execução real da política F56.1.** Até duas tentativas no principal e uma no fallback (máximo três); disponibilidade/capacidade explícita pode ir direto ao fallback; `rate_limit` é transitório; quota/faturamento não acionam fallback. Registrar modelo, qualidade, alvo, tentativa, run/trace, resultado e custo interno por chamada. Erros públicos usam **`IMG-001` + referência opaca**, sem revelar motivo interno; diagnóstico recuperável pelo suporte.
- **Cobrança: UMA campanha entregue custa UM crédito**, independentemente de tentativas técnicas. Arte gerada, persistida e disponível para download constitui entrega válida e consome um crédito. Falha técnica sem arte utilizável **não debita** o lojista. Reserva, confirmação/estorno e idempotência são **transacionais e testáveis**.
- **A copy não bloqueia a entrega.** Se apenas a copy falhar, a arte pronta/downloadável e o único débito são conservados; a copy é marcada como pendente/falha e a ação **"Tentar gerar copy novamente"** aparece **somente** nesse estado. A ação exige autenticação e ownership, tenta **apenas os textos**, não altera/regera a imagem e **não consome outro crédito**; protegida contra cliques duplicados e repetição abusiva, com registro do custo interno da chamada.
- **Snapshot e histórico por campanha.** Fluxo, briefing, intenção, fundo, referências e par de modelos são preservados por campanha. Cada geração/tentativa tem histórico append-only (ou correlação equivalente); o único run/trace histórico **não** é sobrescrito, preparando a F56.3.
- **Legado intocado.** Campanhas antigas continuam no fluxo e nas regras de download anteriores. A flag e a regeneração da F37 **não** governam o novo fluxo. Sem contador de correções e sem aprovação/reprovação nesta fatia.

**BREAKING:** nenhuma. Tudo é aditivo e atrás de chaves desligadas; o caminho legado permanece o default.

## Capabilities

### New Capabilities

- `product-1-1-flow-activation`: duas chaves administrativas auditáveis (lojas de teste / todas as lojas), roteamento server-side, precedência, rollback e preservação do legado.
- `product-1-1-intent-background-selection`: seleção explícita de Oferta/Destaque/Exclusivo e de Fundo de estúdio/Cenário ambientado/Manter cenário original, com a regra de exatamente uma imagem de produto para Original.
- `product-1-1-prompt-composition`: incorporação versionada e congelada dos prompts/regras Produto v4 + compositor v5 e das três intenções no runtime de produção do novo fluxo.
- `product-1-1-generation-orchestration`: geração real — snapshot no início, preflight de par+pricing fail-closed, execução da política de tentativas, telemetria por tentativa, resposta `IMG-001` com diagnóstico durável, saída 1024×1024 e histórico append-only.
- `product-1-1-campaign-credit-billing`: cobrança de um crédito por campanha entregue, reserva/confirmação/estorno idempotentes e não-débito de falha técnica sem arte utilizável.
- `product-1-1-copy-recovery`: copy não bloqueante, estado pendente/falha e ação autenticada de nova tentativa de copy sem regenerar a imagem e sem novo crédito.
- `product-1-1-artifact-delivery`: persistência da arte com dimensões reais e download direto sem aprovação, preservando as regras de download das campanhas antigas.

### Modified Capabilities

- `image-generation-config-snapshot`: o snapshot passa a ser **persistido numa campanha real** no início da operação e **reutilizado** por nova geração/correção da mesma campanha; histórico de tentativas append-only correlacionável, sem sobrescrever o run/trace histórico.
- `image-generation-failure-policy`: a política deixa de ser só componente e passa a ser **executada sobre geração real**, com enforcement transacional de não-cobrança de falha técnica.
- `image-generation-support-reference`: falhas reais passam a **produzir e persistir** o código público `IMG-001` + referência opaca e a correlacionar o diagnóstico no admin/suporte.
- `image-generation-model-pair-config`: a execução passa a **exigir preflight de cobertura de pricing `complete` para principal E fallback** antes de reservar crédito ou chamar provider.
- `image-generation-instrumentation`: cada tentativa real passa a **emitir envelope e custo** por par modelo–qualidade no caminho de produção.
- `feature-flag-control`: registro das duas novas chaves de ativação com **default fail-closed** (desligadas) e leitura server-side.

## Critérios de Aceite Verificáveis

1. Com as duas chaves desligadas (ou em falha de leitura), uma geração Produto continua idêntica ao fluxo legado; o caminho novo não é acionado.
2. Com a chave de lojas de teste ligada, apenas `is_test_store = true` usa o novo fluxo; com a chave geral ligada, todas as lojas elegíveis usam o novo fluxo; a precedência entre as duas é determinística e server-side.
3. O formulário permite escolher Oferta/Destaque/Exclusivo e Estúdio/Ambientado/Original; Original é rejeitado no servidor quando há zero ou mais de uma imagem de produto, ignorando a imagem de identidade.
4. A arte entregue é 1:1 com 1024×1024 persistidos; nenhum registro declara 1080×1080 para o arquivo.
5. O prompt enviado é composto pela versão versionada e congelada (Produto v4/compositor v5/intenção selecionada), com nome completo, fidelidade às referências, hierarquia protagonista/auxiliares, identidade fiel, textos obrigatórios uma única vez, matriz comercial por intenção e fundo escolhido; alterar a bancada em tempo de execução não muda o prompt.
6. Antes de reservar crédito ou chamar provider, a cobertura de pricing do principal **e** do fallback é `complete`; caso contrário a operação falha de forma identificável e **não** debita nem chama provider.
7. A execução respeita o teto: 2 tentativas no principal + 1 no fallback = 3 no máximo; `rate_limit` repete uma vez no principal; quota/faturamento não acionam fallback; cada tentativa registra modelo, qualidade, alvo, tentativa, run/trace, resultado e custo interno.
8. Uma campanha entregue (arte gerada, persistida e baixável) consome **exatamente um crédito**, mesmo com tentativas/fallback; falha técnica sem arte utilizável não debita; o reenvio idempotente não duplica reserva nem estorno.
9. Se só a copy falhar, a arte permanece baixável com o único débito, a copy fica pendente/falha e "Tentar gerar copy novamente" aparece somente nesse estado; a ação exige auth+ownership, tenta só os textos, não regenera imagem, não cobra outro crédito e é protegida contra repetição.
10. Toda falha do novo fluxo produz `IMG-001` + referência opaca sem vazar motivo interno; o suporte correlaciona a referência a um diagnóstico durável (categoria, par, tentativa, erro normalizado, run/trace).
11. O snapshot preserva fluxo, briefing, intenção, fundo, referências e par; nova geração/correção da mesma campanha reutiliza o snapshot original e **não** sobrescreve o histórico; o histórico de tentativas é append-only/correlacionável.
12. Campanhas antigas mantêm fluxo e regras de download; a flag e a regeneração da F37 não governam o novo fluxo; não há contador de correções nem aprovação/reprovação nesta fatia.
13. Nenhuma chamada paga é executada por testes/CI; nenhuma migration remota, `db push`, deploy ou abertura da chave geral ocorre nesta proposta.

## Fronteira com a F56.3 (não implementar agora)

A F56.3 poderá incluir a arte original e até quatro novas artes entregues após reprovação, sem outro crédito, com limite interno configurável no admin (sem contador visível) e bloqueio de download server-side de artes pendentes/reprovadas. Esta proposta **apenas preserva os dados e a arquitetura** necessários (snapshot, histórico append-only, correlação por tentativa) **sem antecipar UI ou fluxo de correção**, sem aprovador automático e sem reativar a regeneração da F37.

## Migração e Compatibilidade com o Fluxo Legado

- **Aditivo e atrás de chave.** O novo fluxo só é acionado pelas chaves de ativação; desligadas ou em falha, o comportamento é o legado.
- **Download legado preservado.** Campanhas antigas continuam sujeitas às regras anteriores (inclusive o gate de aprovação, quando aplicável); o novo fluxo não passa por esse gate.
- **Separação de cobrança e correção.** O novo fluxo usa o contrato de um crédito por campanha entregue; a regeneração da F37 não governa o novo fluxo.
- **Ordem de migração.** (1) criar/testar localmente em instância descartável comprovadamente isolada; (2) UAT visual e geração paga controlada em loja de teste **somente após autorização humana específica e pricing completo**; (3) aplicar migration no remoto; (4) deploy; (5) só então abrir a chave geral. Nenhuma etapa remota é autorizada por esta proposta.
- **Rollback.** Desligar as chaves restaura o legado sem tocar campanhas existentes; as estruturas novas são aditivas.

## Riscos

- **Ativar o fluxo errado por leitura de flag.** Mitigação: default fail-closed, roteamento server-side e testes de precedência/falha de leitura.
- **Reescrever o passado em correção futura.** Mitigação: snapshot imutável por campanha, reuso do original e histórico append-only (ressalva registrada na F56.1).
- **Debitar duas vezes ou cobrar falha técnica.** Mitigação: reserva/estorno idempotentes, entrega só com arte utilizável e testes transacionais.
- **Copy travar a entrega.** Mitigação: caminho de sucesso parcial com ação de nova tentativa de copy.
- **Qualidade de `sunburst/medium` é evidência limitada.** Mitigação: decisão humana, fallback definido e reavaliação em F56.3.
- **Regressão no legado por reuso de prompts/custo/crédito.** Mitigação: runtime próprio do novo fluxo e testes de não regressão.
- **Divergência de formato.** Mitigação: 1024×1024 real persistido, sem declarar 1080×1080.

## Decisões Técnicas Ainda Abertas

Somente detalhes de implementação; as decisões humanas acima **não** são reabertas.

- Mecanismo e precedência exata das duas chaves (linhas em `feature_flags` versus tabela dedicada), mantendo default fail-closed e auditoria.
- Onde residirá o runtime de composição de prompt do novo fluxo (extrair da bancada para módulo compartilhado versus novo módulo produtivo) sem alterar a bancada usada como referência.
- Forma de persistência do vínculo por tentativa (tabela de execuções/tentativas por campanha versus colunas append-only em telemetria), decidida para não sobrescrever o run/trace único.
- Modelagem do vínculo entre a reserva de crédito e o `operation_id`/tentativas para idempotência transacional de reserva e estorno.
- Recorte de planos: se o trabalho exceder 8–10 planos, a divisão proposta é **F56.2a** (ativação + intent/fundo + composição de prompt + orquestração mínima) e **F56.2b** (crédito transacional + copy recuperável + download + histórico/teless), a confirmar pelo responsável antes de planejar.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit ou deploy deve ocorrer antes da aprovação explícita do responsável, em especial das decisões técnicas abertas, do recorte de planos e da primeira geração paga controlada. Esta proposta **não** autoriza chamada paga, não altera produção e não abre a chave geral.

## Impact

- **Banco (migration [BLOCKING])**: chaves de ativação (e auditoria), vínculo/registro de tentativas append-only por campanha, eventuais colunas de dimensões reais da arte e do estado de copy pendente; adaptações aditivas sobre as estruturas F56.1. Nenhum `db push` remoto por esta proposta.
- **Código novo**: runtime produtivo de composição de prompt do novo fluxo, orquestrador de geração real que consome `createNewFlowImageGateway`/`resolveImageModelPairConfig`, preflight de pricing, persistência transacional de crédito/snapshot, rota de ação de nova tentativa de copy, roteamento server-side por chave.
- **Código alterado (aditivo)**: `src/app/api/campaign/generate-image/route.ts` (ramo roteado pelo novo fluxo), formulário de campanha e `use-campaign-form.ts` (intenção/fundo), serviço de crédito (idempotência por campanha), download (novo fluxo direto; legado intacto), `feature-flags`.
- **Design**: seguir `openspec/design-system/MASTER.md` (dark OLED `#020617`/`#F8FAFC`/`#22C55E`, Poppins/Open Sans, `lucide-react`, sem emojis, sem light mode). Nota: o contexto do design system declara saída 1080×1080; para o novo fluxo Produto 1:1 a saída é **1024×1024 com dimensões reais persistidas**.
- **Validação**: typecheck, lint, build, testes locais e `openspec validate --strict`; gates transacionais em instância Supabase descartável comprovadamente isolada; sem chamada paga e sem alteração de produção.
- **Referências de planejamento**: `docs/alinhamento-roadmap-pos-f48-1.md` §F56, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, a change arquivada da F56.1 e as políticas/evidências aprovadas da F48.2.6.
