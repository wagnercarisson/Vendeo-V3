## Why

A F48.1 entregou a bancada mínima isolada, porém restrita a um único prompt do Diretor (`campaign-image-director-offer`), sem diagnóstico das evidências existentes e sem matriz representativa. A **F48.2.1** é a primeira fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts** e entrega uma **bancada funcional para testes manuais** dos três prompts do Diretor de Arte (`offer`, `spotlight`, `exclusive`, todos 1:1): diagnóstico objetivo das evidências da F37, matriz de nove cenários, suporte aos três tipos de campanha, orçamento controlado e as ferramentas de apoio (rubrica humana, comparação cega e regra de vitória consultiva).

A **criação, revisão, execução, avaliação e aprovação de candidatas reais não fazem parte da entrega automática** desta fase: ocorrerão posteriormente, em sessões conduzidas pelo usuário e pelo assistente diretamente no laboratório. A F48.2.1 não inclui nenhuma estrutura ou execução do Revisor e não promove nada para produção.

> **Realinhamento de escopo (decisão humana):** a fase entrega exclusivamente a bancada funcional. Os **ciclos pagos obrigatórios** de otimização dos três prompts **deixam de ser requisito de conclusão** da F48.2.1. O laboratório não cria candidatas automaticamente, não inicia experimentos automaticamente e não aprova, promove ou incorpora candidatas automaticamente. A primeira operação real paga ocorrerá posteriormente, com nova autorização humana.

## What Changes

- **Bancada funcional para testes manuais dos três prompts do Diretor**: suporta `offer`, `spotlight` e `exclusive`; o usuário **insere ou cola manualmente** a candidata; a bancada **não** cria candidatas, **não** inicia experimentos e **não** aprova/promove/incorpora automaticamente.
- **Diagnóstico objetivo das evidências da F37, versionado**: cada item registra a cadeia **falha → evidência → causa provável → tratável por prompt? → hipótese mínima**, com rastreabilidade por item e distinção entre falha observada e hipótese/taxonomia. As versões v1, v2 e v3 permanecem como **evidência histórica/técnica**.
- **Matriz representativa de nove cenários**: três por tipo de campanha (`offer`, `spotlight`, `exclusive`), todos no formato visual `1:1`, distribuindo preços (promocional/original, único, ausência obrigatória), identidade (logo × textual), textos legais (obrigatório, aviso ilustrativo, validade), CTA/hook, mídia (múltiplas imagens, embalagem, contexto, isolamento), nomes longos e condições de estresse. Assinatura visual permanece fora de escopo.
- **Suporte laboratorial aos três prompts do Diretor**: a allowlist aceita `campaign-image-director-offer`, `campaign-image-director-spotlight` e `campaign-image-director-exclusive`, com `campaign_intent` obrigatório e cenários de intents mistos recusados.
- **Baseline × candidata com modelo e parâmetros fixos**: `openai / gpt-5.5 / responses`; somente a dimensão `prompt` varia. Exatamente uma chamada `campaign_image` por run, sem fallback e sem Revisor produtivo dentro do experimento.
- **Rubrica humana e comparação cega**: rubrica estruturada por critério (`adequate`, `minor_defect`, `critical_defect`, `not_applicable`) com observação opcional, comparação cega com posição registrada e avaliações append-only. Sem scoring automático.
- **Regra de vitória consultiva**: a regra determinística permanece disponível como **ferramenta de apoio**; não decide aprovação, não dispara novos ciclos, não promove variantes e não substitui a decisão humana. A decisão final sobre qualquer candidata é sempre humana.
- **Orçamento, autorização e revogação efetiva**: estimativa = cenários × duas variantes × repetições, selecionada pela capability; controle **atômico** do orçamento em USD do programa. A reserva só ocorre com o programa explicitamente em `status='authorized'`. Não há status `revoked`: **`status='closed'` representa o programa encerrado, cuja autorização está revogada**; ele é terminal, não retorna a `authorized`, recusa qualquer nova reserva antes de chamada paga e exige um **novo programa** para uma nova sessão. Encerrar preserva os valores financeiros como histórico auditável (sem apagar/zerar). A efetividade vem do bloqueio server-side/RPC (qualquer status ≠ `authorized` recusa). A UI oferece a ação explícita "Encerrar programa / revogar autorização" com confirmação humana, a API recusa reautorizar um programa `closed`, e o sistema exibe autorizado/reservado/consumido/saldo com o painel de orçamento integrado à tela relevante.
- **Correções técnicas pendentes**: reforço da reserva para `status='authorized'`, encerramento terminal/revogação efetiva, controle administrativo de encerrar programa, exibição e integração do painel de orçamento, arquivamento seguro do experimento interrompido, validação automática e UAT da bancada **sem exigir execução paga**, e confirmação do isolamento de `prompts/` e das estruturas produtivas.
- **Ajustes técnicos de migration**: `lab_prompt_programs` **antes** da FK `program_id`; **backfill** de `campaign_intent='offer'` para os registros da F48.1; congelamento de `kind`, `campaign_intent` e `program_id` após o primeiro run. Migration aditiva, local-first, **não** aplicada no remoto.
- **Fora de escopo**: ciclos pagos obrigatórios de otimização como requisito de conclusão; criação/revisão/aprovação automática de candidatas; modo `reviewer`, casos de revisão, `campaign_image_review`, classificação de falsos positivos/negativos do Revisor (F48.2.2); promoção, deploy, canário, `db push` remoto e alteração de prompts produtivos (F48.2.3). **Fronteira com F48.6:** a F48.2.3 cobre apenas a promoção dos **prompts** desta fase, o canário do fluxo de aprovação e o rollback desses prompts/flag; a homologação e a promoção **geral** de modelos, providers e capabilities permanecem na **F48.6 — Homologação e promoção controlada**.

