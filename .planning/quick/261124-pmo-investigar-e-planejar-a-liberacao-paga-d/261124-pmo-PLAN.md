---
quick_id: 261124-pmo
slug: investigar-e-planejar-a-liberacao-paga-d
title: Plano proposto — liberação paga do quadrado 1:1 após 9:16
status: planned-for-design-review
created: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
mode: planejamento-sem-implementacao
approval:
  status: pending-design-review
  note: Nenhuma task abaixo foi executada. O plano aguarda revisão do desenho e aceite humano.
---

# Plano proposto 261124-pmo

## Objetivo

Permitir que uma campanha entregue em **9:16** libere o **quadrado 1:1 já
armazenado** por **exatamente 1 crédito**, sem regenerar ou alterar o vertical,
sem alterar a copy e sem reutilizar a tabela F62 no sentido inverso.

Estado atual: **investigação concluída; implementação não iniciada.**

## Decisões que precisam de aceite antes da execução

1. **Vínculo:** Opção A (linha `1:1` isolada em `product_two_format_deliveries`
   + RPC nova) ou Opção B (tabela dedicada `campaign_square_releases`).
   Recomendação técnica: **Opção A**, por reutilizar constraints/FKs
   existentes e não criar tabela; exige guarda explícita de campanha `9:16`
   individual e documentação de que a projeção conjunta não é chamada.
2. **Confirmação:** token próprio da liberação reutilizando
   `FORMAT_ADDITION_CONFIRMATION_SECRET` com payload `kind` distinto, ou
   confirmação autenticada sem token adicional.
3. **Formato preferido:** manter `9:16` como preferido e liberar o quadrado via
   `?format=1:1`, sem reprojetar `campaigns.storage_path`.
4. **Escopo:** somente campanha nova `9:16` com `square_original` comprovado;
   legado sem esse artefato fica fora.
5. **Fence de entrega:** `beginPublication` → `markArtUploaded` → `deliver`
   (recomendado), sem upload, ou `confirm_existing_art` (caminho de recuperação).

## Task 1 — Contrato puro e apresentação

- Criar `src/lib/campaign/square-release/{types,eligibility,index}.ts`:
  - estados `eligible | processing | delivered | refunded | unknown |
    unavailable | incompatible`;
  - entrada segura: formato persistido `9:16`, ciclo de vida do vertical,
    existência/validade da arte quadrada, vínculo de liberação e estado do
    crédito;
  - `eligible` só com vertical `delivered`, quadrado `integral`, sem liberação
    ativa e sem vínculo `9:16` na mesma campanha;
  - nenhum `input_snapshot`, path, URL ou bytes no contrato de UI.
- Estender `buildIndividualFormatPresentation` com um input simétrico de
  liberação do `1:1` (sem reutilizar a semântica da tabela F62):
  - `delivered` → quadrado entregue, selecionável;
  - `processing` → acompanhamento;
  - `refunded` → ausente com crédito devolvido;
  - `unknown`/`unavailable` → sem promessa de entrega.
- Reutilizar `actionStateLabel`/`actionHelpText` do chip para a ação
  “Liberar quadrado 1:1” e ajuda “Custo: 1 crédito”, sem nova linguagem de
  geração.

## Task 2 — Migration (autorada, NÃO aplicada)

- Nova migration `YYYYMMDDHHmmss_campaign_square_release.sql` com timestamp real
  UTC e unicidade conferida na worktree, `main` e branches paralelas.
- RPC `campaign_square_release_open(S, C, V, R)`:
  1. lock da campanha (`FOR UPDATE`) e validação de loja;
  2. validação do contrato `9:16` (`campaignFormat` +
     `formatContractVersion`);
  3. validação de `V` em `product_9_16_two_stage_operations` e crédito `V`
     `delivered`;
  4. rejeição se existir vínculo `9:16` para a campanha;
  5. replay: se já existe vínculo `1:1` para `(C,V)`, devolver `R` e estado do
     crédito sem cobrar; divergência de `R` → conflito;
  6. `product_1_1_reserve_credit_operation(S,C,R,1,metadata)` — exatamente 1;
  7. INSERT em `product_two_format_deliveries` com
     `format='1:1'`, `artifact_role='square_original'`,
     `delivery_operation_id=R`, `operation_id=V`;
  8. retorno fechado com `success`, `idempotent`, `state`, `releaseOperationId`.
- Redefinir `product_1_1_get_campaign_operation_by_campaign` para excluir
  operações que aparecem como `delivery_operation_id` de vínculo `1:1`
  (a operação de liberação não pode virar a operação primária).
- Grants: `REVOKE` público/anon/authenticated; `GRANT EXECUTE` apenas
  `service_role`; sem INSERT direto na tabela de vínculo.
- Nenhuma alteração em `campaign_format_additions`, artefatos, copy, vertical,
  `campaigns.storage_path` ou `input_snapshot`.
- Testes de contrato da migration: constraints, direção única, FK, unique,
  ausência de grant de escrita direta, exclusão da operação primária.

