---
status: in-progress
date: 2026-10-22
slug: f50-3-tracking-residues
---

# Quick Task: corrigir resíduos de tracking do encerramento da F50.3

## Objetivo

Corrigir somente resíduos documentais do encerramento da F50.3, sem tocar código, specs, archive ou ambientes.

## Tarefas

1. STATE.md: `next_scope: "none"` e marcar o planejamento anterior da F50.3 como histórico superado.
2. REQUIREMENTS.md: título da seção F50.3 → "Encerrada com limitações aceitas; não publicada".
3. ROADMAP.md: remover da seção F56.2.7 os parágrafos de gap closure/follow-ups da F50.3 e restaurar a contagem original de planos.
4. Preservar registro da F50.3, 4 tasks abertas, limitações, follow-ups e contadores escopados.
5. Conferir diff, rodar `git diff --check` e criar commit documental.

## Restrições

- Não alterar código, specs, archive ou ambientes.
- Não fazer push.