## Capabilities

### New Capabilities

- `lab-prompt-diagnostics`: diagnóstico objetivo e versionado das evidências existentes (F37), na cadeia falha → evidência → causa provável → tratável por prompt? → hipótese mínima.
- `lab-prompt-optimization`: bancada funcional de testes manuais dos prompts do Diretor, matriz representativa versionada, suporte aos três tipos de campanha, regra de vitória consultiva, orçamento atômico com autorização/revogação e as orientações (não bloqueantes) para candidatas inseridas manualmente.

### Modified Capabilities

- `lab-experiments`: aceita os três prompts do Diretor por `campaign_intent`, exige `program_id`, congela `kind`/`campaign_intent`/`program_id` após o primeiro run, mantém a dimensão `prompt` e define o arquivamento seguro do experimento.
- `lab-scenarios`: aceita `offer`/`spotlight`/`exclusive` (formato `1:1`) e introduz a matriz de nove cenários; o cenário não carrega diagnóstico.
- `lab-runs`: valida que o programa está `status='authorized'` antes da chamada paga, registra o `program_id` no snapshot e mantém exatamente uma chamada `campaign_image` por run.
- `lab-human-evaluation`: introduz a rubrica humana estruturada por critério e a comparação cega do Diretor, permanecendo append-only.
- `lab-admin-api`: expõe seleção de prompt do Diretor por tipo de campanha, estimativa por capability, endpoints de programa (incluindo encerrar o programa/revogar a autorização e recusar reautorização de programa `closed`) e registro da rubrica.
- `lab-admin-ui`: oferece seleção do prompt do Diretor por tipo de campanha, vínculo ao programa, painel de orçamento integrado (autorizado/reservado/consumido/saldo), ação explícita "Encerrar programa / revogar autorização" com confirmação e formulário de rubrica estruturada.
- `lab-isolation`: exige programa `status='authorized'` antes da chamada paga, encerramento terminal/revogação efetiva, controle atômico do orçamento em USD e fronteira local (migration não aplicada no remoto).

## Impact

- **Banco (migration aditiva, local-first, NÃO aplicada no remoto)**: `lab_experiments` ganha `campaign_intent` (com backfill `offer` para a F48.1), `program_id` e congelamento pós-run; nova `lab_prompt_programs` (criada **antes** da FK); `lab_human_evaluations` ganha `rubric`. Nenhuma alteração em `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_catalog`, `ai_model_selection` ou `admin_audit_log`.
- **Código do laboratório**: evolução de `src/lib/lab/**` (diagnóstico, cenários, domínio, execução, avaliação, orçamento) e das superfícies `src/app/(app)/admin/laboratorio/**` e `src/app/api/admin/laboratorio/**`; novas fixtures em `fixtures/lab/scenarios/**`. Permanecem pendentes as correções técnicas de reserva/revogação, exibição e integração do orçamento, arquivamento seguro e UAT sem execução paga.
- **Seams compartilhados**: qualquer alteração fora de `src/lib/lab/**` é estritamente aditiva, coberta por testes e neutra para produção. `prompts/` permanece intocado byte a byte.
- **Testes**: domínio, matriz, diagnóstico versionado, orçamento atômico, autorização/revogação, isolamento e regressão; nenhuma chamada paga em testes/CI (fakes de `AiInvoker`/`LabTelemetrySink`).
- **Operação/UAT**: validação e UAT da bancada **sem exigir execução paga**. A primeira operação real paga, se houver, ocorrerá em sessão posterior conduzida pelo usuário, com nova autorização humana explícita.
- **Dependências**: não depende de artefatos do Revisor. É pré-requisito da **F48.2.2 — Auditoria e Otimização do Prompt do Revisor**.
- **Referência de design**: `openspec/design-system/MASTER.md` (dark OLED `#020617`/`#F8FAFC`/`#22C55E`, Poppins/Open Sans, `lucide-react`, sem emojis, sem light mode).
