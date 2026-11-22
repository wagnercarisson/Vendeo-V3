# Phase 61 — `61-05` Evidência visual (ACEITA POR DECLARAÇÃO)

**Status:** ✅ **ACEITE VISUAL/FUNCIONAL DECLARADO PELO RESPONSÁVEL EM 2026-11-22** — sem capturas, medições ou viewports fornecidos; nenhuma aprovação simulada.
**Plano:** `61-05-PLAN.md` (remoção do “?” e chip como único controle)
**Data de criação:** 2026-11-22
**Branch:** `feat/campaign-format-chips`

> Este arquivo registra o roteiro e o aceite declarado. O responsável informou o
> aceite visual/funcional da fatia em 2026-11-22. Não foram fornecidas capturas,
> medições ou lista de viewports testadas; os itens individuais abaixo permanecem
> como critérios de conferência, não como medições inventadas.
> Nenhuma aprovação visual foi simulada. `jsdom` não comprova layout; a
> confirmação abaixo é humana e posterior à revisão técnica. O `61-04` segue
> **NÃO ACEITO** e este plano não o aceita retroativamente.

## Escopo da inspeção

Três superfícies, com campanhas em estados variados (entregue, ausente,
processando, estornado, indeterminado/indisponível):

- **/campanhas** (lista, chips informativos, sem `href` por formato)
- **Dashboard → campanhas recentes** (linha informativa)
- **/campanhas/[id]** (detalhe; chips no nível da página + seleção `?format=`)

## Viewports obrigatórias

| Viewport | Largura × altura |
|---|---|
| Desktop | 1440 × 900 |
| Mobile | 390 × 844 |
| Estreita | 320 px de largura |

## Checklist (marcar após inspeção humana real)

### Sem “?” separado (chip é o único controle)
- [ ] Não existe “?” visível, espaço reservado, borda, foco independente nem área acionável órfã ao lado do chip.
- [ ] Cada campanha mostra exatamente dois chips, nesta ordem: **Quadrado 1:1** e **Vertical 9:16**.
- [ ] O texto visível de cada chip é apenas o nome do formato.
- [ ] **Não** aparece “Disponível”, “Não incluído”, “Não entregue”, “Crédito devolvido” nem badge “Selecionado” como texto visível no chip.

### Semântica por superfície
- [ ] Em **lista/dashboard**, tocar/clicar no chip abre apenas a ajuda; nada navega nem inicia geração.
- [ ] No **detalhe**, tocar em chip entregue com `href` seleciona o formato no **primeiro** toque e não abre a ajuda.
- [ ] No **detalhe**, tocar em chip ausente/processando/indeterminado abre/fecha somente a explicação.
- [ ] Não há botão dentro de link, link dentro de botão nem controle invisível.

### Semântica visual (não apenas cor)
- [ ] Entregue tem **borda mais espessa/preenchimento**; ausente tem borda simples/cinza.
- [ ] Ativo (detalhe) tem anel/fundo distintos, sem badge.
- [ ] `processing`/`unknown`/`refunded` usam apenas indicador pequeno, sem frase longa no chip.
- [ ] Estados são distinguíveis por forma/preenchimento/indicador além da matiz.

### Ajuda flutuante
- [ ] Hover (desktop) e foco de teclado abrem a ajuda ancorada no próprio chip.
- [ ] A ajuda não cobre o próprio chip nem dificulta o clique no link de seleção.
- [ ] Primeiro clique após hover/foco no chip-botão **fixa** a ajuda (não fecha).
- [ ] Segundo acionamento, clique/toque fora e `Escape` fecham; `Escape` devolve o foco ao chip de origem sem reabrir.
- [ ] Mover o ponteiro do chip para o popover mantém a ajuda aberta; clicar dentro do popover não fecha.
- [ ] Ajuda aparece acima/abaixo conforme o espaço, sem ser cortada pela viewport nem por containers com `overflow`.
- [ ] Abrir a ajuda **não** altera a altura do card, a linha dos chips, a posição da arte nem a largura do contêiner.
- [ ] Nenhum overflow horizontal é criado em 320 px.
- [ ] Ajuda localizada em `es-419` mantém o idioma no popover (portal fora do wrapper).

### Superfícies e preservação
- [ ] Detalhe preserva o link de seleção sem prefetch, `?format=` estrito, preview/download, polling, aprovação e recuperação.
- [ ] Miniatura, nome do produto, contagem e ações permanecem legíveis e acionáveis.
- [ ] Espaçamento entre o bloco de chips e a arte no detalhe é consistente (`mb-6`).
- [ ] Nome do produto/conteúdo persistido segue `lang=""`; região traduzida dos chips segue o idioma da página.

## Evidência

- Capturas de tela: **NÃO FORNECIDAS**.
- Medições/viewports: **NÃO FORNECIDOS** pelo responsável.
- Resultado: **ACEITE VISUAL/FUNCIONAL DECLARADO EM 2026-11-22**; os critérios acima não foram convertidos em medições inventadas.

## Limite

O aceite é uma declaração do responsável, não uma captura/medição reproduzida
pelo executor. Este documento não declara a fase publicada ou implantada; o
arquivamento documental ocorreu em 2026-11-22 sem publicação. Nenhuma aprovação
foi simulada por `jsdom`.
