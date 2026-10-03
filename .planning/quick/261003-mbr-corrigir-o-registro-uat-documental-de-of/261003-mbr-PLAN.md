---
task: 261003-mbr
type: quick
autonomous: true
files_modified:
  - .planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT.md
  - .planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT-MANIFEST.md
  - .planning/quick/261003-mbr-corrigir-o-registro-uat-documental-de-of/261003-mbr-PLAN.md
  - .planning/quick/261003-mbr-corrigir-o-registro-uat-documental-de-of/261003-mbr-SUMMARY.md
  - .planning/STATE.md
  - .planning/HANDOFF.json
must_haves:
  truths:
    - "OF-A registra como informação relatada pelo usuário o modelo/qualidade gpt-image-2.5-sunburst / medium, uma imagem de referência, 24.6 segundos e usage informado pelo usuário, sem inventar decomposição numérica."
    - "O custo local calculado aparece como USD 0.03 e permanece explicitamente distinto de custo reportado/confirmado pela plataforma, que continua não fornecido."
    - "A avaliação segue requer ajuste; a observação de fidelidade de imagem, linguagem criativa e dados comerciais existentes permanece; nenhum candidato ou CHECKPOINT B é aprovado e o Plano 10 não inicia."
    - "A evidência é identificada como relato do usuário, não como consulta a banco de dados."
  artifacts:
    - path: ".planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT.md"
      provides: "Registro e tabela OF-A reconciliados com dados informados pelo usuário e pendências remanescentes"
    - path: ".planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT-MANIFEST.md"
      provides: "Manifesto de evidências coerente com a ficha UAT e sem inferência de aprovação/custo de plataforma"
    - path: ".planning/STATE.md"
      provides: "Estado/continuidade atualizado sem alterar status de checkpoints ou do Plano 10"
    - path: ".planning/HANDOFF.json"
      provides: "Handoff JSON válido e alinhado ao status e à origem da evidência"
  key_links:
    - from: "48-2-6-UAT.md OF-A"
      to: "48-2-6-UAT-MANIFEST.md OF-A"
      via: "Mesmos fatos relatados, status, fonte e separação de custo local/plataforma"
    - from: ".planning/STATE.md"
      to: ".planning/HANDOFF.json"
      via: "Estado documental atualizado sem iniciar plano ou checkpoint"
---

<objective>
Corrigir documentalmente o registro OF-A da UAT F48.2.6, retirando dos campos not-provided os valores efetivamente informados pelo usuário e preservando as lacunas reais.

Purpose: Evitar que relato já fornecido seja tratado como ausente, sem elevar sua procedência a evidência de banco/plataforma nem alterar a decisão UAT.
Output: UAT e manifesto reconciliados, mais summary e tracking GSD atualizados.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@docs/fluxo-de-desenvolvimento.md
@.planning/STATE.md
@.planning/HANDOFF.json
@.planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT.md
@.planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT-MANIFEST.md

Escopo apenas documental. A evidência é relato fornecido pelo usuário; declarar expressamente que nenhum banco de dados foi consultado. Não executar provider calls, geração de imagem, novo run, leituras de banco ou ações de lifecycle OpenSpec.

