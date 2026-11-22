# Phase 61 — `61-04` Evidência visual (PENDENTE)

**Status:** ⏳ **PENDENTE — AGUARDANDO INSPEÇÃO HUMANA REAL**
**Plano:** `61-04-PLAN.md` (refinamento visual compacto + ajuda flutuante)
**Data de criação:** 2026-11-21
**Branch:** `feat/campaign-format-chips`

> Este arquivo registra SOMENTE o roteiro e os critérios de inspeção visual.
> Nenhuma aprovação visual foi simulada. `jsdom` não comprova layout; a
> confirmação abaixo é humana e posterior à revisão técnica.

## Escopo da inspeção

Trigêmeo de superfícies, com campanhas em estados variados (entregue, ausente,
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

### Chips compactos
- [ ] Cada campanha mostra exatamente dois chips, nesta ordem: **Quadrado 1:1** e **Vertical 9:16**.
- [ ] O texto visível de cada chip é apenas o nome do formato.
- [ ] **Não** aparece “Disponível”, “Não incluído”, “Não entregue”, “Crédito devolvido” nem badge “Selecionado” como texto visível no chip.
- [ ] Entregue tem destaque discreto; ausente fica em cinza legível.
- [ ] Ativo (detalhe) tem borda/fundo distintos, sem badge.
- [ ] `processing`/`unknown`/`refunded` usam apenas indicador pequeno, sem frase longa no chip.
- [ ] Estados são distinguíveis sem depender exclusivamente de cor (borda/fundo/indicador).

### Ajuda flutuante
- [ ] Hover (desktop) e foco de teclado abrem a ajuda.
- [ ] O “?” abre a ajuda no toque e continua com alvo ≥44×44.
- [ ] Primeiro acionamento após hover/foco **fixa** a ajuda (não fecha).
- [ ] Segundo acionamento, clique/toque fora e `Escape` fecham.
- [ ] Mover o ponteiro do chip para o popover mantém a ajuda aberta.
- [ ] Clicar dentro do popover não fecha.
- [ ] Ajuda aparece acima/abaixo conforme o espaço, sem ser cortada pela viewport nem por containers com `overflow`.
- [ ] Abrir a ajuda **não** altera a altura do card, a linha dos chips, a posição da arte nem a largura do contêiner.
- [ ] Nenhum overflow horizontal é criado em 320 px.
- [ ] Ajuda localizada em `es-419` mantém o idioma no popover (portal fora do wrapper).

### Superfícies e preservação
- [ ] Lista/dashboard continuam informativos; chips não navegam nem iniciam geração.
- [ ] Detalhe preserva o link de seleção sem prefetch, `?format=` estrito, preview/download, polling, aprovação e recuperação.
- [ ] Miniatura, nome do produto, contagem e ações permanecem legíveis e acionáveis.
- [ ] Espaçamento entre o bloco de chips e a arte no detalhe é consistente.
- [ ] Nome do produto/conteúdo persistido segue `lang=""`; região traduzida dos chips segue o idioma da página.

## Evidência

- Capturas de tela: **AUSENTES** (inspeção humana pendente).
- Resultado: **NÃO APROVADO / NÃO REPROVADO** — aguardando revisão.

## Limite

Aprovação visual de lista/dashboard/detalhe em desktop e celular é HUMANA e
posterior. Este documento não declara a fase 61 concluída nem a UX aprovada.
