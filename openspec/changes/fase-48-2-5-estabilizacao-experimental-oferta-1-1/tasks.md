# Tasks — F48.2.5: Estabilização experimental Oferta 1:1

> Dependências: F48.2.4 concluída, verificada, sincronizada e arquivada; bancada existente sob `src/lib/lab/bench/**`.
>
> Fronteira: bancada local/experimental e conteúdo `produto`, somente Oferta 1:1 validada nesta fase. Composição determinística exige mudanças de código; prompts e modelos são variáveis de experimentação manual. Sem pipeline/prompt/allowlist/flag/canário produtivos, campanhas reais, créditos de usuários, migrations remotas ou `db push`. Nenhuma task autônoma executa provider ou geração paga.
>
> Evidências: preferir `lab_bench_runs`, linhagem, snapshots, prompt aprovado/prompt_sent, versões e telemetria existentes, mais documentos versionáveis de UAT/experimento e manifesto do candidato. Nenhuma tabela nova, salvo impossibilidade técnica demonstrada e reportada como bloqueio.
>
> Checkpoints: **A** — revisão humana de contratos determinísticos e protocolo antes de qualquer geração paga; **B** — UAT manual/pago conduzido pelo usuário, com avaliações e decisão do candidato. `/opsx-verify`, `/opsx-sync` e `/opsx-archive` são ações exclusivas do responsável do projeto.
>
> Planejamento futuro: oito grupos executáveis (aprox. 8 planos GSD), sem esconder complexidade; interromper antes da execução para propor divisão se estimativa detalhada superar 8–10 planos.

## 1. Contratos, fronteiras e baseline

- [ ] 1.1 Conferir estado atual da bancada, specs sincronizadas pós-F48.2.4 e paths protegidos de produção; registrar Base SHA e baseline de paths produtivos/`supabase/migrations/**`.
- [ ] 1.2 Mapear campos livres editáveis pelo operador e pontos cliente/servidor de composição: `product.name`, `product.description`, `product.mandatoryArtworkText` e `promptBase`; documentar nome literal, descrição adaptável com significado preservado, textos obrigatórios literais e `promptBase` byte a byte/sem julgamento semântico; excluir preço, validade, enums/valores controlados e branding importado somente para leitura.
- [ ] 1.3 Criar/estender gates arquiteturais para provar ausência de provider em testes/tasks, ausência de acesso remoto e produção/migrations intocadas.
- [ ] 1.4 Auditar persistência existente para versões/evidências/decisões; se impossível sem tabela nova, parar e reportar bloqueio com prova técnica antes de alterar schema.

## 2. Política determinística de papéis de imagem

- [ ] 2.1 Atualizar política `produto` com a principal obrigatória/canônica/protagonista e adicionais opcionais do mesmo produto, subordinadas e sem garantia de aparição; versionar a política.
- [ ] 2.2 Preservar validação de uma principal e até três adicionais; comprovar multipart, persistência e transporte na ordem principal → adicionais informadas → identidade.
- [ ] 2.3 Atualizar UI com a mensagem curta e honesta de adicionais opcionais, sem prometer que todas aparecerão.
- [ ] 2.4 Testar política e contratos para zero/uma/três adicionais, sem produtos independentes, duplicação de protagonista, reorder ou layout programático.

## 3. Detector determinístico de integridade textual

- [ ] 3.1 Implementar módulo puro e versionado de regras pequenas para possíveis erros ortográficos tipográficos, pontuação/caracteres duplicados, espaços anormais, palavras adjacentes repetidas e anomalias simples.
- [ ] 3.2 Retornar alertas ordenados com campo, trecho, motivo e identificador de regra; manter textos originais byte a byte e excluir preço/validade/valores controlados.
- [ ] 3.3 Definir regras conservadoras para padrões ortográficos/PT-BR comuns, documentando limitações e falso positivo em marcas, nomes próprios, abreviações e termos técnicos; sem dicionário completo, dependência ou serviço remoto.
- [ ] 3.4 Criar testes determinísticos para casos positivos/negativos, ordem estável, campos excluídos, caracteres Unicode/acentos e preservação literal; sem provider.

## 4. Gate de revisão textual no preflight

- [ ] 4.1 Definir schema comum de `textIntegrityEvidence`: versão ativa, revisão determinística dos pares campo/valor em ordem canônica, incluindo `promptBase`, e decisão (`no_alerts`/`keep_exactly`), sem normalizar texto.
- [ ] 4.2 Implementar `/compose`: detector server-side; retornar `422 text_integrity_review_required` + alertas/revisão sem prompt quando houver alerta não resolvido; compor sem alertas e emitir evidência `no_alerts`.
- [ ] 4.3 Implementar reenvio `/compose` para decisão declarada `keep_exactly`: receber os mesmos valores e revisão, recalcular no servidor e aceitar somente conteúdo/versão correspondentes; stale retorna `409 text_integrity_review_stale` com estado/alertas atuais. A UI registra a escolha; evidência não é prova independente de clique.
- [ ] 4.4 Integrar UI para editar/revalidar ou confirmar manter; apresentar alertas; guardar evidência efêmera e invalidá-la em qualquer alteração de campo coberto.
- [ ] 4.5 Implementar `/runs` para receber evidência junto ao snapshot e `promptBase`, recalcular alertas/revisão e validar conteúdo byte a byte, versão e decisão declarada antes de persistir execução ou provider; alteração isolada de `promptBase`, evidência ausente ou divergente retorna `409 text_integrity_review_stale`.
- [ ] 4.6 Testar rotas separadamente e em fluxo combinado: alertas sem decisão/422, manter exato atual, correção, payload adulterado, mudança pós-decisão, versão obsoleta/409, entrada sem alertas/no_alerts, evidência ausente/divergente em runs/409 e prompt aprovado/sent byte a byte; provar bloqueio pré-persistência/provider sem provider real.

