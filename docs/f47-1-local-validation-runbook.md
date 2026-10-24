# F47.1 — Runbook de validação local da Assinatura Visual

Este runbook cobre a configuração dedicada da Assinatura Visual em ambiente
local aprovado. Ele **não** autoriza promoção, `db push`, deploy, push de git,
reset de banco de produção ou chamadas pagas automáticas.

## 1. Escopo e destino aprovado

| Item | Valor |
|---|---|
| Workdir local | `G:\Vendeo-Homolog` |
| Project ID | `vendeo-homolog` |
| API local | `127.0.0.1:57781` |
| DB local | `127.0.0.1:57782` |
| Migration | `20261024141422_f47_1_visual_signature_model_config.sql` |
| SHA-256 (LF normalizado) | `B352F93EFA1B2F829E5D97FFAA79F7972CF3D7696C6B7CEB40EBFC517A26AA90` |
| SHA-256 físico em checkout CRLF | `03EBFB1783F79AF99A89828324F0C2BE9F9053FEB499E21B10EF3FC3BFF983D9` |

API e DB são validados **separadamente**. A porta do DB não é derivada da API
nem recebida por env adicional: ela vem do `supabase status`/config local e é
comparada à porta esperada. A API é comparada a
`VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE` (host:porta).

## 2. Preflight read-only

```powershell
powershell -NoProfile -File scripts/f47-1/preflight.ps1 `
  -PreflightOnly -Stage post-migration `
  -Workdir G:\Vendeo-Homolog -ProjectId vendeo-homolog `
  -ApiPort 57781 -DbPort 57782 `
  -ExpectedMigration 20261024141422_f47_1_visual_signature_model_config.sql `
  -ExpectedSha256 B352F93EFA1B2F829E5D97FFAA79F7972CF3D7696C6B7CEB40EBFC517A26AA90
```

O preflight é **somente leitura**: não copia migration, não aplica migration,
não faz `db push`, `--linked`, reset, `migration repair`, push ou deploy.

Ele exige containers locais saudáveis, API/DB em loopback nas portas esperadas,
ausência de Vercel/produção, `gpt-6-luna/responses` ativo, migration no ledger e
Falha ⇒ **parar**.

## 3. Inicialização do app local

`npm run dev` sozinho NÒO carrega as variáveis locais e falha no middleware com
`Missing NEXT_PUBLIC_SUPABASE_URL`. Use o inicializador que lê somente a chave
autorizada e deriva as credenciais do Supabase aprovado em memória:

```powershell
powershell -NoProfile -File scripts/f47-1/start-local-app.ps1 -Port 3000
```

Ele não imprime/copia/persiste segredos; define as variáveis apenas no processo
do app. Se `NEXT_PUBLIC_TURNSTILE_SITE_KEY` estiver ausente e
`captcha_enabled=true`, o login local por senha pode não concluir; não desative
o captcha para contornar a proteção.

## 4. Variáveis de ambiente

Nunca registrar valores neste documento, em logs ou em evidências.

| Variável | Papel |
|---|---|
| `VENDEO_VS_VALIDATION_ENABLED` | Opt-in explícito; precisa ser `1` para consumir a configuração dedicada. |
| `VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE` | Identidade canônica esperada (host:porta da API local). |
| `VENDEO_VS_VALIDATION_OPENAI_API_KEY` | Credencial dedicada de provider para imagem/validação da VS. |
| `OPENAI_API_KEY` | Credencial normal do app; usada por aprovação/perfil de marca e fluxos legados. |

Distinção obrigatória:

- credencial de **banco/Storage** = configuração Supabase local;
- credencial de **provider validation** = chave dedicada da VS;
- credencial **normal** = `OPENAI_API_KEY`, usada fora da imagem/validação da VS.

O precheck só reporta presença booleana; nunca imprime as chaves.

## 5. Migration e configuração

A migration F47.1 é **local-only** e já foi aplicada no destino aprovado no
plano 47.1-01. Não reaplicar, não usar `db push`, não resetar o banco.

A configuração dedicada é gravada pela tela:

`/admin/ai-model-selection` → card **Assinatura Visual — direção e preset de imagem**

A gravação usa exclusivamente a RPC `admin_set_visual_signature_model_config`,
com ator, motivo, `operation_id`, identidade canônica e `reasoning_effort='low'`
derivado no servidor. O reset usa
`admin_reset_visual_signature_model_config` com motivo e auditoria.

## 6. Gates e provas

```powershell
powershell -NoProfile -File scripts/f47-1/run-phase-gates.ps1 `
  -Workdir G:\Vendeo-Homolog -ApiPort 57781 -DbPort 57782
```

O script executa:

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- suítes focadas da fase;
- `openspec validate fase-47-1-modelos-assinatura-visual --strict`;
- `git diff --check`;
- `scripts/f47-1/run-local-proofs.ps1 -ProofsOnly`.

As provas usam o destino local aprovado e:

- transação com `ROLLBACK` para as provas não concorrentes;
- banco descartável próprio no mesmo servidor local para as provas
  concorrentes;
- comparação antes/depois de configuração, auditoria, catálogo e
  `ai_model_pricing`;
- nenhuma chamada de provider.

