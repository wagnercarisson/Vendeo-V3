# Deferred items — quick 261125-i09

Itens deliberadamente não tratados nesta quick. Nenhum foi planejado nem
iniciado.

## 1. Aceite visual

- **Estado:** pendente. Cabe ao usuário gerar manualmente uma campanha conjunta
  e avaliar a identificação institucional nos resultados 1:1 e 9:16.
- Testes de montagem e transporte não comprovam aderência visual da IA.

## 2. Orientação comum de contraste

- **Contexto:** a orientação comum de contraste continua citando logo/assinatura
  no `text_only` em fundos recriados. A divergência foi conscientemente aceita
  nas quicks anteriores.
- **Estado:** não alterada. Fora do escopo desta quick.

## 3. `legacy-frontier.guard` — falha preexistente

- **Teste:** `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts`.
- **Origem:** alteração de `src/lib/lab/bench/domain/form-rules.ts` no commit
  `65d00e75` (quick 261125-eo7), anterior a esta quick; a allowlist
  `AUTHORIZED_FRONTIER_CHANGES` não foi atualizada naquela entrega.
- **Estado nesta quick:** não corrigido por estar fora do escopo. Permanece
  registrado nas quicks 261125-i05/i07/i08.

## 4. Campanha conjunta persistida com diretiva anterior

- **Contexto:** o contrato determinístico de reenvio compara o conteúdo
  reconstruído ao snapshot persistido. Uma campanha criada antes desta quick,
  reenviada sem operação existente, pode retornar `409
  operation_identity_conflict`.
- **Estado:** comportamento existente preservado; snapshots não são reescritos.
