---
quick_id: 261126-nwg
date: 2026-11-26
type: documentation
status: complete
---

# Complementar a linha guia do onboarding

## Entrada GSD

`/gsd-quick Complementar alinhamento onboarding CPF navegacao e ofertas versionadas`

Inicialização executada com `gsd-tools.cjs init quick`. Execução documental pelo agente principal, sem delegação; branching configurado como `none`.

## Escopo

Atualizar o artefato existente com as decisões recém-aprovadas: qualquer troca de CPF exige confirmação/aceite; navegação salva e respeita dependências; oferta inicial de 28 dias/20 créditos parametrizada e versionada, preservada em cada concessão; base dividida em 2A/2B. Preservar a transição dos usuários existentes por último e as demais decisões anteriores.

## Tarefas e verificação

1. Atualizar `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md`, reconciliando também pendências, dependências e limites. Verificar ausência da antiga distinção entre correção e troca de CPF e dos parâmetros comerciais ainda indevidamente abertos.
2. Conferir links, sequência das fatias, parâmetros iniciais e whitespace. Registrar SUMMARY e referência em STATE, sem alterar ROADMAP, código, banco ou OpenSpec.

## Fechamento

Documento coerente com o aceite do usuário, nove fatias principais com subfatias 2A/2B, campos ainda não aprovados mantidos como pendências e nenhuma implementação/ativação implícita.
