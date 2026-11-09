## 1. Aprovações e pré-condições

- [x] 1.1 Registrar a decisão aprovada da política de tentativas da etapa base: manter 2 principal + 1 fallback, com timeout/abort/perda de comunicação após possível envio tratados como resultado desconhecido. — Evidência: 60-CONTEXT.md:45-47; design.md D6 (linhas 112-116); 60-01 S07/S08
- [x] 1.2 Registrar a decisão de ambiente da prova: homolog existente com IDs exclusivos de teste, mediante autorização específica e janela de exclusividade das RPCs compartilhadas. — Evidência: 60-CONTEXT.md:33-38; 60-01-PROOF-DECISION.md; 60-01-AUTHORIZATION-REQUEST.md
- [x] 1.3 Obter autorização separada e registrada para aplicar migrations, escrever dados de teste, executar a prova e limpar dados de teste. — Evidência: 60-01-AUTHORIZATION-REQUEST.md; 60-01-PROOF-DECISION.md
- [x] 1.4 Confirmar que esta fatia não cria flag, rota pública, UI, cron, fila ou worker e que o caminho incompleto não será exposto ao lojista. — Evidência: 60-04-STAGE-SEPARATION.md; non-activation.contract.test.ts (51 testes); nenhuma rota/flag nova
- [x] 1.5 Conferir unicidade do prefixo de timestamp das migrations futuras na worktree, na branch de destino e nas branches paralelas conhecidas. — Evidência: evidence/f60-20261109-04/migration-uniqueness.txt

## 2. Prova mínima de viabilidade (primeira entrega técnica)

- [x] 2.1 Identificar o destino por host, porta, banco e fingerprint do ledger; registrar snapshot S0 somente leitura antes de qualquer escrita. — Evidência: 60-01-PROOF-RESULT.md; evidence/f60-20261109-02/f60-ledger-precheck.json
- [x] 2.2 Criar o schema mínimo da prova: operação, etapas, claims de tentativa, desfechos, views compartilhadas e funções de transição, com `REVERT` documentado. — Evidência: supabase/migrations/20261109174110_f60_9_16_two_stage_control.sql:23-269, REVERT :1280+; RUN 2 origin-views 2/2
- [x] 2.3 Criar o harness de etapas simuladas com trabalhos determinísticos, sem IA e com evidência de artefato controlada. — Evidência: scripts/f60/two-stage-proof-harness.mjs; 60-01-PROOF-MATRIX.md
- [x] 2.4 Provar reserva → base simulada concluída → expansão simulada concluída → entrega, com exatamente 1 crédito consumido. — Evidência: 60-01 S01; RUN 2 financial-integration: duas aberturas/entrega vertical
- [x] 2.5 Provar falha definitiva da expansão com exatamente 1 estorno e operação terminal. — Evidência: 60-01 S02; RUN 2 financial-integration: falha definitiva sem arte
- [x] 2.6 Provar concorrência: duas requisições simultâneas resultam em somente uma execução autorizada. — Evidência: 60-01 S03
- [x] 2.7 Provar duas requisições simultâneas com o mesmo `request_id`: exatamente uma recebe autorização de execução e a outra apenas consulta. — Evidência: 60-01 S05
- [x] 2.8 Provar repetição da mesma requisição sem nova cobrança nem execução duplicada. — Evidência: 60-01 S04/S05
- [x] 2.9 Provar interrupção após a base com continuidade sem repetir a geração. — Evidência: 60-01 S06
- [x] 2.10 Provar preservação do limite de expansão entre retomadas. — Evidência: 60-01 S07
- [x] 2.11 Provar resultado desconhecido, incluindo timeout/abort/perda de comunicação após possível envio, sem repetição nem estorno cego e com caminho seguro de resolução. — Evidência: 60-01 S08
- [x] 2.12 Provar resposta tardia após encerramento sem entrega nem cobrança adicional. — Evidência: 60-01 S09
- [x] 2.13 Provar encerramento financeiro concorrente com etapa ativa devidamente protegido pelas rotinas compartilhadas. — Evidência: 60-01 S11
- [x] 2.14 Provar encerramento/estorno administrativo seguido de resposta tardia e nova tentativa, ambos recusados pela autoridade financeira. — Evidência: 60-01 S10
- [x] 2.15 Provar origem canônica sem desfecho duplicado ou conflitante na leitura compartilhada. — Evidência: 60-01 S12
- [x] 2.16 Provar preservação dos fluxos atuais 1:1 e 9:16 direto com suíte de compatibilidade. — Evidência: 60-01 S13; RUN 2 shared-reading-compatibility 8/8
- [x] 2.17 Registrar janela de exclusividade das RPCs compartilhadas e confirmar ausência de uso concorrente durante a prova. — Evidência: 60-01-PROOF-DECISION.md; 60-01-PROOF-RESULT.md; 60-03 RUN 2
- [x] 2.18 Consolidar evidências por cenário e emitir parecer aprovar/reprovar; em caso de reprovação, interromper a execução e revisar o desenho. — Evidência: 60-01-PROOF-MATRIX.md (13/13); 60-01-PROOF-DECISION.md APPROVED
- [x] 2.19 Limpar somente os dados de teste criados, com manifesto e evidência; não apagar registros financeiros append-only. — Evidência: 60-01-PROOF-RESULT.md (cleanup_executed=true, retained=73, deleted=0, unclassified=0); cleanup-manifest.json

