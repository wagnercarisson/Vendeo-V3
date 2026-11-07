# F59 — Escopo separado: proteção contra perda de dados no formulário

Status: **fora da F59; não implementado**. Melhoria transversal aos formatos 1:1 e
9:16. Nenhum código foi alterado nesta fase.

## 1. Escopo

- Preservação automática do rascunho local após reload.
- Distinção entre reload da mesma edição e início intencional de outra campanha.
- Botão “Limpar dados” como intenção futura (não existe hoje; não implementar na F59).
- Pausa visual de draft local 9:16 com flag OFF.

## 2. Evidência atual (não é bloqueador da F59)

- O draft de campanha nova usa `sessionStorage` global (`campaign_draft` /
  `campaign_draft_image`).
- `CampaignPageClient` remove essas chaves no mount, antes da restauração.
- `campaignFormatPaused` é derivado no servidor apenas de `restoredForm`; draft local
  não tem pausa visual com flag OFF.
- O reload real não foi executado para não destruir o draft do responsável.

## 3. Proposta preservada para trabalho futuro

O desenho de correção está em `59-10-TASK-514-CORRECTION-PROPOSAL.md`:
marcador `sessionStorage` de intenção de nova campanha, distinção reload/navegação,
pausa cliente complementar e testes. **Não implementar nesta fase.**

## 4. Relação com a F59

A F59 aceita os cenários de formato/restauração já comprovados:
`restoreFrom` com flag OFF, revisão → edição e retorno após erro. A ausência de
persistência automática no reload **não** é tratada como comportamento implementado
nem como bloqueador do formato vertical; é uma melhoria transversal separada.