Falha em qualquer gate ⇒ **parar**.

## 7. Precheck do UAT

```powershell
powershell -NoProfile -File scripts/f47-1/run-uat-precheck.ps1 `
  -Mode initial `
  -ExpectedOrchestrator gpt-5.5 `
  -ExpectedPreset sunburst_medium
```

O precheck é read-only, **não substitui** `NEXT_PUBLIC_SUPABASE_URL`/
`SUPABASE_URL` e compara os valores originais com o destino aprovado. Se o
isolamento falhar, ele para antes de preflight/psql. O resultado é estruturado
(`UAT_PRECHECK_RESULT`) para distinguir isolamento, credencial, configuração
ausente/inválida e combinação esperada.

Ele falha fechado se:

- o preflight pós-migration falhar;
- a migration não estiver no ledger;
- `gpt-6-luna/responses` não estiver ativo;
- a configuração dedicada não puder ser lida;
- as credenciais `validation`/`normal` estiverem ausentes;
- opt-in/identidade não estiverem configurados;
- `maxRetries=0` não for comprovado pelo teste do adapter;
- a configuração dedicada estiver ausente (herdada não é “pronta” para esta
  rodada);
- a combinação esperada (`ExpectedOrchestrator`/`ExpectedPreset`) não coincidir
  com a vigente;
- a linha tiver identidade/tuple inválida pelo contrato puro do runtime.

Ele não grava configuração e não chama provider. A ausência de configuração
dedicada pode ser um estado de preparação, mas **não** autoriza a rodada: sem
preset dedicado o runtime usaria gateway legado, credencial normal, qualidade
automática e retry padrão do SDK. O precheck deve ser repetido antes de cada
geração, com a combinação esperada e a versão registradas.

### Orçamento e limites

| Rodada | Gerações | Imagens máx. | Validações máx. |
|---|---:|---:|---:|
| Inicial | 2 | 4 | 4 |
| Adicional (opcional) | 6 | 12 | 12 |

Cada geração permite até 2 tentativas de aplicação. `maxRetries=0` no gateway de
validação evita retry oculto do SDK.

Referências históricas (não são teto financeiro, tarifa oficial ou garantia):

- inicial: ~US$ 0,176 de imagem;
- adicional: até ~US$ 0,464;
- todas as 8 gerações: até ~US$ 0,64 de imagem.

O custo reportado pelo provider é autoritativo.

### Escopos de credencial

- imagem + validação da VS: `credential_scope='validation'`;
- aprovação/perfil de marca: `credential_scope='normal'`.

Nunca afirmar que todo o UAT usou exclusivamente a chave dedicada.

O precheck marca `profile_flow_planned=1` e `authorization=pending`; ele não
autoriza a rodada de perfil de marca. Essa autorização pertence ao checkpoint
humano da Task 3.

A credencial sentinela usada apenas no `ProofsOnly` das provas SQL **não** é
credencial válida e **não** pode ser usada para aprovar o precheck de UAT.

## 8. Execução manual do UAT

O executor **não** executa as gerações pagas. A rodada é conduzida pelo humano
após o checkpoint de autorização.

1. Abrir o app local apontando para o Supabase aprovado.
2. No admin, selecionar GPT-5.5 + Sunburst Medium, salvar com motivo e conferir
   versão/configuração vigente.
3. Executar uma geração em `POST /api/store/[id]/visual-signature/generate-without-logo`
   em modo `standard`, uma imagem, mesmos dados/prompt/tamanho/reasoning.
4. Trocar para Luna + Sunburst Medium, salvar com novo motivo e repetir.
5. Aprovar uma assinatura para cobrir um fluxo de perfil de marca; registrar
   que essa etapa usa a credencial normal.
6. Registrar por run: modelos, preset, qualidade, reasoning, versão,
   `attempt_number`, `retry_used`, `retry_prompt_variant`, `credential_scope`,
   `creative_intent_*`, `intended_palette`, `content_used`, latência,
   `costCoverage`, estimativa e custo reportado.
7. Parar imediatamente se houver mais de 2 tentativas, chamada paga oculta ou
   `maxRetries=0` não comprovado.
8. Resultado de retry usa prompt simplificado e não é equivalente ao prompt
   inicial.

## 9. Recovery forward-only

Se a configuração dedicada precisar ser desativada:

1. preferir **reset auditado** no card da VS (motivo obrigatório), retornando à
   seleção herdada; ou
2. remover a linha pela RPC `admin_reset_visual_signature_model_config` com
   ator/motivo; ou
3. aplicar migration corretiva local, se necessário.

Não usar `db push`, reset destrutivo, `migration repair`, `--linked` ou qualquer
promoção remota. Nenhuma recuperação deve apagar auditoria.

## 10. Critérios de parada

- preflight/precheck falhou;
- `maxRetries=0` não comprovado;
- limite de tentativas excedido;
- configuração/versão divergente entre tentativas da mesma geração;
- credencial dedicada ausente ou usada fora do escopo esperado;
- qualquer tentativa de chamada paga automática, push ou deploy.

Em qualquer critério: parar o UAT, registrar a limitação e retornar para
revisão. Nenhuma aprovação de produção é emitida por este runbook.