## Task 3 — Orquestração server-side

- Criar `src/lib/campaign/square-release/`:
  - leitor canônico do vínculo `1:1` + crédito `R` + estado do vertical;
  - cliente financeiro fino para a RPC de abertura e autoridades existentes;
  - verificação da arte `square_original` via
    `retrieveCompositionArtifact` (sem cópia);
  - abertura idempotente, entrega com fence e estorno conforme estado;
  - token de confirmação conforme decisão aprovada.
- Regras:
  - verificar a arte **antes** de reservar; se ausente/inválida/indeterminada,
    não reservar;
  - reserva exata de 1 crédito; nenhuma segunda cobrança em replay;
  - falha antes da publicação → estorno único; `unknown`/fence → não estornar
    cegamente;
  - `delivered` terminal.
- Não importar nem alterar o fluxo vertical/F62; somente leitura das
  autoridades e do artefato.

## Task 4 — API

- Nova rota `src/app/api/campaign/[id]/square-release/route.ts`:
  - **GET** read-only: `eligible`, `processing`, `delivered`, `refunded`,
    `unknown`, `unavailable`, `incompatible`; nunca reserva, gera ou cobra;
  - **POST** autenticado + CSRF/ownership + confirmação: abre/retoma a
    liberação, entrega o crédito e devolve o estado;
  - replay idempotente; erros fechados (`insufficient_credits`, conflito,
    arte indisponível, estado inválido);
  - nenhuma resposta devolve path, URL assinada, token financeiro ou bytes.
- Não reutilizar `/format-additions` para o sentido inverso.

## Task 5 — Download e detalhe

- Rota de download: novo ramo estrito para campanha `9:16` +
  `?format=1:1`:
  - exige vínculo `1:1` com crédito `delivered`;
  - exige `square_original` integral;
  - serve os bytes existentes do bucket interno;
  - não altera `campaigns.storage_path`, copy, vertical ou projeção;
  - `?format=9:16` e ausência de `?format` permanecem inalterados;
  - inválido/duplicado/não liberado falha fechado, sem fallback.
- Detalhe `/campanhas/[id]`:
  - ler o estado da liberação somente para campanha `9:16`;
  - chip do quadrado: ação “Liberar quadrado 1:1” quando elegível; custo 1
    crédito; acompanhamento em processing; link `?format=1:1` quando
    delivered; textos honestos em refunded/unknown/unavailable;
  - modal própria (ou extensão mínima e isolada) com o mesmo contrato de
    estados aprovado na F62: consulta ≠ confirmação ≠ processamento;
  - Cancelar/Escape/clique fora permitidos antes da confirmação; bloqueados
    durante operação real;
  - nenhuma ação na lista/dashboard.
- Copy e vertical não são tocados; `9:16` continua sendo o formato preferido.

## Task 6 — Testes e gates

Testes mínimos:

- puros: estados de elegibilidade, apresentação simétrica, ausência de
  fallback, refunded/unknown;
- migration: constraints/FKs/unique, direção F62 rejeitada, exclusão da
  operação primária;
- orquestração: vertical não entregue ⇒ sem reserva; quadrado ausente/inválido
  ⇒ sem reserva; sucesso ⇒ 1 crédito `delivered`; replay ⇒ sem segunda
  cobrança; falha antes da publicação ⇒ 1 estorno; `unknown` ⇒ sem estorno;
  concorrência ⇒ 1 vínculo/1 cobrança; legado/9:16 sem quadrado ⇒
  incompatível;
- download: `1:1` liberado serve o quadrado; não liberado falha; `9:16`
  preservado; sem fallback;
- UI: ação/custo/confirmação, consulta inicial sem geração, processing
  bloqueado, delivered vira link, refunded/unknown, pt-BR/es-419;
- regressões F62, 1:1, conjunto, vertical e download.

Gates:

- testes afetados;
- typecheck;
- lint;
- `git diff --check`;
- build somente se necessário e com a `.next` livre (parar apenas a instância
  identificada, se houver);
- nenhuma chamada paga, migration aplicada, banco/Storage alterado.

## Evidência / validação visual

- GET atrasado de forma controlada para comprovar consulta ≠ confirmação ≠
  processamento, sem confirmar cobrança real.
- Preferir a modal/jornada real autenticada; se indisponível, harness
  complementar explícito, sem página/rota temporária no app.

## Limites

- Sem implementação antes da revisão deste desenho.
- Sem alteração de vertical, copy, F62, contabilidade existente, provider,
  banco, Storage, flags, segredos ou configuração.
- Sem merge, push ou deploy.
- A migration, quando autorizada, será autorada e **não aplicada** sem
  autorização específica do ambiente.

## Review Stop

Parar aqui. Entregar a investigação, a demonstração de cobrança/vínculo, as
opções estruturais e este plano. Aguardar decisão humana sobre vínculo, token,
formato preferido, escopo legado e fence antes de qualquer implementação.
