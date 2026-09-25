## Why

A F48.1 entregou a bancada mínima isolada, porém restrita a um único prompt do Diretor (`campaign-image-director-offer`), sem diagnóstico das evidências existentes e sem matriz representativa. A **F48.2.1** é a primeira fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts** e entrega o primeiro ciclo controlado de otimização dos **três prompts do Diretor de Arte** (`offer`, `spotlight`, `exclusive`, todos 1:1): diagnóstico objetivo das evidências da F37, matriz de nove cenários, avaliação humana cega com rubrica, orçamento controlado, relatório e recomendação. Não inclui nenhuma estrutura ou execução do Revisor e não promove nada para produção.

## What Changes

- **Diagnóstico objetivo das evidências da F37, versionado**: cada falha observada é registrada como evidência imutável na cadeia **falha → evidência → causa provável → tratável por prompt? → hipótese mínima**, servindo de ponto de partida do ciclo de otimização.
- **Matriz representativa de nove cenários**: três por tipo de campanha (`offer`, `spotlight`, `exclusive`), todos no formato visual `1:1`, distribuindo preços (promocional/original, único, ausência obrigatória), identidade (logo × textual), textos legais (obrigatório, aviso ilustrativo, validade), CTA/hook, mídia (múltiplas imagens, embalagem, contexto, isolamento), nomes longos e condições de estresse. Assinatura visual permanece fora de escopo.
- **Suporte laboratorial aos três prompts do Diretor**: remove a limitação de prompt único; a allowlist passa a aceitar `campaign-image-director-offer`, `campaign-image-director-spotlight` e `campaign-image-director-exclusive`, com `campaign_intent` obrigatório e cenários de intents mistos recusados.
- **Baseline × candidata com modelo e parâmetros fixos**: `openai / gpt-5.5 / responses`; somente a dimensão `prompt` varia. Exatamente uma chamada `campaign_image` por run, sem fallback e sem Revisor produtivo dentro do experimento.
- **Rubrica humana e comparação cega**: rubrica estruturada por critério (`adequate`, `minor_defect`, `critical_defect`, `not_applicable`) com observação opcional, comparação cega com posição registrada e avaliações append-only. Sem scoring automático.
- **Regras de simplicidade das candidatas**: cada candidata ataca somente uma classe de falha observada; preferir remover/reorganizar/esclarecer antes de adicionar; proibir nomes/exemplos/soluções específicos das fixtures; não duplicar validações que o código já garante; registrar diferença de tamanho e justificativa; em empate, vencer a variante mais simples e curta.
- **Ciclos de otimização dos três prompts**: diagnosticar evidências e o baseline → hipótese → candidata → criar o experimento completo baseline × candidata → executar os dois lados → avaliar às cegas → refinar ou rejeitar, com critério de parada (recomendada, ou três ciclos, ou dois ciclos sem melhora). Diretor antes de qualquer trabalho do Revisor (que fica na F48.2.2).
- **Orçamento, isolamento, relatório e recomendação**: estimativa = cenários × duas variantes × repetições, selecionada pela capability; controle **atômico** do orçamento em USD do programa; toda chamada paga exige confirmação, estimativa e programa com orçamento autorizado; relatório final em Markdown canônico e recomendação de variantes vencedoras/rejeitadas.
- **Ajustes técnicos de migration**: criação de `lab_prompt_programs` **antes** da FK `program_id`; **backfill** de `campaign_intent='offer'` para os registros da F48.1; congelamento de `kind`, `campaign_intent` e `program_id` após o primeiro run. Migration aditiva, local-first, **não** aplicada no remoto.
- **Fora de escopo**: modo `reviewer`, casos de revisão, `campaign_image_review`, classificação de falsos positivos/negativos do Revisor (F48.2.2); promoção, deploy, canário, `db push` remoto e alteração de prompts produtivos (F48.2.3). **Fronteira com F48.6:** a F48.2.3 cobre apenas a promoção dos **prompts vencedores** desta fase, o canário do fluxo de aprovação e o rollback desses prompts/flag; a homologação e a promoção **geral** de modelos, providers e capabilities permanecem na **F48.6 — Homologação e promoção controlada**.

## Capabilities

### New Capabilities

- `lab-prompt-diagnostics`: diagnóstico objetivo e versionado das evidências existentes (F37), na cadeia falha → evidência → causa provável → tratável por prompt? → hipótese mínima.
- `lab-prompt-optimization`: matriz representativa versionada, ciclo explícito de otimização do Diretor, regras de simplicidade, regra de vitória determinística, checkpoints humanos, orçamento atômico do programa e relatório conclusivo (Markdown canônico) com recomendação de variantes.

### Modified Capabilities

- `lab-experiments`: aceita os três prompts do Diretor por `campaign_intent`, exige `program_id`, congela `kind`/`campaign_intent`/`program_id` após o primeiro run e mantém a dimensão `prompt`.
- `lab-scenarios`: aceita `offer`/`spotlight`/`exclusive` (formato `1:1`) e introduz a matriz de nove cenários; o cenário não carrega diagnóstico.
- `lab-runs`: valida a autorização de orçamento do programa antes da chamada paga e registra o `program_id` no snapshot; mantém exatamente uma chamada `campaign_image` por run.
- `lab-human-evaluation`: introduz a rubrica humana estruturada por critério e a comparação cega do Diretor, permanecendo append-only.
- `lab-admin-api`: expõe seleção de prompt do Diretor por tipo de campanha, estimativa por capability, endpoints de programa e registro da rubrica.
- `lab-admin-ui`: oferece seleção do prompt do Diretor por tipo de campanha, vínculo ao programa e formulário de rubrica estruturada.
- `lab-isolation`: exige programa com orçamento autorizado antes da chamada paga, controle atômico do orçamento em USD e fronteira local (migration não aplicada no remoto).

## Impact

- **Banco (migration aditiva, local-first, NÃO aplicada no remoto)**: `lab_experiments` ganha `campaign_intent` (com backfill `offer` para a F48.1), `program_id` e congelamento pós-run; nova `lab_prompt_programs` (criada **antes** da FK); `lab_human_evaluations` ganha `rubric`. Nenhuma alteração em `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_catalog`, `ai_model_selection` ou `admin_audit_log`.
- **Código do laboratório**: evolução de `src/lib/lab/**` (diagnóstico, cenários, domínio, execução, avaliação, orçamento) e das superfícies `src/app/(app)/admin/laboratorio/**` e `src/app/api/admin/laboratorio/**`; novas fixtures em `fixtures/lab/scenarios/**`.
- **Seams compartilhados**: qualquer alteração fora de `src/lib/lab/**` é estritamente aditiva, coberta por testes e neutra para produção. `prompts/` permanece intocado byte a byte.
- **Testes**: domínio, matriz, diagnóstico versionado, orçamento atômico, isolamento e regressão; nenhuma chamada paga em testes/CI (fakes de `AiInvoker`/`LabTelemetrySink`).
- **Operação/UAT**: execução real com checkpoints humanos (matriz → orçamento → execução → avaliação cega → decisão final) e relatório final.
- **Dependências**: não depende de artefatos do Revisor. É pré-requisito da **F48.2.2 — Auditoria e Otimização do Prompt do Revisor**.
- **Referência de design**: `openspec/design-system/MASTER.md` (dark OLED `#020617`/`#F8FAFC`/`#22C55E`, Poppins/Open Sans, `lucide-react`, sem emojis, sem light mode).
