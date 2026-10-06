## Context

Esta change é a **F56.2b2**, última fatia da F56.2. **Depende da F56.2b1** (núcleo ponta a ponta) e, transitivamente, da F56.2a. A F56.2b1 (proposta, 0 tasks) define a copy **não bloqueante** com o estado de falha persistido, mas **sem** ação de nova tentativa. A F56.2b2 adiciona a ação, conclui testes integrados/E2E e faz o piloto controlado.

Estado relevante: a F56.2b1 define a máquina de estados durável de crédito (`reserved → art_uploaded → delivered | refunded`), artefato 1024×1024 e download condicionado a `delivered`. A copy já é desacoplada da entrega; falta a recuperação de copy pós-falha.

## Goals / Non-Goals

**Goals:**

- Ação "Tentar gerar copy novamente" condicional, segura e sem novo crédito.
- Testes integrados/E2E do fluxo completo.
- Piloto controlado com autorização humana e pricing completo; então avaliar habilitar lojas de teste.

**Non-Goals:**

- Alterar o core da b1 ou o fluxo legado.
- Aprovação/reprovação/correção (F56.3).
- Chamada paga, `db push`, deploy ou abertura geral por esta proposta.

## Decisions

### B2-D1 — Ação condicional ao estado pendente/falha

A ação SHALL ser exposta **somente** quando a copy estiver pendente/falha (estado persistido pela F56.2b1).

### B2-D2 — Autenticação e ownership

A ação SHALL exigir autenticação e verificação de ownership da campanha/loja; sem ownership, SHALL ser negada sem qualquer chamada de IA.

### B2-D3 — Somente textos, sem regenerar imagem e sem novo crédito

A ação SHALL tentar **apenas** os textos (`campaign_copy`), SHALL NOT alterar/regerar a imagem e SHALL NOT consumir crédito adicional; o débito da campanha permanece o mesmo.

### B2-D4 — Anti-repetição e custo interno

A ação SHALL ser protegida contra cliques duplicados e repetição abusiva (chave de idempotência/estado por operação de copy) e SHALL registrar o **custo interno** da chamada, sem convertê-lo em crédito do lojista.

### B2-D5 — Testes integrados/E2E

O fluxo completo (core da F56.2b1 + ação de copy) SHALL ser coberto por testes integrados/E2E locais, sem chamada paga por CI, incluindo sucesso da nova tentativa, falha persistente, ausência de ownership e clique duplicado.

### B2-D6 — Piloto controlado e gate de lojas de teste

O piloto SHALL rodar **no ambiente isolado autorizado** (execução no Supabase descartável autorizado, **antes** de migration remota/deploy), em **loja de teste** (`is_test_store=true`), usando a **autorização temporária de piloto** definida na F56.2b1 (escopo restrito ao ambiente isolado e à geração paga aprovada), com **autorização humana específica** e **pricing completo**. A **habilitação de lojas de teste** para uso real só SHALL ser avaliada **após** a validação do piloto, com a autorização posterior de escopo de lojas de teste. Migration remota, deploy e abertura geral permanecem decisões posteriores e autorizadas separadamente.

### B2-D7 — F56.3 separada

Aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas permanecem na F56.3.

## Risks / Trade-offs

- **[Repetição abusiva / custo oculto]** → idempotência por operação de copy + registro do custo interno.
- **[Ação usada para burlar cobrança]** → somente textos, sem novo crédito, sem regenerar imagem.
- **[Piloto fora de controle]** → loja de teste + autorização humana + pricing completo; sem abertura geral automática.
- **[Regressão no core]** → testes integrados/E2E e não alteração do contrato da b1.

## Migration Plan

1. Implementar a ação e sua proteção; typecheck/lint/build/testes locais.
2. Testes integrados/E2E locais sem provider pago.
3. Autorização humana → piloto controlado em loja de teste com pricing completo.
4. Avaliar habilitar lojas de teste; migration remota/deploy em etapa posterior autorizada.

## Open Questions

- Nenhuma bloqueante. (Não bloqueante: forma do contador/limite de repetição da ação.)
