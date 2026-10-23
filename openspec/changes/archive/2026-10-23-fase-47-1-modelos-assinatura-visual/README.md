# fase-47-1-modelos-assinatura-visual

**F47.1 — Configuração e validação local de modelos da Assinatura Visual.**

Change OpenSpec revisada e **aprovada pelo Codex em 2026-10-21 para
planejamento GSD**. A aprovação **não autoriza implementação, migration
aplicada, chamada paga, push ou deploy**. A F47 concluída permanece preservada.

> **Cronologia:** a aprovação de 2026-10-21 valeu apenas para o planejamento.
> Implementação, migration local e chamadas pagas tiveram **autorizações
> posteriores e separadas**, registradas nos planos/summaries/UAT. Nada aqui
> retroage autorizações nem transforma a aprovação de planejamento em aprovação
> de produção.

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

- **Arquivada em 2026-10-23** com aprovação final do Codex e cobertura parcial aceita.
- OpenSpec: **4/4 artefatos completos; `validate --strict` válido.**
- Revisão Codex: **planos e escopos executados aprovados; vereditos GSD/OpenSpec
  atualizados em 2026-10-23 para revisão. Permanece a confirmação explícita da
  cobertura parcial opcional antes de sync/archive.**
- Implementação: **concluída no escopo local**, com duas gerações comparativas
  executadas (GPT-5.5 e GPT-6-Luna, Sunburst Medium), avaliação visual humana e
  realinhamento manual da assinatura Luna.
- Planos GSD: **5 planos executados em `.planning/phases/47.1-configuracao-validacao-local-modelos-assinatura-visual/`**, mais o `47.1-06-PLAN.md` **aprovado pelo Codex e executado** para `credential_scope` do perfil; 146 testes PASS. Eventos futuros cobertos por mocks; históricos inalterados.
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
  `rejectionContext` não foram executadas. São tarefas **opcionais**, com
  cobertura parcial preservada; o arquivamento requer **confirmação explícita**
  dessa limitação, sem marcá-las como executadas e sem exigir novas chamadas
  pagas.
