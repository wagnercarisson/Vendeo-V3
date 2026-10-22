# fase-47-1-modelos-assinatura-visual

**F47.1 — Configuração e validação local de modelos da Assinatura Visual.**

Change OpenSpec revisada e **aprovada pelo Codex em 2026-10-21 para
planejamento GSD**. A aprovação **não autoriza implementação, migration
aplicada, chamada paga, push ou deploy**. A F47 concluída permanece preservada.

## Aprovação técnica e limites

- **Aprovado:** base técnica OpenSpec para avançar ao planejamento GSD.
- **Não aprovado:** execução/implementação.
- **Escopo:** validação local, 8 combinações, pipeline Responses atual,
  nenhuma etapa separada de direção, nenhum fallback `image-2-low`.
- **Pontos de revisão obrigatórios nos planos GSD:**
  - `maxRetries=0` comprovado no caminho experimental; se não puder ser
    garantido, o UAT para para revisão.
  - portas de API e DB verificadas **separadamente** no preflight.
  - flush dos envelopes de telemetria em sucesso e falha, sem duplicação nem
    perda por parsing, validação ou Storage.
  - `costCoverage=complete` somente quando a atribuição dos tokens e todas as
    tarifas necessárias estiverem comprovadas.
  - checkpoints locais e UAT manual previstos no OpenSpec.
- **Fora de escopo:** produção, `db push`, deploy, push, chamadas pagas nesta
  etapa e qualquer alteração no Produto 1:1.

## Artefatos

- `proposal.md` — por que e o que muda.
- `design.md` — decisões técnicas normativas (D1–D12).
- `specs/**/spec.md` — requisitos e cenários por capacidade.
- `tasks.md` — checklist de implementação futura.

## Estado

- OpenSpec: **4/4 artefatos completos; `validate --strict` válido.**
- Revisão Codex: **planos e escopos executados aprovados; consolidação UAT
  aguardando revisão final antes de verify/sync/archive.**
- Implementação: **concluída no escopo local**, com duas gerações comparativas
  executadas (GPT-5.5 e GPT-6-Luna, Sunburst Medium), avaliação visual humana e
  realinhamento manual da assinatura Luna.
- Planos GSD: **5 planos em `.planning/phases/47.1-configuracao-validacao-local-modelos-assinatura-visual/`.**
- UAT: **`47.1-UAT.md`** — cobertura inicial executada; seis combinações
  adicionais **não executadas**; custos parciais.
- Correção de imagem local: commits `a37f4b83` e `d16b54f2`; validada por
  realinhamento manual bem-sucedido (`b257e678-...` / perfil `a91f20de-...`).
- Matriz de cobertura: **`47.1-COVERAGE-MATRIX.md`** (requisito/cenário → plano
  → teste/evidência).
- **Pendência separada:** falha de atualização pode deixar perfil antigo
  apresentado como vigente; defeito **não corrigido**.
- **Produção:** nenhuma aprovação, promoção, push ou deploy.
- **Fora de escopo:** as seis combinações adicionais e a geração opcional com
  `rejectionContext` não foram executadas.
