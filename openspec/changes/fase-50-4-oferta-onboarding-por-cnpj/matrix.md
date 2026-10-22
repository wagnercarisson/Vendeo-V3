# Matriz da política — F50.4

## 1. Coorte de entrada

| Coorte | Condição de `auth.users.created_at` | Política de onboarding | Demo legada | Mensal legado | Observações |
|---|---|---|---|---|---|
| Pré-F50.2 | `< launch_at` | Sem oferta de 28 dias | Sim, se raiz sem benefício/enrollment | Regras legadas | Conta antiga permanece antiga. |
| F50.2 (`root_legacy`) | `>= launch_at` e `< individual_launch_at` (ou marco nulo) | Um enrollment por **raiz** | Não (`trial_offer_applies`) | Raiz com enrollment `root_legacy` é pulada | Comportamento atual preservado. |
| F50.4 (`per_cnpj_f50_4`) | `>= individual_launch_at` | Um enrollment por **CNPJ completo** | Não | Loja da nova coorte nunca é recipiente | Matriz/filiais independentes. |

Regras de borda:

- `individual_launch_at = NULL` ⇒ a coorte F50.4 não existe; todos seguem a tabela como antes.
- Conta criada antes do marco e onboarding depois ⇒ continua na coorte anterior.
- Conta criada depois do marco e onboarding depois ⇒ continua `per_cnpj_f50_4`.
- Desligar `enabled` ⇒ bloqueia novas adesões nas duas coortes; não muda coorte, não devolve demo/mensal e não apaga enrollment.
- `is_test_store=true`, `root_hash` vazio, CNPJ beneficiário vazio/não canônico ou onboarding incompleto ⇒ inelegível.

## 2. Identidade e unicidade

| Item | Legado (`root_legacy`) | F50.4 (`per_cnpj_f50_4`) |
|---|---|---|
| Chave econômica | `root_hash` | `beneficiary_cnpj_normalized` |
| Unicidade de raiz | Índice único parcial `(root_hash) WHERE policy_cohort='root_legacy'` | Não se aplica |
| Unicidade de beneficiário | Global `UNIQUE(beneficiary_cnpj_normalized)` | Global `UNIQUE(beneficiary_cnpj_normalized)` |
| Unicidade de loja | `UNIQUE(store_id)` | `UNIQUE(store_id)` |
| `root_hash` | Preservado para auditoria/legado | Preservado para auditoria/barreira de coexistência |
| `policy_cohort` | Imutável após o insert | Imutável após o insert |
| `user_id` | Histórico, não chave | Histórico, não chave |

## 3. Elegibilidade × histórico de benefício

| Histórico encontrado | Conta `root_legacy` | Conta `per_cnpj_f50_4` |
|---|---|---|
| Enrollment da **mesma loja** | Retorna `existing` (idempotente) | Retorna `existing` (idempotente) |
| Enrollment `root_legacy` de **outra filial da mesma raiz** | Inelegível `root_used_other_beneficiary`, sem devolver dados | Não bloqueia |
| Enrollment `per_cnpj_f50_4` de **outro CNPJ da mesma raiz** | **Não bloqueia**; a conta legada segue sua própria política por raiz | Não bloqueia |
| Enrollment do **mesmo CNPJ completo** (outra loja/conta) | Inelegível; nunca retorna o registro alheio | Inelegível `beneficiary_already_enrolled`, sem dados |
| `onboarding`/`demo`/`admin_exception` na raiz | Inelegível `prior_benefit` | Só bloqueia se vinculado ao mesmo CNPJ completo |
| `onboarding`/`demo`/`admin_exception` de outra filial | Bloqueia (regra legada por raiz) | Não bloqueia |
| `bonus_onboarding`/`demo` inicial do mesmo CNPJ | Regra legada preservada | Inelegível `prior_benefit` |
| Crédito manual `admin_grant` | Não altera a regra legada | **Não bloqueia** |
| `bonus_monthly`, compra, estorno, expiração | Não bloqueia onboarding | **Não bloqueia** |
| Entitlement órfão (`store_id IS NULL`) com mesma raiz | Regra legada preservada | Inelegível `prior_benefit_ambiguous` (fail-closed; resolução manual futura) |
| Crédito manual antigo com texto “onboarding” | Não reclassificado | Não bloqueia; classificação estruturada prevalece |

## 4. Concorrência

| Cenário | Resultado esperado |
|---|---|
| Mesmo CNPJ, duas tentativas concorrentes | Um enrollment; um grant; a segunda retorna `existing` do mesmo `store_id`. |
| Duas filiais novas da mesma raiz | Dois enrollments e dois grants (CNPJs distintos). |
| Filial nova × conta legada da mesma raiz | Sem assimetria por ordem: a filial F50.4 de outro CNPJ não bloqueia a conta legada e vice-versa. Cada uma é avaliada pela sua coorte; o mesmo CNPJ nunca duplica. |
| Trial × demo × mensal × exceção administrativa | Protocolo D3.1: loja → advisory de raiz → constraint → saldo. Serializa a decisão sem criar bloqueio comercial novo. |
| Replay do cron/parcela | Idempotência por `trial28d:<enrollment>:<seq>`; sem segundo grant. |
| Retry após falha | Mesmo `onboarding_completed_at`, sem duplicação. |

## 5. Programas legados

| Programa | Efeito da F50.4 |
|---|---|
| Demo legada 10/168 | Preservada para pré-F50.2; nunca para conta `>= launch_at`; a barreira legada por raiz considera somente enrollment `root_legacy`; filial `per_cnpj_f50_4` de outro CNPJ não bloqueia a conta anterior. |
| Freemium onboarding por raiz | Não reativado; `create_store_with_cnpj` continua condicionado à raiz e pode conceder 0 a uma filial, sem impedir a F50.4. |
| Mensal por raiz | Limite/ciclo/cap preservados; só enrollment `root_legacy` exclui a raiz; loja `per_cnpj_f50_4` nunca é recipiente. |
| `admin_exception` | Continua benefício anterior; bloqueia o mesmo CNPJ. |
| Crédito manual `admin_grant` | Permitido; origem/contabilização separadas; não consome parcela, não altera `granted_total`, não reinicia/estende a oferta. |

## 6. Ativação

| Ambiente | Permitido nesta mudança? | Condição |
|---|---|---|
| Produção / compartilhado | **Não** | Decisão operacional posterior, fora desta execução. |
| Banco descartável | **Sim, controlado** | Instância efêmera, identidade/saúde revalidadas, sem vínculo com produção; usada para testes/UAT e destruída ao final. |
| Homologação compartilhada | **Não** | Nenhum marco de teste pode atingir ambiente com dados reais. |
