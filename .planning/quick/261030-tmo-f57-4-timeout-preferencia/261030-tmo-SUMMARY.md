---
status: complete
phase: quick
plan: 261030-tmo
initiative: F57.4
date: 2026-10-30
branch: feature/fase57-4-base-traducao-interface-configuracoes
execution: local_complete
publication: executed_by_responsible
production_acceptance: confirmed
production_logs: checked_window_no_timeout_match
homolog: not_repeated
---

# Quick 261030-tmo — correção do timeout de preferência

## Escopo executado

Correção local do `preferences_read_timeout` observado em produção na F57.4. Sem homolog,
publicação, migration, API/schema ou dependências.

## Entregue

- `UI_LOCALE_READ_TIMEOUT_MS`: **200 → 1000 ms** em `src/lib/i18n/server.ts`.
- Comentário atualizado: 1000 ms é margem a validar em produção, não garantia contra falha de
  infraestrutura.
- Teste existente ajustado para 1000 ms e novo teste de resolução em 250 ms (acima do limite
  antigo, abaixo do novo).
- Timer limpo, rejeição tardia isolada, fallback `pt-BR` e ausência de troca tardia preservados.
- Timeout único: layout e `/configuracoes` continuam usando a mesma leitura cacheada; sem segunda
  consulta.
- OpenSpec ativo atualizado: specs `ui-localization`/`user-locale-preference`, `design.md` e
  `tasks.md` (2.1/6.4).
- Incidente de produção registrado em
  `evidence/57.4-production-timeout-incident.md`.
- Merge de `origin/main` (`d56354e5`) integrado antes da implementação; merge local `92e5d78b`.

## Gates

| Gate | Resultado |
|---|---|
| Testes focados (server/catálogos/layout/configuração) | **21/21** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (não cobre TS) |
| `npm run build` | exit 0, 95/95 páginas |
| `openspec validate --strict` | valid |
| `git diff --check` | limpo |

## Publicação e aceite em produção

- Correção publicada pelo responsável em `main`; deployment de produção
  `dpl_7rhQggN3sc5NGbLWnJrwivStyRos` (`86aac0e9`), status **READY**, alias `vendeo.tech`.
- Aceite funcional da correção em produção **confirmado pelo responsável**.
- Janela de smoke consultada em modo somente leitura: 50 entradas recentes; 3 requisições
  `/configuracoes` e 2 `/dashboard`, todas **200**; **nenhuma** correspondência de
  `preferences_read_timeout`/`outcome=timeout` nos logs disponíveis.
- Ressalva: o endpoint de logs consultado não expôs os `console` logs dessas requisições
  (`logs: []`); a ausência de correspondência não é prova de ausência de timeout. A contagem
  deve continuar sendo observada por janela.

## Pendente

- Nenhuma implementação/migration pendente.
- Limitação de leitor de tela permanece aceita (não é PASS de acessibilidade integral).
- Rollback continua documentado abaixo; não executado.

## Rollback

Reverter o commit e publicar o build anterior. Preferências persistidas permanecem; não há
migration reversa.
