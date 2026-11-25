# Deferred items — quick 261125-i09

Itens deliberadamente não tratados nesta quick. Nenhum foi planejado nem
iniciado.

## 1. Aceite visual — cobertura restrita

- **Registrado:** geração conjunta aprovada pelo usuário em 2026-11-25.
  - 1:1: `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25 (2).jpg`
  - 9:16: `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25 (1).jpg`
- **Cobertura:** somente essa geração com logotipo (“LOJA MEGA VALE”), distinta
  do título promocional “Natal Mega Vale”, com detalhes textuais preservados.
- **Não validado manualmente:** `text_only`, `visual_signature`, outras lojas e
  todas as gerações. Fidelidade ao ativo não medida independentemente.
- **Não implica** publicação nem aprovação para produção.

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
- **Relação com o typecheck:** não é um erro de typecheck e não foi afetado pela
  correção pontual dos 4 `TS18047` dos testes da i08.

## 4. Campanha conjunta persistida com diretiva anterior

- **Contexto:** o contrato determinístico de reenvio compara o conteúdo
  reconstruído ao snapshot persistido. Uma campanha criada antes desta quick,
  reenviada sem operação existente, pode retornar `409
  operation_identity_conflict`.
- **Estado:** comportamento existente preservado; snapshots não são reescritos.

## 5. Interação entre cenário e tema natalino — hipótese

- **Observação:** as gerações ambientadas apresentaram maior elaboração temática
  natalina que os exemplos em estúdio.
- **Status:** hipótese sobre a interação cenário×tema; **não comprova causa
  técnica**. Não investigado, e prompts de cenário/tema não foram alterados nesta
  quick. Candidato a trabalho futuro separado.
