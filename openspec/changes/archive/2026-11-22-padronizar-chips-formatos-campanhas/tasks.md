> **Gate:** não alterar código antes da revisão e aprovação desta proposta (Codex/usuário). A implementação só começa após o fluxo OpenSpec → GSD.

## 0. Revisão da proposta

- [x] 0.1 Revisar `proposal.md`, `design.md`, delta specs e este `tasks.md` com Codex/usuário, confirmando escopo, autoridades de dados e limites.
- [x] 0.2 Se houver mudança de escopo, atualizar os artefatos OpenSpec e revalidar com `openspec validate --strict` antes de qualquer código.

## 1. Modelo puro de apresentação

- [x] 1.1 Criar `src/lib/campaign/format-presentation.ts` com `CampaignFormatKey`, estados, entrada por formato, `flow` (`single_format`/`two_format`), `active`, `refunded`, `reason`, `partial` e `anyDelivered`.
- [x] 1.2 Implementar `buildJointFormatPresentation` mapeando `delivered`, `processing`, `absent`, `unknown` e `unavailable`, preservando `creditRefunded` sem reinterpretar o read model.
- [x] 1.3 Implementar `buildIndividualFormatPresentation` para formato persistido válido: entrega, processamento, estorno conhecido, `error`/`stale` como `unknown` e indeterminação; o outro formato recebe `absent/not_requested`.
- [x] 1.4 Implementar `buildUnknownFormatPresentation` e `buildUnavailableFormatPresentation`, garantindo que snapshot nulo/malformado/contrato desconhecido nunca ganhe fallback para `1:1`.
- [x] 1.5 Adicionar testes unitários da matriz conjunta (completa, parcial, estornada, unknown, unavailable) e dos builders individuais, incluindo que campanha individual pronta não é parcial.
- [x] 1.6 Adicionar testes de snapshot histórico sem chaves (`1:1`), snapshot nulo/malformado, contrato desconhecido, par incoerente, classificação conjunta antes do individual e `error`/`stale` como indeterminação sem ausência presumida.

## 2. Catálogo compartilhado de textos

- [x] 2.1 Criar `src/lib/i18n/campaign-formats/` com `messages.ts`, `catalogs/pt-BR.ts`, `catalogs/es-419.ts`, `get-messages.ts` e `index.ts`.
- [x] 2.2 Definir nomes (`Quadrado 1:1`, `Vertical 9:16`), rótulos de estado, explicações, rótulo do grupo, ação de informação e “Selecionado”, sem emojis.
- [x] 2.3 Adicionar o campo `formats` aos namespaces `campaign-list`, `dashboard` e `campaign-detail`, referenciando o mesmo objeto compartilhado por locale.
- [x] 2.4 Adicionar ao namespace do detalhe as notas localizadas de parâmetro inválido, entrega parcial, finalização pendente, estorno e processamento.
- [x] 2.5 Testar paridade de chaves `pt-BR`/`es-419`, identidade do catálogo nas três superfícies e ausência de `server-only` no módulo client-safe.
- [x] 2.6 Remover/evitar novos textos hardcoded de formato nas superfícies; manter conteúdo persistido fora do catálogo.

## 3. Componente compartilhado de chips

- [x] 3.1 Criar `src/components/campaign/campaign-format-chips.tsx` com os dois formatos sempre presentes, na ordem `1:1`, `9:16`.
- [x] 3.2 Implementar a semântica visual: disponível, ativo, ausente, estorno, processamento, unknown e unavailable; texto + ícone, nunca só cor.
- [x] 3.3 Implementar o controle de informação com `aria-expanded`, `aria-controls`, alvo de 44×44 px, hover/foco em desktop e toggle por toque.
- [x] 3.4 Implementar links somente quando houver `href` e estado `delivered`; formato não entregue permanece elemento informativo, sem ação.
- [x] 3.5 Aplicar layout responsivo (`flex-wrap`, `min-w-0`, quebra de texto) e tokens dark de `openspec/design-system/MASTER.md`, sem light mode, sem emojis e sem `+` para ausente.
- [x] 3.6 Testar estados, destaque ativo, estorno visível, ausência de “Não gerado”, links condicionais e ausência de geração/continue.
- [x] 3.7 Testar teclado, toque, foco visível, `aria-expanded` e ausência de botão desabilitado como única via de explicação.

## 4. Integração na listagem `/campanhas`

