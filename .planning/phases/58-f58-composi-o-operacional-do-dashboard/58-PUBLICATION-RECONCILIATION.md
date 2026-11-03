# F58 — Adendo de encerramento, integração e publicação

**Data:** 2026-11-03
**Estado:** registro documental; não reabre a change nem altera specs.
**Objetivo:** separar a validação original da F58 das melhorias posteriores, da integração comprovada pelo Git e do aceite/publicação efetivamente confirmados.

## 1. Validação original da F58

- `58-VERIFICATION.md`: **16/16 must-haves**, `status: passed`, em 2026-11-02.
- `58-05-SUMMARY.md`: Tasks 1–3 concluídas; UAT 14/14 observado com ressalvas instrumentais.
- `58-05-PUBLISH-GATES.md`: validação local e humana separadas da publicação; naquele momento a publicação **não havia sido executada nem autorizada**.
- OpenSpec da F58 arquivado em `openspec/changes/archive/2026-11-02-fase-58-composicao-operacional-do-dashboard/`; não foi reaberto.

Limitações originais preservadas: leitor de tela real não executado; lint sem cobertura TypeScript; parte dos cenários observada em harness de componentes, não integração completa; capturas de homolog não comprovam produção.

## 2. Melhorias posteriores (quicks)

| Quick | Entrega | Integração no Git | Publicação/aceite |
|---|---|---|---|
| `261102-mr6` | changelog editorial da F58 | `7c3b888f` ancestral da main | integrada; sem smoke específico do anúncio registrado |
| `261102-p3w` | fontes locais (Poppins/Open Sans) | `b632aa5f` ancestral da main | integrada; publicação genérica pelo deploy da main; sem smoke específico de fontes registrado |
| `261102-n8g` | organização da suíte de testes | `98a4aaf0` ancestral da main | ferramenta/documentação; sem publicação de produto |
| `261102-o00` | correções determinísticas da suíte | `cd25071a` ancestral da main | ferramenta/testes; sem publicação de produto |
| `261102-oab` | reconciliação do legacy-frontier guard | `3433a713` ancestral da main | ferramenta/testes; sem publicação de produto |
| `261102-qna` | geração/backfill de miniaturas | commits `912916cc`…`e3ecaad4` na main | **push/deploy confirmados pelo responsável**; 246/246 miniaturas; aceite de produção |
| `261102-tnu` | consumo das miniaturas no dashboard/listagem | `a6d763c0` ancestral da main | **push/deploy confirmados pelo responsável**; UI validada funcional/visualmente em produção |

A presença na main comprova **integração**, não publicação por si só. O único registro de publicação/aceite é o do responsável em `261102-qna/evidence/production-ACCEPTANCE.md`.

## 3. Integração e publicação confirmadas

- **Integração:** todos os commits representativos acima são ancestrais do `HEAD` da main (`git merge-base --is-ancestor`).
- **Publicação:** o responsável confirmou push/deploy e validação funcional/visual em produção das quicks `261102-qna` e `261102-tnu` (`production-ACCEPTANCE.md`, registrado em `4bf21b5d`).
- **Não registrado:** deployment ID, commit publicado específico, data exata do deploy ou smoke F58-específico. Nada disso é inferido neste adendo.

## 4. Disposição da task histórica 8.3

A task `8.3` do `tasks.md` arquivado permanece **não marcada** e rastreável. Disposição:

- o código da F58 está integrado na main e foi carregado pelo deploy confirmado das quicks;
- o aceite de produção registrado cobre as superfícies de dashboard/listagem e as miniaturas;
- **não** foi produzido um artefato de smoke F58-específico nem comprovação de todos os cenários originais em produção;
- portanto, 8.3 é tratada como **historicamente superada pela publicação do código + aceite das quicks**, sem ser marcada como “executada com smoke dedicado”.

Referências: `58-VERIFICATION.md`, `58-05-PUBLISH-GATES.md`, `261102-qna/evidence/production-ACCEPTANCE.md`, `261102-qna/evidence/production-write-FINAL.md`.

## 5. Limitações que permanecem

- Leitor de tela real não executado.
- Lint sem cobertura TypeScript.
- Cenários de falha de crédito/fuso/readiness observados em harness, não integração completa.
- Quicks de miniaturas: espanhol não revalidado visualmente na produção.
- O aceite de produção não contém geração de campanha nova como prova.
- Homolog de backfill e suítes PostgreSQL/Produto 1:1 não executados não se tornam aprovados pelo aceite de produção.
