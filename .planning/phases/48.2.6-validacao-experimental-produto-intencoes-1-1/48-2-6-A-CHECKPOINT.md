# F48.2.6 — CHECKPOINT A

## Decisão humana

- **Decisão literal registrada:** “CHECKPOINT A aprovado.”
- **Decisão canônica:** `approved`
- **Data:** 2026-10-03
- **Responsável:** usuário responsável pelo projeto
- **SHA revisado:** `6c6ea325373f991fb4628bdfcd5306ac944ac151`
- **BASE_SHA:** `5fb863e91f42e5daa218f5918f0b78afa31ec0c8`

## Escopo da aprovação

O responsável aprovou o CHECKPOINT A para readiness local e preparação documental do Plano 09, conforme orientação posterior. Esta aprovação:

- **não** autoriza provider real, consulta de credenciais, geração, execução de run ou gasto;
- **não** autoriza leitura remota nem alteração de banco/migration;
- **não** inicia CHECKPOINT B;
- **não** autoriza iniciar o Plano 10 nesta continuação.

Qualquer eventual run continua fora desta aprovação e exigiria ação exclusiva do usuário e confirmação financeira individual imediatamente antes do run.

## Revisão técnica apresentada

| Item | Evidência revisada | Decisão |
|---|---|---|
| Matriz preço × intenção | de+por → Oferta; somente por → Oferta/Destaque; sem preços → Destaque/Exclusivo; preço original isolado inválido; zeros contam como ausentes. | Aprovado |
| Autoridade | `intent-options.ts` é pura e restrita à bancada; `form-rules.ts` mantém exports via delegação; UI/schema/backend usam a matriz comum; hook produtivo permanece intocado com paridade testada. | Aprovado |
| Validade | Permitida somente em Oferta; payload incompatível falha; UI conserva os valores até regularização explícita. | Aprovado |
| Selos | `BADGE_OPTIONS_BY_INTENT` e permissões existentes permanecem inalterados; cobertos pelos contratos da bancada. | Aprovado |
| Policies/prompt-base | Oferta, Destaque e Exclusivo versionados somente no recorte permitido; prompt-base neutro `48.2.6-produto-1-1-v1` compartilhado; demais dimensões permanecem desabilitadas. | Aprovado |
| Guards/efeitos | Admin→environment→manifest; chave exclusiva `OPENAI_BENCH_API_KEY`; erros sanitizados; CAS single-run; recusas negativas sem efeitos. | Aprovado |
| Gates/segurança | Testes focados, typecheck, lint, build, strict OpenSpec e fences aprovados; `48-2-6-SECURITY.md` registra 0 ameaças high abertas. | Aprovado |
| Fronteiras | BASE_SHA→HEAD e BASE_SHA→worktree sem diferenças protegidas; migrations e arquivos não rastreados limpos. | Aprovado |

## Ressalva histórica

Uma execução ampla anterior reportou quatro `fetch failed`, mas os logs disponíveis não registraram hostname/porta. **Destino histórico não determinado.** Não se afirma acesso remoto confirmado nem acesso exclusivamente local. Depois, os testes de execução e fronteira foram isolados com mock determinístico de custo e guard que falha em qualquer fetch não mockado; a reexecução corrigida passou offline, com zero fetch observado.

## Estado dos checkpoints

- **CHECKPOINT A:** aprovado para o escopo restrito acima.
- **CHECKPOINT B:** não iniciado; avaliação manual permanece pendente e exclusiva do usuário.
- **Plano 09:** autorizado apenas para readiness local e documentos, sem provider real, leitura remota ou geração paga.
- **Plano 10:** não iniciar nesta continuação.