- [x] 4.1 Adicionar `formatPresentation` ao `CampaignListItem` e montar o modelo em `src/lib/campaign/list.ts` com classificação conjunta antes do individual.
- [x] 4.2 Reutilizar `summary.view` para estorno/estado conjunto e `resolveCampaignFormat` + `status` para individuais/legadas; `status = error` vira `unknown` (não ausência), e inconsistência não cai em `1:1`.
- [x] 4.3 Substituir a lógica de `jointLabels`/`formatLabel` em `src/app/(app)/campanhas/client.tsx` pelo componente compartilhado, mantendo “Abrir”, “Baixar”, miniatura e nome.
- [x] 4.4 Testar a matriz de campanhas na listagem: legado quadrado, individual `1:1`, vertical F59, vertical por expansão, conjunta completa e parcial, `error`/`stale` como `unknown` e individual pronta não parcial.
- [x] 4.5 Testar que chips não são links, não navegam e não iniciam geração; ações existentes e miniatura permanecem.
- [x] 4.6 Testar `pt-BR`/`es-419` e atualizar testes/catálogos existentes da listagem.

## 5. Integração no dashboard

- [x] 5.1 Adicionar `formatPresentation` ao `EligibleCampaignCard` e montar o modelo em `src/lib/dashboard/campaigns.ts` com classificação conjunta antes do individual.
- [x] 5.2 Atualizar `src/components/dashboard/available-campaign-card.tsx` para receber apresentação + mensagens e usar o componente compartilhado.
- [x] 5.3 Atualizar `src/components/dashboard/dashboard-campaigns.tsx` para mapear os chips e preservar `openHref`, contagem, miniatura e fallback.
- [x] 5.4 Testar que campanha conjunta/individual/legada mostra os dois chips em uma única linha, sem duplicação e sem navegação por chip; individual pronta não é parcial.
- [x] 5.5 Testar que “Abrir campanha” continua disponível, inclusive sem miniatura, e que os nomes/vocabulário são os mesmos da listagem/detalhe, admitindo menor evidência no dashboard.
- [x] 5.6 Atualizar testes existentes do dashboard e cobrir `es-419`.

## 6. Integração no detalhe `/campanhas/[id]`

- [x] 6.1 Adicionar `formatPresentation` e `formatHrefs` a `CampaignPageProps`/`mapCampaignToProps`, recebendo somente dados seguros.
- [x] 6.2 Montar a apresentação conjunta a partir da view já lida, com ativo = formato efetivamente exibido e hrefs somente para formatos entregues.
- [x] 6.3 Montar a apresentação individual com o mapeamento exato: new-flow `delivered`/`running`/`refunded`/`unknown`; legado `ready`/`generating`/`stale`/`error`; aprovação `pending` como disponível sem ativo e `regenerating` como processamento; `error`/`stale` como `unknown`, sem ausência presumida.
- [x] 6.4 Renderizar o componente abaixo do `PageHeader` nos dois caminhos do cliente (novo fluxo e legado) e remover os blocos duplicados de `ReadyView`/`NewFlowDeliveredView`.
- [x] 6.5 Consolidar as notas de estado conjunto em um único bloco localizado no nível da página, sem alterar copy, preview, download, polling, RPC ou recuperação existentes.
- [x] 6.6 Testar seleção conjunta, destaque ativo e preservação estrita de `?format=` inválido/vazio/duplicado/não entregue.
- [x] 6.7 Testar que formato não entregue não recebe link/preview/download e não dispara generate/continue/recuperação.
- [x] 6.8 Testar individual/legado: acesso atual preservado, outro formato “não incluído”, sem seleção inventada, `running`/`refunded`/`unknown`, `error`/`stale`, aprovação pendente e regeneração.
- [x] 6.9 Testar snapshot nulo/malformado, aprovação/regeneração e que os chips não introduzem ações, RPC ou recuperação novos.

## 7. Acessibilidade, localização e responsividade

- [x] 7.1 Testar navegação por teclado nos chips e controles de informação, com foco visível e ordem previsível.
- [x] 7.2 Testar toque em viewport estreito, alvo mínimo de 44×44 px e explicação sem depender de hover.
- [x] 7.3 Testar que estados são distinguíveis sem cor (texto/ícone) e que “Selecionado”/ativo tem semântica acessível.
- [x] 7.4 Testar `pt-BR`/`es-419` nas três superfícies e os atributos `lang` dos chips versus conteúdo persistido.
- [x] 7.5 Testar responsividade sem overflow e sem prejudicar nome do produto, miniatura ou ações do card. (Aceite visual/funcional declarado pelo responsável em 2026-11-22; sem capturas/medições/viewports fornecidas.)

## 8. Regressão, desempenho e limites