Manter pendentes Run ID, snapshot/linhagem, evidência de prompt/política e custo confirmado/reportado pela plataforma; registrar usage informado pelo usuário sem criar valores numéricos nem decomposição não restatada. Se útil, indicar que detalhamento numérico de usage não foi fornecido. Custo local calculado USD 0.03 não é valor faturado/plataforma.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reconciliar OF-A no UAT e manifesto</name>
  <files>.planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT.md, .planning/phases/48.2.6-validacao-experimental-produto-intencoes-1-1/48-2-6-UAT-MANIFEST.md</files>
  <action>Atualizar texto, ficha/tabelas OF-A e manifesto para atribuir os fatos à informação fornecida pelo usuário (não consultada de banco): modelo/qualidade `gpt-image-2.5-sunburst` / `medium`, uma imagem de referência, duração 24.6 segundos, usage relatado pelo usuário sem inventar tokens ou decomposição, e custo local calculado `USD 0.03`. Distinguir explicitamente custo local de qualquer valor reportado/confirmado pela plataforma, que continua not-provided. Retirar esses dados informados de classificações not-provided; conservar pendentes Run ID, snapshot/linhagem e evidência de prompt/política, e manter pendente eventual detalhamento numérico de usage se aplicável. Preservar as observações já registradas (nome do produto omitido, imagem fiel, frases criativas genéricas aceitas, preço/selo/validade/textos obrigatórios presentes) e o resultado `requer ajuste`. Manter comparação proposta não autorizada/não executada, sem candidato aprovado, sem CHECKPOINT B e sem iniciar Plano 10.</action>
  <verify>
    <automated>git diff --check; conferir por leitura que fatos, fonte, lacunas e decisão batem nos dois arquivos</automated>
  </verify>
  <done>UAT e manifesto concordam que os quatro dados informados estão presentes e atribuídos ao relato do usuário, com custo local USD 0.03 separado de custo de plataforma não fornecido; status e observações originais são preservados.</done>
</task>

<task type="auto">
  <name>Task 2: Atualizar continuidade GSD e validar coerência documental</name>
  <files>.planning/quick/261003-mbr-corrigir-o-registro-uat-documental-de-of/261003-mbr-SUMMARY.md, .planning/STATE.md, .planning/HANDOFF.json</files>
  <action>Atualizar STATE e HANDOFF somente para registrar a correção documental de OF-A, mantendo F48.2.6 em execução, Planos 01–09 concluídos e Plano 10 não iniciado, CHECKPOINT B `not_started`, e nenhuma aprovação de candidato. Criar summary conciso que explicite USD 0.03 como estimativa/cálculo local relatado, não valor faturado ou confirmado pela plataforma; fonte user-provided report, sem consulta a banco. Não alterar outros estados históricos nem acionar OpenSpec. Validar JSON do HANDOFF, executar `git diff --check` e inspecionar consistência UAT/manifest/STATE/HANDOFF/SUMMARY.</action>
  <verify>
    <automated>node -e "JSON.parse(require('fs').readFileSync('.planning/HANDOFF.json','utf8')); console.log('HANDOFF JSON valid')"; git diff --check; conferir consistência textual dos artefatos</automated>
  </verify>
  <done>Summary e tracking refletem a correção sem promover evidência, custo ou status; HANDOFF continua JSON válido e os artefatos são coerentes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| User report → documentary UAT | Relato manual deve continuar atribuído ao usuário, sem representá-lo como leitura de banco ou confirmação do provedor. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-261003-mbr-01 | Tampering | UAT/manifest | mitigate | Reconciliar valores e origem entre ficha e tabela, preservando as observações e decisão existentes. |
| T-261003-mbr-02 | Repudiation | Custo de OF-A | mitigate | Identificar USD 0.03 apenas como custo calculado localmente e deixar plataforma não fornecida. |
</threat_model>

<verification>
- `git diff --check` sem erros.
- `node -e "JSON.parse(require('fs').readFileSync('.planning/HANDOFF.json','utf8'))"` conclui com sucesso.
- Inspeção textual confirma alinhamento UAT/manifest/STATE/HANDOFF/SUMMARY, sem contradição sobre dados, origem, custo ou status.
</verification>

<success_criteria>
Os campos OF-A informados pelo usuário não aparecem como não fornecidos; dados indisponíveis permanecem pendentes; custo local e custo de plataforma permanecem distintos; avaliação e limites de execução ficam inalterados.
</success_criteria>

<output>
Criar `.planning/quick/261003-mbr-corrigir-o-registro-uat-documental-de-of/261003-mbr-SUMMARY.md` ao executar.
</output>
