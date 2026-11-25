# Deferred items — quick 261125-i08

Itens deliberadamente não tratados nesta quick. Nenhum foi planejado nem
iniciado.

## 1. Fluxo conjunto 1:1+9:16

- **Contexto:** esta quick ativa as instruções institucionais existentes somente
  no 1:1 isolado e no 9:16 isolado. O item 1 de `deferred-items.md` da quick
  261125-i07 foi atendido **apenas para o 9:16 isolado**.
- **Escopo futuro separado:** o fluxo conjunto 1:1+9:16 continua usando o texto
  reconciliado anterior para `text_only`, `logo` e `visual_signature`. Qualquer
  uniformização exige planejamento e autorização próprios, incluindo decisão
  sobre opt-in, congelamento, hash e campanhas existentes.
- **Estado:** **não planejado e não implementado** nesta quick.

## 2. Orientação comum de contraste no 9:16 `text_only`

- **Contexto:** a orientação comum de contraste continua citando logo/assinatura
  no 9:16 `text_only` em fundos recriados, mesmo com a identificação institucional
  em texto. A divergência foi conscientemente aceita no escopo aprovado.
- **Estado:** não alterada. Corrigir exigiria mudar a redação comum de contraste
  ou `commercialIdentityLine`, fora desta quick.

## 3. `legacy-frontier.guard` — falha preexistente

- **Teste:** `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts`.
- **Origem:** alteração de `src/lib/lab/bench/domain/form-rules.ts` no commit
  `65d00e75` (quick 261125-eo7), anterior a esta quick; a allowlist
  `AUTHORIZED_FRONTIER_CHANGES` não foi atualizada naquela entrega.
- **Estado nesta quick:** não executado no conjunto focado e **não corrigido**
  por estar fora do escopo. Permanece registrado nas quicks 261125-i05/i07.

## 4. Validação visual

- **Estado:** pendente. Cabe ao usuário gerar manualmente o 9:16 e avaliar a
  identificação institucional na base e no resultado vertical. Testes de
  montagem/transporte não comprovam aderência visual da IA.