## 3. Módulo de controle da operação (somente após prova aprovada)

- [x] 3.1 Implementar a identidade durável da operação e o vínculo com a operação financeira de 1 crédito. — Evidência: migration :23-35,321-420; two-stage-operation-client.ts:372-425; RUN 2 abertura idempotente
- [x] 3.2 Implementar as etapas `base` e `expansion` com estados persistidos e transições permitidas. — Evidência: migration :38-55,415; RUN 2 abertura idempotente/base reservada
- [x] 3.3 Implementar a aquisição de execução única com índice único parcial e serialização na linha de crédito. — Evidência: migration :455-665, :101; RUN 2 índice parcial impede segunda tentativa ativa
- [x] 3.4 Implementar a distinção `execute` × `query_only`: somente o vencedor da aquisição é autorizado a executar; o reenvio recebe apenas o estado. — Evidência: migration :527-539; two-stage-control.test.ts: acquire replay é query_only
- [x] 3.5 Implementar a idempotência por identificador de requisição, com devolução do mesmo resultado em repetição equivalente e conflito em divergência. — Evidência: migration :78,527-539; RUN 2 request_id idempotente e conflito
- [x] 3.6 Implementar a conclusão da base sem entrega, sem confirmação de crédito e sem alteração do status financeiro. — Evidência: migration :321-420; RUN 2 abertura idempotente e base concluída mantém reserva
- [x] 3.7 Implementar a continuidade após a base sem reexecutar a geração e sem nova reserva. — Evidência: migration :583-665; RUN 2 abertura idempotente/base reservada
- [x] 3.8 Implementar o limite de duas tentativas da expansão, com repetição apenas para falha transitória comprovada e contador lido do banco. — Evidência: migration :583-646; two-stage-control.test.ts: limita a expansão a inicial + um retry; 60-01 S07
- [x] 3.9 Implementar timeout/abort/perda de comunicação após possível envio como resultado desconhecido, sem repetição automática. — Evidência: migration :511-524; two-stage-control.test.ts: timeout após possível envio é unknown; 60-01 S08
- [x] 3.10 Implementar a política aprovada da etapa base no novo módulo, sem herança silenciosa e sem cobrança por tentativa. — Evidência: two-stage-control.test.ts: não autoriza primary depois de fallback/limita expansão; 60-01 S07
- [x] 3.11 Implementar o desfecho `unknown` imutável, o bloqueio de novas tentativas e a ausência de estorno automático. — Evidência: migration :511-524,815-840,166-168; RUN 2 desfecho idempotente
- [x] 3.12 Implementar a finalização de tentativa por token e estado esperado, revalidando a linha financeira sob a trava e recusando efeitos tardios após encerramento. — Evidência: migration :690-760; RUN 2 CAS rejeita token divergente
- [x] 3.13 Implementar a retomada a partir do estado persistido, sem repetir etapas concluídas e sem reiniciar contadores. — Evidência: migration :844-965; two-stage-control.test.ts: resume valida ações reais
- [x] 3.14 Implementar a derivação de estado financeiro a partir da linha de crédito, sem manter segunda verdade no módulo operacional. — Evidência: two-stage-financial-service.ts:284-315; RUN 2 operação delivered recusa estorno

