# Summary 31-3-06: UAT Real — 5 Cenários E2E

**Objective:** Estrutura de UAT com 5 cenários E2E para validação do revisor intent-aware com IA real (OpenAI).

## Changes

### `.planning/phases/31-3-quality-gate-por-intencao-comercial/uat-evidence.md` (novo)
- Template consolidado com tabela de 5 cenários
- Micro-runbook com pré-requisitos e passo-a-passo
- Input JSON e critérios de aceite por cenário:
  - A: offer (regressão) — badge obrigatório, preço DE/POR
  - B: spotlight + badge "Novidade" — preço único, sem urgência
  - C: spotlight sem badge — sem falso positivo por badge ausente
  - D: exclusive sem badge, preserve=true — sem wrong_price, fundo contextual
  - E: exclusive + badge "Exclusivo", preserve=true — badge sutil, tom premium

## Status
⚠ **Execução pendente** — requer OpenAI API key ativa e execução manual da aplicação.