- [x] 8.1 Adicionar prova de zero chamadas adicionais causadas pelos chips, comparando a mesma página antes/depois para o mesmo conjunto de campanhas; não exigir contagem absoluta constante entre 1 e N e preservar a assinatura de miniaturas legadas e a leitura conjunta em lote.
- [x] 8.2 Executar a matriz completa: legado quadrado, individual `1:1`, vertical F59, vertical por expansão, conjunta completa/parcial; estados entregue, ausente, processamento, estornado, unknown/unavailable, `error` e `stale`.
- [x] 8.3 Confirmar que chips não entregues não chamam `generate`, `continue`, recuperação de copy/imagem, RPC financeira ou download.
- [x] 8.4 Confirmar que os chips não introduzem escrita, server action, RPC, reserva, recuperação ou chamada a provider novos; leituras/RPC/recuperação/polling já existentes permanecem intactos. A explicação altera somente estado local.
- [x] 8.5 Confirmar que o diff não altera migrations, RPCs, pricing, provider, flags, copy, miniatura (exceto apresentação), aprovação, recuperação ou dados persistidos.
- [x] 8.6 Confirmar que `input_snapshot`, `storage_path`, credenciais e paths internos não chegam ao componente compartilhado.
- [x] 8.7 Atualizar testes existentes que esperavam chips clicáveis na listagem ou rótulos crus `1:1`/`9:16` no detalhe.

## 9. Validação e revisão

- [x] 9.1 Rodar typecheck (`npx tsc --noEmit` ou script do projeto) e registrar o resultado real.
- [x] 9.2 Rodar lint dirigido e lint global, registrando avisos/erros reais.
- [x] 9.3 Rodar as suítes dirigidas de modelo, i18n, componente, listagem, dashboard e detalhe.
- [x] 9.4 Rodar o build de produção e registrar eventuais limites do ambiente local.
- [x] 9.5 Rodar a suíte global e comparar com a baseline conhecida, sem mascarar falhas preexistentes.
- [x] 9.6 Rodar diff-check e revisar `git status`/`git diff` para confirmar escopo e ausência de artefatos indevidos.
- [x] 9.7 Resumir resultados reais, limites explícitos e pendências; parar para revisão antes de sync, archive, merge, push ou deploy.
- [x] 9.8 Confirmar que nenhum acesso a banco, Storage, homolog ou produção foi necessário nesta change.

## 10. Refinamento visual compacto e ajuda flutuante (revisão 2026-11-21)

> A implementação anterior (fase 61, `61-01`/`61-02`/`61-03`) permanece como histórico técnico. A UX **não** foi aprovada visualmente; este bloco é aditivo e não altera modelo/estados/financeiro.

- [x] 10.1 Reduzir o texto visível dos chips a “Quadrado 1:1”/“Vertical 9:16”; remover “Disponível”, “Não incluído”, “Não entregue” e o badge “Selecionado” do texto visível, mantendo estado completo em `aria-label`/descrição acessível.
- [x] 10.2 Aplicar tratamento compacto: entregue com destaque discreto; ausente em cinza legível; ativo com borda/fundo distintos e sem badge; `processing`/`unknown`/`refunded` apenas com indicador pequeno, sem frase longa.
- [x] 10.3 Implementar ajuda flutuante fora do fluxo (portal), com posicionamento que respeite viewport/overflow, sem aumentar altura do card, quebrar linha, deslocar arte ou criar overflow horizontal.
- [x] 10.4 Remover o controle “?” separado; usar hover/foco no desktop e o próprio chip no toque: link entregue seleciona em um único toque; chip-botão não entregue/excepcional e lista/dashboard abre/fecha apenas a ajuda.
- [x] 10.5 Preservar alvo acionável ≥44×44 px no próprio chip; sem botão dentro de link, handlers duplicados, controles invisíveis ou detecção de toque por largura; “explicar” não navega nem alterna o formato.
- [x] 10.6 Preservar lista/dashboard informativos e detalhe com link de seleção; manter sem prefetch, `?format=` estrito, preview/download, polling, aprovação, recuperação, pt-BR/es-419 e espaçamento consistente entre chips e arte.
- [x] 10.7 Adicionar testes de componente para nomes compactos, estado acessível, ausência de “?”, hover/foco no chip, toque em link/botão, Escape, clique fora, foco devolvido, listeners e ausência de deslocamento/overflow.
- [x] 10.8 Rodar regressões das três superfícies, baseline em leitura sem recaptura, typecheck, lint, build e suíte global; registrar diff-check do range completo.
- [x] 10.9 Registrar evidência visual real desktop/mobile (duas opções legíveis, ajuda sem deslocamento, sem cortes/sobreposição das ações); jsdom não comprova layout. (Aceite visual/funcional declarado pelo responsável em 2026-11-22; sem capturas/medições/viewports fornecidas; não simulado.)
- [x] 10.10 Parar para revisão técnica e visual; não declarar a fase concluída nem a UX aprovada automaticamente.