## 5. Integridade geral do resultado criado pelo modelo

- [ ] 5.1 Atualizar orientação geral somente para português correto, ausência geral de caracteres/símbolos/pontuação duplicados/anômalos e proibição de correção silenciosa; manter os contratos textuais específicos sob política `produto`.
- [ ] 5.2 Manter fidelidade a preço, data, selo e condições, além da proibição de inventar/reinterpretar comercialmente, exclusivamente na política Oferta; versionar políticas sem redundância.
- [ ] 5.3 Atualizar golden/contratos do prompt e testes de propriedade disjunta: integridade linguística/literal geral versus integridade comercial da Oferta.
- [ ] 5.4 Atualizar política `produto` para instruir nome inteiro/literal conforme aprovado, descrição complementar adaptável sem distorção/invenção e textos obrigatórios literais; avaliar visualmente cada categoria no UAT sem promessas técnicas.

## 6. Protocolo documental, manifesto e isolamento

- [ ] 6.1 Criar template versionável de experimento por rodada: hipótese, variável única, run ID, entradas mantidas, resultado, avaliação humana, decisão e próximo ajuste.
- [ ] 6.2 Criar protocolo UAT para duas lojas e dois produtos distintos; incluir caso com principal isolada e caso principal+adicionais, entradas idênticas entre modelos e rubrica humana separando nome inteiro/literal, descrição/contexto, textos obrigatórios literais e integridade comercial.
- [ ] 6.3 Fixar matriz manual inicial `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` em `low`; exigir hipótese concreta para `medium+`; registrar protocolo, pricing version, usage, latência e custo por run.
- [ ] 6.4 Criar schema/template de manifesto candidato que congela prompt-base exato reutilizável e versões (candidateId/version, composer, image-role, text-integrity, prompt-base e policy versions), modelo/qualidade/protocolo/pricing, runs, avaliações, limitações e decisão humana.
- [ ] 6.5 Associar prompt compilado/aprovado/sent exato ao run que contém loja, produto e oferta; manifesto referencia esses prompts por run ID e nunca elege um prompt específico de caso como candidato universal.
- [ ] 6.6 Provar que manifesto/documentos não são carregados pelo runtime, não ativam configuração e reutilizam runs/linhagem/snapshots; nenhuma tabela nova.

## 7. Testes integrados e validação sem provider

- [ ] 7.1 Testar cliente/API de composição, aprovação e execução contra alertas, decisões e alterações obsoletas; simular provider com adapter gravador/fake.
- [ ] 7.2 Testar a ordem das referências e a evidência de versões/prompt; confirmar isolamento e ausência de secrets, campanhas produtivas, créditos e escrita remota.
- [ ] 7.3 Executar typecheck, lint, build e testes de contrato/suítes relevantes; nenhuma chamada real de IA ou geração paga.
- [ ] 7.4 Verificar Base SHA: nenhuma alteração em caminhos produtivos protegidos nem em `supabase/migrations/**`; registrar resultado e ambiente local.

## 8. Checkpoints, UAT humano e fechamento de evidências

- [ ] 8.1 **CHECKPOINT A — humano:** revisar contratos de papéis, detector/limitações, invalidadores, protocolo, rubrica e manifesto; bloquear toda chamada paga até aprovação explícita.
- [ ] 8.2 Após CHECKPOINT A, preparar bancada local e evidências sem executar provider; confirmar orçamento/estimativa e chave exclusiva da bancada antes do UAT conduzido pelo responsável.
- [ ] 8.3 **CHECKPOINT B — usuário:** conduzir manualmente UAT pago autorizado, comparações controladas de modelos/prompt, avaliação humana por critério e decisão aprovar/rejeitar/ajustar; nenhuma task autônoma ultrapassa o gate.
- [ ] 8.4 Preencher documentos de UAT/experimentos e manifesto final com prompt-base exato reutilizável; referenciar prompts completos compilados/aprovados por run ID; avaliar separadamente nome integral/literal, descrição fiel/adaptável, texto obrigatório literal e integridade comercial; registrar versões, custos/usage/latência, limitações e decisão humana; não promover nada para produção.
- [ ] 8.5 Confirmar produção intocada, nenhum `db push`, nenhum crédito de usuário e zero chamadas ao provider pelo executor; entregar para revisão e parar antes de `/opsx-verify`, `/opsx-sync` ou `/opsx-archive`.