## 4. Integração financeira e reconhecimento compartilhado

- [x] 4.1 Reutilizar a reserva existente na abertura da operação, com idempotência por identidade. — Evidência: two-stage-financial-service.ts:123-158; RUN 2 duas aberturas reservam UM crédito
- [x] 4.2 Implementar a confirmação única do crédito somente na entrega vertical, preservando o significado de `delivered`. — Evidência: two-stage-financial-service.ts:149-232; RUN 2 entrega vertical confirma uma vez
- [x] 4.3 Implementar o estorno único em falha definitiva sem entrega, recusando estorno de operação entregue. — Evidência: two-stage-financial-service.ts:225-280; RUN 2 falha definitiva sem arte estorna uma vez
- [x] 4.4 Criar a fonte de leitura compartilhada de claims ativos e desfechos persistidos, com origem canônica e anti-join para não duplicar operações. — Evidência: pending-operations-repository.ts:197-333; migration :174-269; RUN 2 views por origem
- [x] 4.5 Ajustar `product_1_1_close_failed_operation` para reconhecer a execução nova, impedir encerramento com etapa ativa e preservar fence/frescor. — Evidência: migration :984-1029; RUN 2 falha definitiva sem arte
- [x] 4.6 Ajustar `admin_resolve_product_1_1_pending` para reconhecer a execução nova, recusar encerramento indevido, revalidar a linha financeira e abandonar residual pelo caminho autorizado. — Evidência: migration :1039-1200; RUN 2 unknown não estorna/resolução administrativa
- [x] 4.7 Ajustar `product_1_1_get_campaign_operation_by_campaign` para expor desfechos da operação nova a partir da origem canônica. — Evidência: migration :1209-1256; RUN 2 compatibilidade/origem
- [x] 4.8 Ajustar `SupabasePendingOperationsRepository.readClaims` e a superfície administrativa para listar e resolver a operação nova sem segunda fila. — Evidência: pending-operations-repository.ts:335-392; RUN 2 entre etapas/listagem
- [x] 4.9 Escrever a suíte de compatibilidade que comprova comportamento idêntico dos fluxos 1:1 e 9:16 direto antes e depois das mudanças compartilhadas. — Evidência: shared-reading-compatibility.integration.test.ts; RUN 2 8/8
- [x] 4.10 Verificar que nenhuma regra financeira foi duplicada, que não existe ledger paralelo e que nenhum estado terminal é mantido em segunda verdade. — Evidência: migration :15,1310; 60-04-SECURITY-REVIEW.md; RUN 2 compatibilidade/origem

## 5. Verificação e encerramento da fatia

- [x] 5.1 Executar gates locais: testes focados, suíte de compatibilidade, typecheck, lint, build e `git diff --check`. — Evidência: 60-04-GATES-REPORT.md; evidence/f60-20261109-04/*.log
- [x] 5.2 Validar OpenSpec com `openspec validate --strict` para a mudança e para as specs afetadas. — Evidência: evidence/f60-20261109-04/openspec-strict.log; 60-04-GATES-REPORT.md
- [x] 5.3 Revisar segurança: RLS, grants, `SECURITY DEFINER`, `search_path`, travas e ausência de escrita por query builder. — Evidência: 60-04-SECURITY-REVIEW.md
- [x] 5.4 Registrar separação explícita entre validação local, prova em homolog e pendências de produção. — Evidência: 60-04-STAGE-SEPARATION.md
- [x] 5.5 Confirmar que nenhuma flag, ativação, deploy, push, merge ou chamada paga foi executada. — Evidência: 60-04-STAGE-SEPARATION.md:54-62; 60-04-GATES-REPORT.md
- [x] 5.6 Produzir resumo final com evidências, limitações, riscos residuais e próximo passo (revisão antes de qualquer plano GSD). — Evidência: 60-04-SUMMARY.md
- [x] 5.7 Confirmar nos testes finais: timeout após possível envio vira `unknown`; aquisição e reenvio são distinguidos; a linha financeira prevalece sobre registro operacional atrasado. — Evidência: two-stage-control.test.ts: timeout unknown/acquire replay; RUN 2 CAS/terminal
