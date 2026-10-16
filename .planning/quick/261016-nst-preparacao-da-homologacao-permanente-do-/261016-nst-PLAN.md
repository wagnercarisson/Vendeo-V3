---
id: 261016-nst
type: quick
status: in_progress
date: 2026-10-16
---

# Preparação da homologação permanente do Vendeo no Docker — rodada 1 (levantamento)

GSD iniciado por `gsd-sdk query init.quick`. Execução inline, sem delegação.

Objetivo: preparar a homologação **permanente** do Vendeo em Docker a partir da
estrutura ATUAL do Supabase remoto `Vendeo-V3` (`gvbzwihwgzujwsviufgy`), trazendo
dados **somente** das lojas de teste e as configurações globais necessárias.

## Escopo desta rodada (SOMENTE levantamento)

1. Listar lojas `is_test_store=true` sem expor dados sensíveis.
2. Mapear dependências dos dados dessas lojas: usuários, identidade visual,
   campanhas, créditos e arquivos.
3. Conferir exportadores/importadores existentes antes de reutilizá-los.
4. Dimensionar banco, Storage e espaço local.
5. Apresentar origem, destino permanente, conteúdo da cópia e comandos previstos,
   com proteção contra escrita no remoto.

## Proibições desta rodada

Sem exportação/restauração; sem aplicar migrations pendentes; sem alterar flags;
sem chamadas pagas; sem modificar produção; sem limpar Docker; sem criar base
descartável por fatia; sem escrita no remoto; sem commit/push.

Dumps, credenciais e dados exportados permanecem fora do Git. O destino é a
homologação **permanente** com volumes preservados.

## Saída

`261016-nst-SUMMARY.md` com o levantamento e a **parada para revisão** antes da
exportação/restauração. Sem alteração de runtime, banco, migrations ou flags.
