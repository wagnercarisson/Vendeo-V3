---
phase: 58-f58-composi-o-operacional-do-dashboard
plan: 05
subsystem: dashboard-validation
tags: [dashboard, validation, accessibility, localization, gates]
depends_on: ["58-04"]
---

# F58-05 — Gates, validação visual e separação de publicação

> **Atualização 2026-11-03:** ver `58-PUBLICATION-RECONCILIATION.md`. A verificação da fase foi concluída (`58-VERIFICATION.md`, 16/16). A publicação do código foi confirmada pelo responsável via deploy das quicks de miniaturas; um smoke F58-específico não foi registrado. O texto abaixo permanece como histórico da rodada.

## Resultado

- **Task 1:** concluída — gates automatizados, regressões, inspeção de escopo e medição de payload.
- **Task 2:** concluída com escopo limitado — composição visual pt-BR/es-419 aprovada pelo responsável; itens funcionais/visuais restantes registrados como PENDENTE/PARCIAL.
- **Task 3:** concluída — separação entre validação local, validação humana e publicação documentada.

## Cobertura OpenSpec

| REQ | Cobertura |
|---|---|
| REQ-58-01 | Campanhas `ready` na origem; erro/geração fora das consultas, linhas e contagens; `/campanhas` preservado |
| REQ-58-02 | Até três linhas com miniatura assinada, fallback e ação explícita “Abrir campanha” |
| REQ-58-03 | Créditos disponível/zero/indisponível, sem duplicação; `throwOnError` aditivo |
| REQ-58-04 | Anúncio compacto com fronteira de payload, dispensa e `/novidades` |
| REQ-58-05 | Saudação por `timeZone` canônico e `uiLocale`, com fallback neutro |
| REQ-58-06 | Namespace próprio pt-BR/es-419, paridade e isolamento do shell |
| REQ-58-07 | Avisos localizados por props opcionais, defaults pt-BR |
| REQ-58-08 | `lang` por bloco e separação interface/conteúdo |
| REQ-58-09 | Estados sem loja, sem campanhas elegíveis, loading, falha e parcial |
| REQ-58-10 | Responsividade e ordem DOM/teclado correta |
| REQ-58-11 | Shell, admin, navegação e identidade preservados |
| REQ-58-12 | Gates locais, validação humana e publicação separados |

## Evidências

- `evidence/58-05-automated-gates.md`
- `evidence/58-05-payload-measurement.md`
- `evidence/58-05-human-visual.md`
- `evidence/58-05-visual-captures.md`
- `evidence/58-05-visual-desktop.png`
- `evidence/58-05-visual-mobile.png`
- `evidence/58-05-visual-mobile-320.png`
- `evidence/58-05-visual-desktop-es.png`
- `evidence/58-05-visual-mobile-es.png`
- `58-05-PUBLISH-GATES.md`

## Gates resumidos

- 30 arquivos / **177 testes** focados PASS.
- Regressões de contratos e shell/admin/localização PASS.
- Typecheck exit 0; lint exit 0 com limitação de cobertura TS; build exit 0 (95/95).
- `/dashboard` 4,55 kB / 110 kB; shared 102 kB.
- OpenSpec strict valid; `git diff --check 77cc9413..HEAD` limpo.
- Tab real pt-BR/es-419: créditos → campanhas → novidades, sem `order`/`tabindex` positivo.

## Pendências e limitações

- UAT 14/14 observado como PASS, com ressalvas: leitor de tela real não executado, sem medição fina de performance e sem injeção específica de atraso de autenticação.
- Defeito encontrado e corrigido: fallback de miniatura pré-hidratação.\n- Falha de crédito, falha de fuso e readiness pendente foram observadas em harness de componentes, não como teste integrado completo do dashboard.
- Capturas são de homolog local; não comprovam produção.
- Este SUMMARY não declara produção aprovada nem autoriza publicação.

## Próximo passo — histórico, superado em 2026-11-03

A verificação da fase foi executada (`58-VERIFICATION.md`, `status: passed`, 16/16). A publicação do código e o aceite das superfícies de dashboard/listagem foram reconciliados no adendo `58-PUBLICATION-RECONCILIATION.md`; smoke F58-específico e demais limitações permanecem sem evidência. Este parágrafo registra o plano original, não o estado final.
