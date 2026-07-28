# Alinhamento Fase 33 — Verificação de CNPJ para Liberação do Freemium

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F30 — Fundação Legal                                        ✓
  ├── F31.1 — Modelo Comercial — Formulário                       ✓
  ├── F31.2 — Diretores por Intenção                              ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                 ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                              ✓
  └── F33 — Verificação de CNPJ para Liberação do Freemium        ← esta fase

v1.7 — Monetização Pública (Stripe)                               △ F34 futura
```

A F32 (concluída em 2026-07-27) estabeleceu a fundação do freemium por raiz de CNPJ: validação de dígitos, hash HMAC-SHA256 da raiz, tabela de entitlements com idempotência, e condicionamento do grant de onboarding + mensal à raiz. A F32 **não consulta APIs externas** — o lojista digita manualmente razão social e nome fantasia, e a validação cadastral se limita a similaridade textual entre o nome informado e os dados digitados (Levenshtein, score informativo).

A F33 avança para a **próxima camada de integridade cadastral**: consultar fontes oficiais (BrasilAPI com fallback CNPJá) para obter dados cadastrais reais, cruzá-los com as informações fornecidas pelo lojista, e decidir se o freemium é liberado automaticamente ou se a loja requer revisão manual.

**Dependências:** F32 (cnpj validation, freemium entitlements, store route, admin), F30 (legal clearance, document versions), F24 (credit transactions)

---

## Problema

A F32 resolveu a multiplicação de contas por raiz de CNPJ, mas ainda opera com **dados auto-informados**:

1. O lojista digita razão social e nome fantasia manualmente — sem verificação contra fonte oficial
2. Um CNPJ falso (que passe na validação de dígitos) pode ser usado sem barreira
3. Um CNPJ real mas de terceiro (sem autorização) pode ser cadastrado — a F32 só bloqueia o mesmo CNPJ duplicado, não o uso de CNPJ alheio
4. As informações cadastrais (endereço, nome, segmento) não são validadas contra os dados oficiais da Receita Federal
5. O grant de onboarding (10 créditos) é concedido automaticamente se a raiz for elegível — sem qualquer checagem de verossimilhança entre os dados informados e os oficiais

**Cenário de abuso possível pós-F32:** Um agente malicioso cria um CNPJ que passa na validação de dígitos (ex: de uma empresa inativa ou de terceiro), informa dados fictícios no formulário, e recebe 10 créditos de onboarding automaticamente.

---

## Escopo

### O que a F33 faz

1. **Consulta cadastral externa de CNPJ** — BrasilAPI como provedor primário, CNPJá como fallback, tratamento de timeout/erro/rate limit
2. **Preenchimento automático de dados oficiais** — razão social (bloqueado), nome fantasia (bloqueado), endereço completo (editável), situação cadastral
3. **Cross-check de verossimilhança** — nome da loja vs razão social/nome fantasia oficiais, cidade/UF informada vs dados oficiais
4. **Armazenamento de CNAE** como dado de referência (sinal fraco para análise futura, sem decisão automática)
5. **Motor de decisão de elegibilidade** — approve / review / reject / defer
6. **Liberação condicional do freemium** — concede onboarding grant apenas se decisão = `approve`
7. **Cache de consulta CNPJ com TTL** — evita consultas repetidas do mesmo CNPJ e reduz dependência de disponibilidade das APIs
8. **Fila de revisão admin** — casos `review` entram em fila para aprovação/recusa manual com audit trail
9. **Nova migration SQL** — colunas de status de verificação e dados oficiais na loja, tabela de cache de lookup
10. **Serviço reutilizável de verificação** — `cnpj/verification-service.ts` + `freemium/freemium-risk-service.ts`, desacoplados do onboarding
11. **Criação de store de teste pelo admin** — CNPJ fictício com dados manuais, marcada como teste, sem freemium automático, auditada

### Fora de Escopo (não fazer agora)

| Item | Motivo |
|------|--------|
| **CNAE → segmento automático** | Mapping CNAE confiável exige manutenção contínua. CNAE é armazenado como sinal fraco para consulta futura |
| **Logo hash / comparação de logotipos** | Complexidade visual desnecessária para esta fase |
| **Device fingerprint** | Camada adicional que pode vir depois, independente |
| **E-mail corporativo vs gratuito** | Sinal auxiliar, fora do escopo cadastral |
| **IA antifraude / scoring comportamental** | Escopo grande demais; F33 usa regras determinísticas |
| **Bloqueio por IP** | Sinal auxiliar, não substituto de validação cadastral |
| **Organização / conta multiusuário** | Fora do roadmap atual |
| **Reativação de CNPJ defer após cron** | Reprocessamento é manual ou via trigger no momento certo (próxima tentativa do usuário) |
| **Notificação por e-mail de revisão pendente** | Pode ser adicionada depois; na F33 o admin vê na fila |
| **Suporte a CPF (MEI sem CNPJ)** | MEI tem CNPJ. Se need surgir, fase futura |

---

## Fluxo

```
┌─────────────────────────────────────────────────────────────────────┐
│                   FLUXO DE CRIAÇÃO DE LOJA (F33)                    │
└─────────────────────────────────────────────────────────────────────┘

PARTE 1 — LOOKUP (assíncrono, ao digitar CNPJ)
═══════════════════════════════════════════════════════════════════════

Usuário digita CNPJ no formulário
        │
        ▼
Validação local de dígitos (validateCnpj - F32)
        │ inválido → erro "CNPJ inválido" (não continua)
        │ válido
        ▼
Consulta cache (cnpj_lookup_cache)
        │ hit (dentro do TTL) → usa dados em cache
        │ miss
        ▼
┌─────────────────────────────────────────┐
│ LOOKUP PROVIDER                          │
│                                         │
│ 1. BrasilAPI (GET /api/cnpj/{cnpj})     │
│    ├── sucesso → retorna dados oficiais  │
│    ├── erro 429 (rate limit) →          │
│    │   tenta CNPJá                       │
│    ├── erro 5xx (instabilidade) →       │
│    │   tenta CNPJá                       │
│    └── timeout (> 5s) → tenta CNPJá     │
│                                         │
│ 2. CNPJá (fallback)                     │
│    ├── sucesso → retorna dados oficiais  │
│    └── erro/timeout → estado DEFER       │
└─────────────────────────────────────────┘
        │
        ├── sucesso → armazena em cache (TTL 24h)
        │             pré-preenche formulário com dados oficiais
        │             estado: DADOS_RESOLVIDOS
        │
        └── falha (defer) → estado DEFER
                            formulário aberto sem pré-preenchimento
                            mensagem: "Não foi possível consultar os dados
                            deste CNPJ. A loja será criada sem créditos
                            iniciais. Você pode tentar novamente depois."

PARTE 2 — FORMULÁRIO (preenchido parcialmente)
═══════════════════════════════════════════════════════════════════════

Campos exibidos:

┌────────────────────────────────────────────┐
│ CNPJ *                   [ 12.345.678/0001-90 ]  ← digitado, locked │
│ Razão Social             [ EMPRESA EXEMPLO LTDA ]  ← preenchido, locked │
│ Nome Fantasia            [ Empresa Exemplo    ]  ← preenchido, locked │
│                                                          │
│ [Usar nome fantasia] [Usar razão social]                  │
│                                                          │
│ Nome da Loja *          [ ____________________ ]  ← editável │
│                                                          │
│ Endereço:                                                 │
│   CEP *     [ ________ ]                                  │
│   Rua       [ ________________ ]  ← pré-preenchido se API │
│   Número *  [ ____ ]                                      │
│   Complemento [ ________ ]                                │
│   Bairro    [ ______________ ]  ← pré-preenchido se API   │
│   Cidade *  [ ______________ ]  ← pré-preenchido se API   │
│   UF *      [ __ ]              ← pré-preenchido se API   │
│                                                          │
│ Segmento *              [ ______________ ]                 │
│ Subsegmento             [ ______________ ]                 │
│                                                          │
│ Tom de Voz, Posicionamento, Descrição, Slogan...          │
└────────────────────────────────────────────────────────────┘

Botões:
- "Usar nome fantasia" → copia nome fantasia para "Nome da Loja"
- "Usar razão social" → copia razão social para "Nome da Loja"
  (exibido apenas se não houver nome fantasia)

PARTE 3 — SUBMISSÃO E DECISÃO
═══════════════════════════════════════════════════════════════════════

Usuário clica "Salvar"
        │
        ▼
Valida campos obrigatórios
        │ inválido → erros no formulário
        │ válido
        ▼
POST /api/store
  ├── Sobe cnpj + dados oficiais (se resolvidos) + nome da loja + endereço + segmento
  │
  ▼
┌─────────────────────────────────────────────┐
│ FREEMIUM RISK SERVICE                        │
│                                              │
│ Input: { cnpj, storeName, address, segment,  │
│          officialData?, userId, storeId }     │
│                                              │
│ Regras de decisão:                           │
│                                              │
│ APPROVE (aprova automático) se:              │
│   ├── CNPJ existe na consulta                │
│   ├── Situação cadastral = ATIVA             │
│   ├── Raiz ainda elegível (entitlement)      │
│   ├── Nome da loja ≈ razão social            │
│   │   OU nome da loja ≈ nome fantasia        │
│   │   (similaridade ≥ 0.6 — mais tolerante   │
│   │    que o 0.8 da F32 para evitar          │
│   │    falsos positivos)                     │
│   ├── Cidade informada = cidade oficial      │
│   │   (case-insensitive, ignorando acentos)  │
│   └── UF informada = UF oficial              │
│                                              │
│ REVIEW (revisão manual) se:                  │
│   ├── Nome da loja diverge de razão social   │
│   │   E nome fantasia (similaridade < 0.6)   │
│   ├── Cidade ou UF divergem dos oficiais     │
│   ├── CNPJ existe mas situação ≠ ATIVA       │
│   │   (SUSPENSA ou demais não-ATIVA que      │
│   │    não sejam BAIXADA/NULA — estas vão    │
│   │    para REJECT)                          │
│   ├── Muitas tentativas de CNPJ do mesmo IP  │
│   │   (sinal fraco, não bloqueio)            │
│   ├── API retornou dados incompletos         │
│   │   (ex: sem endereço, sem CNAE)           │
│   └── Segmento parece incompatível com CNAE  │
│       (anotação, não bloqueio — CNAE é       │
│        sinal fraco nesta versão)             │
│                                              │
│ REJECT (rejeita freemium) se:               │
│   ├── CNPJ não encontrado na consulta        │
│   │   (inexistente na Receita)               │
│   ├── CNPJ baixado ou nulo                   │
│   │   (situação = BAIXADA ou NULA)           │
│   ├── Raiz já recebeu onboarding             │
│   │   (entitlement existe)                    │
│   └── CNPJ já cadastrado em outra conta      │
│       (duplicidade — já tratado na F32)      │
│                                              │
│ DEFER (adia decisão) se:                     │
│   ├── BrasilAPI e CNPJá indisponíveis        │
│   ├── Rate limit atingido em ambas            │
│   └── Timeout em ambas                        │
└─────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────┐
│ COMPORTAMENTO POR DECISÃO                         │
│                                                   │
│ APPROVE ──→ Cria loja + concede 10 créditos      │
│              onboardingGranted: true               │
│              Mensagem: "Loja criada com sucesso!   │
│              Seus créditos de boas-vindas foram    │
│              liberados."                           │
│                                                   │
│ REVIEW ───→ Cria loja (sem créditos)              │
│              onboardingGranted: false              │
│              Entra na fila de revisão admin        │
│              Mensagem: "Loja criada. Seus          │
│              créditos de boas-vindas serão         │
│              liberados após verificação            │
│              cadastral."                           │
│                                                   │
│ REJECT ───→ BLOQUEIA CRIAÇÃO QUANDO               │
│              CNPJ inválido nos dígitos             │
│              ou inexistente na consulta            │
│              (não cria loja — sem dados           │
│              oficiais para preencher)              │
│              Mensagem: "CNPJ não encontrado na     │
│              Receita Federal. Verifique o número   │
│              e tente novamente."                   │
│              ──────────────────────────────────── │
│              Cria loja (sem créditos) QUANDO       │
│              erro de elegibilidade por raiz        │
│              (raiz já usou, CNPJ baixado/nulo)     │
│              Mensagem: "Loja criada. Esta empresa  │
│              não está elegível para créditos       │
│              de boas-vindas."                      │
│              ──────────────────────────────────── │
│              Para testar com CNPJ fictício,        │
│              admin cria store de teste via         │
│              painel administrativo                 │
│                                                   │
│ DEFER ────→ Cria loja (sem créditos)              │
│              onboardingGranted: false              │
│              Permite reprocessar depois            │
│              Mensagem: "Loja criada. Não foi       │
│              possível verificar os dados           │
│              cadastrais agora. Você pode           │
│              tentar novamente em 'Dados da         │
│              Loja'."                               │
└──────────────────────────────────────────────────┘

PARTE 4 — ADMIN REVIEW
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────┐
│ FILA DE REVISÃO ADMIN                        │
│ /admin/reviews                               │
│                                              │
│ Abas: ● Pendentes (REVIEW) ● Adiados (DEFER) │
│       ● Rejeitados (REJECTED)                │
│                                              │
│ A aba "Pendentes" foca REVIEW (casos que     │
│ precisam de decisão). DEFER e REJECTED ficam │
│ acessíveis para que admin possa conceder     │
│ exceção mesmo em casos de CNPJ baixado/nulo  │
│ ou deferido.                                 │
│                                              │
│ CNPJ inexistente (not_found) bloqueia criação│
│ pública — não há store para revisar.         │
│                                              │
│ Colunas:                                     │
│ ├── Loja (nome + CNPJ mascarado)             │
│ ├── Usuário (email)                          │
│ ├── Motivos (tags: nome_divergente,          │
│  ││      cidade_divergente, cnpj_inativo, etc.) │
│ ├── Decisão do sistema (automática)          │
│ ├── Dados oficiais + [Revelar CNPJ]          │
│ │   [Consultar na Receita]                   │
│ └── Ações: [Aprovar] [Recusar] [Exceção]     │
│                                              │
│ CNPJ: exibido mascarado na listagem          │
│ Botão "Revelar CNPJ" na página de detalhe:   │
│   → mostra CNPJ completo                     │
│   → registra em admin_audit_log              │
│   → action = 'reveal_cnpj'                   │
│                                              │
│ Botão "Consultar na Receita":                │
│   → abre BrasilAPI/CNPJá em nova aba         │
│                                              │
│ Ações:                                       │
│ ├── Aprovar → tenta conceder onboarding       │
│ │   normal (benefit_type = 'onboarding'),      │
│ │   status → APPROVED. Se raiz já usou,        │
│ │   não concede (raiz esgotada).              │
│ ├── Recusar → status → REJECTED               │
│ │   (sem grant, sem recurso automático)       │
│ └── Exceção → grant manual com reason         │
│     (benefit_type = 'admin_exception',         │
│      reusa fluxo F32, bypassa verificação     │
│      de raiz — para casos onde admin          │
│      decide conceder mesmo com rejeição)      │
│                                              │
│ Todas as ações registradas em admin_audit_log │
└─────────────────────────────────────────────┘
```

---

## Decisões de Arquitetura

### D1 — Dois status separados: verificação de CNPJ ≠ elegibilidade do freemium

`DECIDIDO`

A loja tem dois conceitos ortogonais que NÃO devem ser confundidos:

```
verification_status (coluna real em stores)
  → controla o estado da verificação cadastral do CNPJ
  valores: unverified | pending | approved | review | rejected | defer

freemium_granted (derivado, NÃO é coluna)
  → existência de freemium_entitlements com benefit_type = 'onboarding'
  → consultado via LEFT JOIN ou subquery (já existe na F32)
```

`verification_status` NÃO é "onboarding completo". Ele controla exclusivamente a elegibilidade dos créditos. Uma loja pode estar `verification_status = approved` sem ter recebido grant (ex: filial de raiz já usada), ou `verification_status = review` com loja funcionando normalmente (apenas sem créditos).

### D2 — Consulta externa: provedor primário + fallback + cache

`DECIDIDO`

```
┌──────────────────────────────────────────────────────────┐
│                  LOOKUP PROVIDER                           │
│                                                           │
│  Interface: LookupProvider {                              │
│    lookup(cnpj: string): Promise<LookupResult>            │
│  }                                                        │
│  Resultado do lookup:                                     │
│    { status: 'resolved',  data: CnpjLookupData }          │
│    { status: 'not_found' } — CNPJ inexistente na Receita  │
│    { status: 'unavailable' } — provider falhou/timeout    │
│                                                           │
│  Provedores:                                              │
│  ├── BrasilApiProvider (primário)                         │
│  └── CnpjaProvider (fallback)                             │
│                                                           │
│  Cache:                                                   │
│  ├── Tabela cnpj_lookup_cache                             │
│  ├── Chave: cnpj_normalized                               │
│  ├── TTL: 24 horas (configurável)                         │
│  ├── Cache hit → não consulta API                         │
│  └── Cache miss → consulta sequencial                     │
│       BrasilAPI → CNPJá → atualiza cache                  │
│  ├── not_found também é cacheado (evita reconsulta)       │
│  └── unavailable NÃO é cacheado (pode ser transitório)    │
│                                                           │
│  Timeout: 5s por provedor                                 │
│  Retry: 1 tentativa por provedor                          │
└──────────────────────────────────────────────────────────┘
```

Cache é **obrigatório desde a primeira versão**. Sem cache, BrasilAPI/CNPJá viram gargalo e fonte de instabilidade no onboarding.

### D3 — Retorno do lookup: dados oficiais completos

`DECIDIDO`

```typescript
interface CnpjLookupResult {
  cnpj_normalized: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string; // "ATIVA" | "SUSPENSA" | "BAIXADA" | "NULA" | etc.
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  data_situacao: string | null;
  data_abertura: string | null;
  porte: string | null; // "ME" | "EPP" | "DEMAIS" | etc.
}
```

### D4 — Cross-check: deterministico, baseado em regras

`DECIDIDO`

O motor de decisão usa regras determinísticas (não ML, não IA):

```typescript
interface FreemiumEligibilityInput {
  cnpj: string;
  storeName: string;
  city: string;
  state: string;
  segment: string;
  officialData: CnpjLookupResult | null; // null se DEFER
  userId: string;
  storeId?: string; // null em criação
  rootHash: string;
}

interface FreemiumEligibilityOutput {
  decision: "approve" | "review" | "reject" | "defer";
  reasons: string[];
  score: number; // 0-100, quão confiante
  signals: {
    nameSimilarity: number | null;
    cityMatch: boolean | null;
    stateMatch: boolean | null;
    cnpjExists: boolean | null;
    situacaoCadastral: string | null; // "ATIVA" | "BAIXADA" | "NULA" | "SUSPENSA" | etc.
    rootEligible: boolean | null;
    cnaeCompatible: boolean | null; // sinal fraco, sempre nulo nesta fase
  };
}
```

**Regras de aprovação (APPROVE):**
- `cnpjExists = true` (CNPJ encontrado na consulta)
- `situacaoCadastral = 'ATIVA'` (situação cadastral ativa)
- `rootEligible = true` (raiz não recebeu onboarding antes)
- `nameSimilarity >= 0.6` (com razão social OU nome fantasia)
- `cityMatch = true` (cidade informada ≈ cidade oficial, ignorando acentos e case)
- `stateMatch = true` (UF informada = UF oficial)

Se todas verdadeiras → APPROVE. Se alguma falhar → avalia REVIEW/REJECT.

**Regras de rejeição (REJECT):**
- `cnpjExists = false` (CNPJ inexistente na Receita) — **bloqueia criação**
- `situacaoCadastral = 'BAIXADA'` ou `'NULA'` — **reject** (loja criada sem créditos, sem approve automático)
- `rootEligible = false` — **bloqueia freemium** (raiz já usou, tratado na F32)

**Regras de revisão (REVIEW):**
- `situacaoCadastral = 'SUSPENSA'` ou demais não-ATIVA (tolerância, mas não approve automático)
- Qualquer divergência de nome, cidade ou UF que não seja rejeição pura

**Regras de adiamento (DEFER):**
- `officialData = null` (API indisponível, timeout, rate limit em ambas)

**Sobreposição admin:** Para casos onde o CNPJ existe mas foi rejeitado (BAIXADA, NULA, raiz esgotada) ou está em DEFER, o admin pode conceder créditos via ação "Exceção" na fila de revisão, que usa `benefit_type = 'admin_exception'` e bypassa as regras de elegibilidade. **CNPJ inexistente não pode ser criado pelo onboarding público** — não há dados oficiais para preencher. Para testes, o admin usa o fluxo específico de criação de store de teste (ver D10).

### D5 — Lookup assíncrono no formulário

`DECIDIDO`

A consulta à API acontece **no evento de blur/validação do campo CNPJ**, após validação local de dígitos. Não no submit do formulário. Isso permite:

1. Feedback imediato ao usuário ("Buscando dados...")
2. Pré-preenchimento antes do usuário preencher o resto
3. Submit usa dados oficiais já resolvidos ou estado DEFER

O **frontend** não dispara consulta externa no submit — ela ocorre no blur. O **backend** não confia no estado vindo do client: se o `verification_service` não encontrar dados em cache ou resolvidos no momento do submit, ele tenta resolver server-side. Se os providers retornarem `not_found`, a criação é bloqueada. Se os providers estiverem indisponíveis (`unavailable`), marca como `defer` e cria a loja sem créditos. A política de resolução é controlada no servidor, não no cliente.

### D6 — CNAE armazenado como sinal fraco

`DECIDIDO`

O CNAE principal é armazenado em `stores.cnpj_official_data` (JSONB) para:

1. Consulta futura pelo admin durante revisão manual
2. Sinal auxiliar em regras futuras de compatibilidade
3. Análise de distribuição de segmentos vs CNAEs reais

**Não** é usado para decisão automática de approve/review/reject na F33. Se no futuro houver mapping CNAE → segmento, será uma camada adicional.

### D7 — Admin review mínima, mas operacional

`DECIDIDO`

A fila de revisão admin é uma página nova em `/admin/reviews`. Ela cobre REVIEW, DEFER e REJECTED com abas/filtros — permitindo que o admin atue também em lojas com CNPJ baixado/nulo (rejected) ou com consulta Falha (defer). **CNPJ inexistente não entra na fila** — bloqueia a criação pública, então não há store para revisar.

```
┌──────────────────────────────────────────────────────────┐
│ /admin/reviews                                            │
│                                                          │
│ [Pendentes (5)] [Aprovados] [Recusados]                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐    │
│ │ Loja: "Minha Loja"  |  CNPJ: **.***.***/0001-**   │    │
│ │ Usuário: email@teste.com  |  Criada: 28/07        │    │
│ │ Motivos: nome_divergente, cidade_divergente        │    │
│ │ Dados oficiais: [expandir]                         │    │
│ │ [Revelar CNPJ] [Consultar na Receita]              │    │
│ │ [Aprovar] [Recusar] [Conceder Exceção]             │    │
│ ├────────────────────────────────────────────────────┤    │
│ │ Loja: "Outra Loja" |  CNPJ: **.***.***/0002-**    │    │
│ │ ...                                                │    │
│ └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

- Paginação simples
- Filtro por motivo de revisão
- Ações registradas em `admin_audit_log`
- CNPJ mascarado na listagem, com dois botões auxiliares:
  - **Revelar CNPJ**: mostra CNPJ completo na página de detalhe (auditado)
  - **Consultar na Receita**: abre BrasilAPI/CNPJá em nova aba
- Três ações de decisão com semântica distinta:
  - **Aprovar**: tenta conceder `onboarding` normal (se raiz elegível)
  - **Recusar**: mantém rejeitado, sem créditos
  - **Exceção**: concede via `admin_exception` (reusa fluxo F32, bypassa elegibilidade)

### D8 — Privacidade e termos

`DECIDIDO`

A Política de Privacidade v1.1 (publicada na F32) já documenta a finalidade "prevenir abuso, fraude e múltiplos cadastros promocionais" com base legal em legítimo interesse (art. 7, IX, LGPD). A F33 deve:

1. **Confirmar** que consulta cadastral externa e cross-check automatizado se enquadram nesta finalidade
2. **Não exige** nova versão de privacidade se o jurídico confirmar o enquadramento
3. **Opcional:** publicar errata ou adendo na política deixando explícito que a consulta é feita via BrasilAPI/CNPJá com dados da Receita Federal
4. A mensagem ao usuário (ver D9) serve como transparência no momento da coleta

### D9 — Mensagens ao usuário

`DECIDIDO`

Mensagens padrão para cada estado:

| Contexto | Mensagem |
|----------|----------|
| **Campo CNPJ (ao digitar)** | "Verificamos os dados do CNPJ para liberar os créditos gratuitos." (tooltip ou texto auxiliar) |
| **Lookup em andamento** | "Consultando dados cadastrais..." (spinner ao lado do campo) |
| **Lookup concluído (dados resolvidos)** | "Dados carregados da Receita Federal." (check verde) |
| **Lookup falhou (DEFER)** | "Não foi possível consultar os dados deste CNPJ agora. A loja será criada sem créditos iniciais. Você pode tentar novamente em 'Dados da Loja'." (aviso amarelo) |
| **Submit — APPROVE** | "Loja criada com sucesso! Seus créditos de boas-vindas foram liberados." |
| **Submit — REVIEW** | "Loja criada. Seus créditos de boas-vindas serão liberados após verificação cadastral." |
| **Submit — REJECT (CNPJ inexistente)** | "Não foi possível criar a loja. O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente." |
| **Submit — REJECT (CNPJ baixado)** | "Loja criada. Este CNPJ está com situação cadastral baixada/inativa. Não é possível liberar créditos gratuitos para CNPJs inativos." |
| **Submit — REJECT (raiz já usou)** | "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas." (já implementado na F32) |
| **Submit — DEFER** | "Loja criada. Não foi possível verificar os dados cadastrais agora. Você pode tentar novamente em 'Dados da Loja'." |
| **Página de revisão admin** | N/A (admin tool, sem mensagem ao usuário final) |
| **Dashboard (loja em REVIEW)** | "Seus créditos de boas-vindas estão em verificação cadastral." (banner amarelo, sem bloquear navegação) |
| **Dashboard (após admin APPROVE)** | "Seus créditos de boas-vindas foram liberados!" (banner verde, one-time) |

### D10 — Store de teste (admin)

`DECIDIDO`

Para viabilizar QA, staging e demonstrações sem depender de CNPJ real, o admin pode criar stores de teste com CNPJ fictício:

```
┌─────────────────────────────────────────────────────────────┐
│ CRIAÇÃO DE STORE DE TESTE (admin)                           │
│                                                             │
│ /admin/users/[id]/create-test-store                         │
│                                                             │
│ Admin informa:                                               │
│ ├── CNPJ (fictício, 14 dígitos que passam na validação      │
│ │    local — não será consultado em API externa)             │
│ ├── Razão social (manual)                                   │
│ ├── Nome fantasia (manual, opcional)                        │
│ ├── Nome da loja                                            │
│ └── Segmento                                                │
│                                                             │
│ A loja é criada com:                                        │
│ ├── is_test_store = true                                    │
│ ├── verification_status = 'approved' (bypassa consulta)     │
│ ├── Sem freemium automático (entitlement não é inserido)     │
│ └── Registro em admin_audit_log com metadata de teste        │
│                                                             │
│ Admin pode conceder créditos manualmente (via grant existente │
│ da F32/F26) para testes.                                     │
│                                                             │
│ Lojas de teste são:                                          │
│ ├── Excluídas de métricas comerciais                         │
│ ├── Excluídas de relatórios antifraude                      │
│ ├── Excluídas de contagem de usuários ativos                │
│ └── Identificáveis no admin por badge "TESTE"               │
└─────────────────────────────────────────────────────────────┘
```

**Regras:**
- Store de teste **não substitui** o fluxo público de onboarding
- Não recebe freemium automático: `grant_monthly_credits` (cron) e `grant_onboarding` devem ignorar `is_test_store = true`
- Admin pode conceder créditos manuais (admin_grant) para viabilizar testes
- `is_test_store` é coluna booleana em `stores`, indexada, com default `false`
- Nenhuma store de teste entra em fila de revisão admin
- Store de teste pode ser convertida para real? **Não na F33** — se precisar, admin cria store real com CNPJ válido

### D11 — Revelação de CNPJ no admin

`DECIDIDO`

Para que o admin possa revisar casos sem pedir documento ao usuário, o CNPJ completo precisa ser acessível em contexto controlado:

```
┌─────────────────────────────────────────────────────────────┐
│ POLÍTICA DE EXIBIÇÃO DE CNPJ NO ADMIN                       │
│                                                             │
│ Listagens ( /admin/users, /admin/reviews )                  │
│   → CNPJ mascarado: **.***.***/0001-**                      │
│   → Não há opção de revelar em listagens                    │
│                                                             │
│ Página de detalhe/revisão ( /admin/users/[id],              │
│ /admin/reviews/[id] )                                       │
│   → CNPJ mascarado por padrão                                │
│   → Botão "Revelar CNPJ" que:                               │
│     ├── Exige permissão admin (já verificada por            │
│     │   requireAdmin())                                     │
│     ├── Registra em admin_audit_log:                         │
│     │   action = 'reveal_cnpj', target = store_id           │
│     ├── Mostra o CNPJ completo (14 dígitos)                 │
│     └── Mantém visível até navegar para outra página        │
│                                                             │
│ Ação complementar:                                          │
│   Botão "Consultar na Receita" → abre BrasilAPI ou CNPJá    │
│   em nova aba usando o CNPJ normalizado                     │
│   (apenas quando CNPJ está revelado ou já resolvido)        │
└─────────────────────────────────────────────────────────────┘
```

**Por que isso é necessário:**
- Sem o CNPJ visível, o admin precisaria pedir documento ao usuário por e-mail — fricção desnecessária
- A revelação auditada mantém rastreabilidade: quem viu, quando e por quê
- A consulta externa direta evita depender de sistemas terceiros de validação manual

---

## Dados / Banco

### Mudança crítica na RPC `create_store_with_cnpj` (F32)

A RPC `create_store_with_cnpj` criada na F32 atualmente **concede onboarding grant automaticamente** se a raiz for elegível (entitlement-first, grant-second). A F33 altera este comportamento:

```
ANTES (F32):
  RPC create_store_with_cnpj()
    → INSERT store
    → INSERT legal_acceptances
    → INSERT freemium_entitlements ON CONFLICT DO NOTHING
    → SE entitlement inserido: grant_credits(10) ← automático
    → response: { onboardingGranted: true/false }

DEPOIS (F33):
  RPC create_store_with_cnpj() ★ MODIFICADA
    → INSERT store (com verification_status vindo da avaliação)
    → INSERT legal_acceptances
    → SÓ concede grant se decision = 'approve'
      (approve: grant_credits(10), demais: sem grant)
    → response: { onboardingGranted: true/false, verification_status }
```

A lógica de decisão (`approve`/`review`/`reject`/`defer`) é calculada na **rota Next.js** (server-side) antes de chamar a RPC, usando `freemium-risk-service.ts`. A RPC recebe o `verification_status` já decidido como parâmetro e não repete a avaliação.

### Migration SQL: `20260728000001_f33_cnpj_verification.sql`

```sql
-- ============================================================
-- F33 — Verificação de CNPJ para Liberação do Freemium
-- ============================================================

-- 1. Novas colunas em stores
ALTER TABLE public.stores ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE public.stores ADD COLUMN verification_data JSONB DEFAULT NULL;
ALTER TABLE public.stores ADD COLUMN cnpj_official_data JSONB DEFAULT NULL;
ALTER TABLE public.stores ADD COLUMN cnpj_lookup_hash TEXT DEFAULT NULL;
ALTER TABLE public.stores ADD COLUMN verification_requested_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.stores ADD COLUMN verification_decided_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.stores ADD COLUMN verification_reasons TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.stores.verification_status IS 
  'Status da verificação cadastral do CNPJ. Valores: unverified | pending | approved | review | rejected | defer';
COMMENT ON COLUMN public.stores.verification_data IS 
  'JSONB com resultado completo da avaliação: decision, score, signals, reasons';
COMMENT ON COLUMN public.stores.cnpj_official_data IS 
  'JSONB com dados oficiais retornados pela consulta: razao_social, nome_fantasia, situacao, endereco, cnae';
COMMENT ON COLUMN public.stores.cnpj_lookup_hash IS 
  'Hash do payload de consulta para identificar consultas duplicadas/reprocessamento';

-- Coluna para store de teste (admin)
ALTER TABLE public.stores ADD COLUMN is_test_store BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.is_test_store IS 
  'Marca loja como criada por admin para teste. Excluída de freemium automático, métricas e relatórios antifraude.';

-- Index para fila admin (cobre review, defer e rejected para admin review)
CREATE INDEX idx_stores_verification_status ON public.stores (verification_status) 
  WHERE verification_status IN ('review', 'defer', 'pending', 'rejected');

-- Index para consulta por hash
CREATE INDEX idx_stores_cnpj_lookup_hash ON public.stores (cnpj_lookup_hash) 
  WHERE cnpj_lookup_hash IS NOT NULL;

-- Index para exclusão de lojas de teste de métricas/relatórios/cron
CREATE INDEX idx_stores_is_test_store ON public.stores (is_test_store) WHERE is_test_store = TRUE;


-- 2. Tabela de cache de lookup CNPJ
CREATE TABLE public.cnpj_lookup_cache (
  cnpj_normalized TEXT PRIMARY KEY,
  outcome TEXT NOT NULL CHECK (outcome IN ('resolved', 'not_found')),
  result_data JSONB,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  CONSTRAINT ck_cnpj_cache_data CHECK (
    (outcome = 'resolved' AND result_data IS NOT NULL AND provider IS NOT NULL)
    OR
    (outcome = 'not_found' AND result_data IS NULL AND provider IS NULL)
  )
);

COMMENT ON TABLE public.cnpj_lookup_cache IS 
  'Cache de consultas de CNPJ. outcome=resolved: dados oficiais da Receita. outcome=not_found: CNPJ inexistente (evita reconsulta). unavailable não é cacheado (transitório). TTL 24h.';

CREATE INDEX idx_cnpj_lookup_cache_expires ON public.cnpj_lookup_cache (expires_at);

-- Política de limpeza: registros expirados podem ser deletados a qualquer momento
-- (job manual ou trigger, não crítico - o cache é verificado por expires_at)


-- 3. RLS para cache (apenas service_role)
ALTER TABLE public.cnpj_lookup_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_cnpj_lookup_cache"
  ON public.cnpj_lookup_cache FOR ALL TO service_role USING (true) WITH (check);

REVOKE ALL ON public.cnpj_lookup_cache FROM anon, authenticated;
GRANT ALL ON public.cnpj_lookup_cache TO service_role;


-- 4. Check constraint em verification_status
ALTER TABLE public.stores ADD CONSTRAINT chk_verification_status 
  CHECK (verification_status IN ('unverified', 'pending', 'approved', 'review', 'rejected', 'defer'));


-- 5. RPC para atualizar verificação
-- (quando loja é reprocessada após DEFER, ou admin altera status)

CREATE OR REPLACE FUNCTION public.update_store_verification(
  p_store_id UUID,
  p_verification_status TEXT,
  p_verification_data JSONB DEFAULT NULL,
  p_cnpj_official_data JSONB DEFAULT NULL,
  p_verification_reasons TEXT[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE public.stores SET
    verification_status = p_verification_status,
    verification_data = COALESCE(p_verification_data, verification_data),
    cnpj_official_data = COALESCE(p_cnpj_official_data, cnpj_official_data),
    verification_reasons = COALESCE(p_verification_reasons, verification_reasons),
    verification_decided_at = CASE 
      WHEN p_verification_status IN ('approved', 'review', 'rejected') THEN now()
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_store_id
  RETURNING jsonb_build_object(
    'id', id,
    'verification_status', verification_status,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- 6. RPC para concessão de onboarding após aprovação admin

CREATE OR REPLACE FUNCTION public.admin_approve_store_verification(
  p_store_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
  v_root_hash TEXT;
  v_store_name TEXT;
  v_entitlement_id UUID;
  v_tx_id UUID;
BEGIN
  -- Valida: loja existe e está em REVIEW
  SELECT s.cnpj_root_hash, s.name INTO v_root_hash, v_store_name
  FROM public.stores s WHERE s.id = p_store_id;
  
  IF v_root_hash IS NULL THEN
    RAISE EXCEPTION 'store_not_found_or_no_cnpj';
  END IF;

  -- Atualiza status
  UPDATE public.stores SET
    verification_status = 'approved',
    verification_decided_at = now(),
    verification_reasons = COALESCE(verification_reasons, '{}') || 
      ARRAY['admin_approved:' || COALESCE(p_reason, 'manual_review')],
    updated_at = now()
  WHERE id = p_store_id;

  -- Tenta conceder entitlement ONBOARDING NORMAL (não admin_exception)
  -- Se a raiz ainda estiver elegível, o INSERT vence e os créditos são concedidos
  -- Se a raiz já consumiu onboarding, ON CONFLICT silencia e não concede
  INSERT INTO public.freemium_entitlements
    (store_id, root_hash, benefit_type, reason, granted_by)
  VALUES
    (p_store_id, v_root_hash, 'onboarding', 
     COALESCE(p_reason, 'Aprovado em revisão manual'), p_admin_id)
  ON CONFLICT (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))
    DO NOTHING
  RETURNING id INTO v_entitlement_id;

  -- Se entitlement foi inserido, concede créditos
  IF v_entitlement_id IS NOT NULL THEN
    v_tx_id := public.grant_credits(
      p_store_id, 10, 'admin_grant',
      'admin_review_approve_' || p_store_id,
      '{}'::jsonb, 'bonus_onboarding'
    );

    UPDATE public.freemium_entitlements
    SET grant_transaction_id = v_tx_id
    WHERE id = v_entitlement_id;
  END IF;
  -- Se não concedeu (raiz já usou), a loja fica APPROVED sem créditos
  -- Admin pode usar ação "Exceção" separada para bypassar

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'verification_status', s.verification_status,
    'onboarding_granted', v_entitlement_id IS NOT NULL,
    'updated_at', s.updated_at
  ) INTO v_store_data
  FROM public.stores s WHERE s.id = p_store_id;

  -- Registra no audit log
  INSERT INTO public.admin_audit_log
    (actor_id, action, target_type, target_id, metadata)
  VALUES
    (p_admin_id, 'approve_verification', 'store', p_store_id,
     jsonb_build_object(
       'reason', p_reason,
       'onboarding_granted', v_entitlement_id IS NOT NULL,
       'entitlement_id', v_entitlement_id
     ));

  RETURN v_store_data;
END;
$$;

-- RPC para recusar verificação (admin)
CREATE OR REPLACE FUNCTION public.admin_reject_store_verification(
  p_store_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE public.stores SET
    verification_status = 'rejected',
    verification_decided_at = now(),
    verification_reasons = COALESCE(verification_reasons, '{}') || 
      ARRAY['admin_rejected:' || COALESCE(p_reason, 'manual_rejection')],
    updated_at = now()
  WHERE id = p_store_id
  RETURNING jsonb_build_object(
    'id', id,
    'name', name,
    'verification_status', verification_status,
    'updated_at', updated_at
  ) INTO v_result;

  INSERT INTO public.admin_audit_log
    (actor_id, action, target_type, target_id, metadata)
  VALUES
    (p_admin_id, 'reject_verification', 'store', p_store_id,
     jsonb_build_object('reason', p_reason));

  RETURN v_result;
END;
$$;

-- 7. RPC para criar store de teste (admin)

CREATE OR REPLACE FUNCTION public.admin_create_test_store(
  p_user_id UUID,
  p_admin_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_cnpj_normalized TEXT,
  p_razao_social TEXT,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_store_data JSONB;
BEGIN
  -- Cria loja marcada como teste
  INSERT INTO public.stores (
    user_id, name, segment, city, state,
    cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia,
    verification_status, is_test_store
  ) VALUES (
    p_user_id, p_name, p_segment, p_city, p_state,
    p_cnpj_normalized, '', p_razao_social, p_nome_fantasia,
    'approved', true
  ) RETURNING id INTO v_store_id;

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'is_test_store', s.is_test_store,
    'verification_status', s.verification_status,
    'created_at', s.created_at
  ) INTO v_store_data
  FROM public.stores s WHERE s.id = v_store_id;

  INSERT INTO public.admin_audit_log
    (actor_id, action, target_type, target_id, metadata)
  VALUES
    (p_admin_id, 'create_test_store', 'store', v_store_id,
     jsonb_build_object(
       'store_name', p_name,
       'cnpj_masked', overlay(p_cnpj_normalized placing '********' from 1 for 8),
       'target_user', p_user_id
     ));

  RETURN v_store_data;
END;
$$;
```

---

## Serviços

### Estrutura de código

```
src/lib/cnpj/                           (expandido)
├── types.ts                            + CnpjLookupResult, CnpjLookupProvider
├── validate.ts                         (já existe)
├── normalize.ts                        (já existe)
├── hash.ts                             (já existe)
├── mask.ts                             (já existe)
├── similarity.ts                       (já existe)
├── verification-service.ts             ★ NOVO
│       resolveCnpj(cnpj) → CnpjLookupResult | 'defer'
│         orquestra: cache → BrasilAPI → CNPJá → cache
│
└── lookup-providers/
    ├── types.ts                        ★ NOVO
    │       interface CnpjLookupProvider { lookup(cnpj): Promise<LookupResult | null> }
    ├── brasil-api.ts                   ★ NOVO
    │       GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}
    │       timeout 5s, retry 1x
    └── cnpja.ts                        ★ NOVO
            GET https://api.cnpja.com.br/companies/{cnpj}
            timeout 5s, retry 1x

src/lib/freemium/                       (expandido)
├── types.ts                            + FreemiumEligibilityInput, Output, Decision, Signal
├── entitlement-service.ts              (já existe)
└── freemium-risk-service.ts            ★ NOVO
        evaluate({ cnpj, storeName, city, state, segment,
                    officialData, userId, rootHash })
        → { decision, reasons, score, signals }
        regras puras (sem ML, sem IA)

src/app/api/store/route.ts              ★ MODIFICADO
  - Após validar CNPJ, usa verification-service para resolver dados
  - Usa freemium-risk-service para decidir elegibilidade
  - Condiciona grant à decisão (approve = grant, demais = sem grant)
  - Passa verification_status + verification_data para RPC

src/components/flow/store-identity-form.tsx  ★ MODIFICADO
  - CNPJ: lookup assíncrono onBlur (não no submit)
  - Estado loading "Consultando dados cadastrais..."
  - Razão social bloqueada (se dados resolvidos)
  - Nome fantasia bloqueado (se dados resolvidos)
  - Botão "Usar nome fantasia" / "Usar razão social"
  - Endereço pré-preenchido quando disponível
  - Mensagens de status da verificação

src/app/(app)/admin/
├── users/page.tsx                      ★ MODIFICADO
│     + coluna verification_status + filtro
├── users/[id]/page.tsx                 ★ MODIFICADO
│     + card de verificação cadastral com dados oficiais
│     + botão de reprocessar (para DEFER)
└── reviews/page.tsx                    ★ NOVO
      fila de revisão admin
      listar pendentes, aprovar, recusar, exceção

supabase/migrations/
└── 20260728000001_f33_cnpj_verification.sql  ★ NOVA
```

### Verification Service (orquestrador)

```typescript
// src/lib/cnpj/verification-service.ts

type LookupOutcome =
  | { status: 'resolved'; data: CnpjLookupData }
  | { status: 'not_found' }    // CNPJ inexistente na Receita → reject/bloqueio
  | { status: 'unavailable' }; // provider falhou/timeout → defer

export class CnpjVerificationService {
  constructor(
    private primaryProvider: CnpjLookupProvider,   // BrasilAPI
    private fallbackProvider: CnpjLookupProvider,  // CNPJá
    private cache: CnpjLookupCache
  ) {}

  async resolve(cnpj: string): Promise<LookupOutcome> {
    // 1. Tenta cache (inclui not_found cacheado)
    const cached = await this.cache.get(cnpj);
    if (cached && cached.expiresAt > new Date()) {
      if (cached.outcome === 'not_found') return { status: 'not_found' };
      return { status: 'resolved', data: cached.data };
    }

    // 2. Tenta provedor primário
    const primary = await this.primaryProvider.lookup(cnpj);
    if (primary.status === 'resolved') {
      await this.cache.set(cnpj, { outcome: 'resolved', data: primary.data });
      return { status: 'resolved', data: primary.data };
    }
    if (primary.status === 'not_found') {
      await this.cache.set(cnpj, { outcome: 'not_found' }); // cacheia pra não reconsultar
      return { status: 'not_found' };
    }
    // primary unavailable → tenta fallback

    // 3. Tenta fallback
    const fallback = await this.fallbackProvider.lookup(cnpj);
    if (fallback.status === 'resolved') {
      await this.cache.set(cnpj, { outcome: 'resolved', data: fallback.data });
      return { status: 'resolved', data: fallback.data };
    }
    if (fallback.status === 'not_found') {
      await this.cache.set(cnpj, { outcome: 'not_found' });
      return { status: 'not_found' };
    }

    // 4. Ambos unavailable → defer (não cacheia — pode ser transitório)
    return { status: 'unavailable' };
  }
}
```

**Diferença chave:** `not_found` ≠ `unavailable`. O primeiro é definitivo (CNPJ não existe) e gera REJECT com bloqueio de criação. O segundo é temporário (API fora do ar) e gera DEFER. `not_found` é cacheado para evitar reconsultar CNPJ sabidamente inexistente.

### Risk Service (motor de decisão)

```typescript
// src/lib/freemium/freemium-risk-service.ts

export function evaluateFreemiumEligibility(
  input: FreemiumEligibilityInput
): FreemiumEligibilityOutput {
  const signals = computeSignals(input);
  const decision = decide(signals);
  const score = computeScore(signals);

  return { decision, reasons: buildReasons(signals), score, signals };
}

function computeSignals(input: FreemiumEligibilityInput): Signals {
  if (!input.officialData) {
    return { /* todos null ou false */ };
  }

  return {
    cnpjExists: true, // se officialData existe
    situacaoCadastral: input.officialData.situacao_cadastral,
    rootEligible: /* check via entitlement service */,
    nameSimilarity: Math.max(
      similarity(input.storeName, input.officialData.razao_social),
      input.officialData.nome_fantasia
        ? similarity(input.storeName, input.officialData.nome_fantasia)
        : 0
    ),
    cityMatch: normalizeCity(input.city) === normalizeCity(input.officialData.cidade),
    stateMatch: input.state.toUpperCase() === input.officialData.uf.toUpperCase(),
    cnaeCompatible: null, // sinal fraco, não avaliado na F33
  };
}

function decide(signals: Signals): Decision {
  // REJECT conditions (hard blocks)
  if (!signals.cnpjExists) return 'reject';
  if (signals.situacaoCadastral === 'BAIXADA' || signals.situacaoCadastral === 'NULA') {
    return 'reject';
  }
  if (!signals.rootEligible) return 'reject';

  // Não aprova automaticamente se situação ≠ ATIVA
  if (signals.situacaoCadastral !== 'ATIVA') return 'review';

  // APPROVE conditions (all must pass)
  if (
    signals.nameSimilarity !== null && signals.nameSimilarity >= 0.6 &&
    signals.cityMatch === true &&
    signals.stateMatch === true
  ) {
    return 'approve';
  }

  // Otherwise → REVIEW
  return 'review';
}
```

---

## Admin

### Página nova: `/admin/reviews`

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚑ Revisão Cadastral                    [Painel Admin]              │
│                                                                     │
│  ┌─ Abas ──────────────────────────────────────────────────────────┐│
│  │ ● Pendentes (3)  │  ○ Aprovados  │  ○ Recusados  │              ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ ┌──────────────────────────────────────────────────────────────┐ ││
│  │ │ Loja: "Ana's Boutique"                         28/07 14:32   │ ││
│  │ │ Email: ana@email.com   |   CNPJ: **.***.***/0001-**         │ ││
│  │ │                                                              │ ││
│  │ │ Motivos:                                                     │ ││
│  │ │   ⚠ nome_divergente — "Ana's Boutique" ≠ "ANA BOUTIQUE     │ ││
│  │ │     LTDA" (score: 0.35)                                      │ ││
│  │ │   ⚠ cidade_divergente — "São Paulo" ≠ "São Bernardo do     │ ││
│  │ │     Campo"                                                    │ ││
│  │ │                                                              │ ││
│  │ │ Dados oficiais (BrasilAPI): [expandir]                       │ ││
│  │ │   ┌──────────────────────────────────────────────────────┐  │ ││
│  │ │   │ Razão Social: ANA BOUTIQUE LTDA                      │  │ ││
│  │ │   │ Situação: ATIVA (desde 10/01/2020)                   │  │ ││
│  │ │   │ Endereço: Rua X, 123 - Centro - São Bernardo do      │  │ ││
│  │ │   │   Campo/SP - 09700-000                                │  │ ││
│  │ │   │ CNAE: 4781-4/00 - Comércio varejista de artigos do   │  │ ││
│  │ │   │   vestuário e acessórios                              │  │ ││
│  │ │   └──────────────────────────────────────────────────────┘  │ ││
│  │ │                                                              │ ││
│  │ │ [✓ Aprovar] [✗ Recusar] [✦ Conceder Exceção]               │ ││
│  │ └──────────────────────────────────────────────────────────────┘ ││
│  │ ┌──────────────────────────────────────────────────────────────┐ ││
│  │ │ Loja: "Padaria do João"                        28/07 15:01   │ ││
│  │ │ ...                                                          │ ││
│  │ └──────────────────────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  Página 1 de 3  [<] [1] [2] [3] [>]                                │
└─────────────────────────────────────────────────────────────────────┘
```

### API Admin

| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/admin/reviews` | Lista lojas em REVIEW (ou APPROVED/REJECTED com filtro) |
| GET | `/api/admin/reviews/[id]` | Detalhe de uma revisão (dados oficiais, sinais, motivos) |
| POST | `/api/admin/reviews/[id]/approve` | Aprova verificação → concede onboarding normal (se raiz elegível) + audit log |
| POST | `/api/admin/reviews/[id]/reject` | Recusa verificação → status REJECTED + audit log |
| POST | `/api/admin/reviews/[id]/exception` | Concede exceção manual (`admin_exception`, bypassa elegibilidade) + audit log |
| POST | `/api/admin/reviews/[id]/reveal-cnpj` | Revela CNPJ completo (retorna `{ cnpj: string }`) + registra em `admin_audit_log` |
| POST | `/api/admin/stores/create-test` | Cria store de teste com CNPJ fictício + dados manuais + audit log |

### Integração com admin existente

- A página `/admin/users/[id]` ganha um card "Verificação Cadastral" com status, dados oficiais e botão "Revelar CNPJ"
- A página `/admin/users` ganha filtro por `verification_status`
- O menu admin ganha link "Revisão" (ou "Revisão Cadastral") apontando para `/admin/reviews`
- Todas as ações de approve/reject/reveal/test-store são registradas em `admin_audit_log` (padrão F26/F30)
- Lojas com `is_test_store = true` são identificadas por badge "TESTE" no admin e excluídas de métricas/relatórios

---

## Mensagens ao Usuário

### Tooltip no campo CNPJ (microcopy inline)

> "Verificamos os dados do CNPJ para liberar os créditos gratuitos."

### Mensagens de lookup (inline, ao lado do campo)

| Estado | Mensagem | Tipo |
|--------|----------|------|
| Validando dígitos | — | (silencioso, validação local) |
| Consultando API | "Consultando dados cadastrais..." | Spinner azul |
| Sucesso | "Dados carregados da Receita Federal." | Check verde |
| Falha (defer) | "Não foi possível consultar os dados agora." | Aviso amarelo |

### Mensagens de submit

| Decisão | Mensagem | Tipo |
|---------|----------|------|
| APPROVE | "Loja criada com sucesso! Seus créditos de boas-vindas foram liberados." | Sucesso verde |
| REVIEW | "Loja criada. Seus créditos de boas-vindas serão liberados após verificação cadastral." | Aviso amarelo |
| REJECT (inexistente) | "Não foi possível criar a loja. O CNPJ informado não foi encontrado na Receita Federal." | Erro vermelho (bloqueia) |
| REJECT (baixado) | "Loja criada. Este CNPJ está com situação cadastral inativa." | Aviso amarelo |
| REJECT (raiz) | "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas." | Informativo azul |
| DEFER | "Loja criada. Não foi possível verificar os dados cadastrais agora. Você pode tentar novamente em 'Dados da Loja'." | Aviso amarelo |

### Banner no dashboard (loja em REVIEW)

> "Seus créditos de boas-vindas estão em verificação cadastral."

### Banner no dashboard (após admin APPROVE)

> "Seus créditos de boas-vindas foram liberados!" (one-time, dismissível)

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **BrasilAPI fora do ar** | Fallback CNPJá + cache. Se ambos falharem, DEFER (loja criada sem créditos) |
| **Rate limit em ambas APIs** | Cache reduz chamadas repetidas. DEFER com reprocessamento manual |
| **Falso positivo no cross-check** — lojista legítimo com endereço cadastral desatualizado na Receita | Approve é tolerante: nome ≥ 0.6, cidade case-insensitive. Divergência vira REVIEW (não bloqueio) |
| **Falso negativo — lojista com nome de loja muito diferente da razão social** | APPROVE aceita nome fantasia também. Se não houver match, vai para REVIEW (não REJECT) |
| **Custo de consulta** (se CNPJá for paga) | Cache reduz chamadas. Avaliar custo vs volume de cadastros. BrasilAPI é gratuita |
| **Performance do onboarding** — lookup adiciona latência | Lookup é assíncrono no blur, não no submit. Cache reduz latência nas repetições |
| **Admin review vira gargalo** — muitos casos REVIEW sem capacidade de revisão | Regras de APPROVE são tolerantes para minimizar falsos positivos. Se necessário, ajustar thresholds |
| **Loja em DEFER permanente** — API nunca responde | Reprocessamento manual via botão "Tentar novamente" no formulário. Admin pode conceder exceção |
| **CNPJ mudou de situação depois da verificação** (ex: ativo → baixado) | A verificação é um snapshot no momento do cadastro. Re-verificação não é automática na F33 |

---

## Ondas de Implementação

| Onda | Blocos | Artefatos | Testes |
|------|--------|-----------|--------|
| **1 — Lookup + Cache + Serviço de Verificação** | A, B | `lookup-providers/types.ts`, `brasil-api.ts`, `cnpja.ts`, `verification-service.ts`, `freemium-risk-service.ts`, migration (cache + colunas) | Lookup bem-sucedido, lookup falha, cache hit/miss, fallback, timeout, rate limit, decisões approve/review/reject/defer |
| **2 — Onboarding Modificado + Grant Condicional** | C, D | Formulário com lookup assíncrono, campos bloqueados, botões, submit condicional, store route modificada | Fluxo feliz (approve + grant), review cria loja sem créditos, reject bloqueia/bloqueia parcial, defer cria sem créditos, reprocessamento |
| **3 — Admin Review + Privacidade + Testes Finais** | E, F, G | `/admin/reviews` page, API admin, audit log, mensagens, termos (se necessário) | Fila admin, approve/reject/exception, audit trail, regressão geral |

---

## Critérios de Aceite

### Onda 1 — Lookup + Serviço de Decisão

- [ ] `resolveCnpj(cnpj)` consulta cache primeiro
- [ ] Cache miss → consulta BrasilAPI
- [ ] BrasilAPI falha → fallback CNPJá
- [ ] Ambos indisponíveis → retorna `unavailable` (gera DEFER)
- [ ] Provider retorna `not_found` → bloqueia criação (REJECT)
- [ ] Sucesso → armazena em cache com TTL 24h
- [ ] Cache expirado → consulta novamente
- [ ] `evaluateFreemiumEligibility()` retorna decisão correta para cada combinação de sinais
- [ ] APPROVE quando todos os sinais positivos
- [ ] REVIEW quando nome ou endereço divergem
- [ ] REJECT quando CNPJ inexistente, baixado, ou raiz já usou
- [ ] DEFER quando lookup retornou `defer`
- [ ] CNAE é armazenado mas NÃO usado na decisão

### Onda 2 — Onboarding Modificado

- [ ] Formulário consulta CNPJ ao sair do campo (blur), não no submit
- [ ] Loading state "Consultando dados cadastrais..." durante lookup
- [ ] Razão social aparece bloqueada e pré-preenchida após lookup
- [ ] Nome fantasia aparece bloqueado e pré-preenchido após lookup
- [ ] Botão "Usar nome fantasia" copia nome fantasia para nome da loja
- [ ] Botão "Usar razão social" aparece quando não há nome fantasia
- [ ] Endereço pré-preenchido (CEP, rua, bairro, cidade, UF) quando disponível
- [ ] Endereço permanece editável mesmo quando pré-preenchido
- [ ] Submit APPROVE → loja criada + grant de 10 créditos + mensagem de sucesso
- [ ] Submit REVIEW → loja criada sem grant + mensagem de revisão
- [ ] Submit REJECT (CNPJ inexistente) → **bloqueia criação** + mensagem de erro
- [ ] Submit REJECT (CNPJ baixado/nulo) → loja criada sem grant + mensagem
- [ ] Submit REJECT (raiz já usou) → loja criada sem grant + mensagem (reusa F32)
- [ ] Submit DEFER → loja criada sem grant + mensagem + possibilidade de reprocessar
- [ ] Dashboard mostra banner para lojas em REVIEW

### Onda 3 — Admin Review + Test Stores

- [ ] `/admin/reviews` com abas/filtros para REVIEW, DEFER e REJECTED
- [ ] CNPJ inexistente (not_found) não entra na fila (bloqueia criação pública)
- [ ] Aba DEFER permite reprocessar ou conceder exceção
- [ ] Aba REJECTED permite conceder exceção mesmo para CNPJ baixado/nulo
- [ ] Paginação funcional
- [ ] Cada item mostra: nome da loja, **CNPJ mascarado**, email do usuário, motivos, data
- [ ] Dados oficiais expansíveis (razão social, endereço, CNAE, situação)
- [ ] Botão "**Revelar CNPJ**" na página de detalhe: mostra CNPJ completo + registra em `admin_audit_log`
- [ ] Botão "**Consultar na Receita**" abre BrasilAPI/CNPJá em nova aba
- [ ] Aprovar → tenta conceder `onboarding` normal (se raiz elegível) + status APPROVED + audit log
- [ ] Recusar → status REJECTED + audit log
- [ ] Exceção → grant manual com `admin_exception` + audit log (bypassa elegibilidade)
- [ ] `/admin/users` mostra `verification_status` e permite filtrar
- [ ] `/admin/users/[id]` mostra card de verificação cadastral
- [ ] Todas as ações admin registradas em `admin_audit_log`
- [ ] Mensagens ao usuário corretas em cada cenário
- [ ] Admin pode criar store de teste com CNPJ fictício + dados manuais
- [ ] Store de teste marcada como `is_test_store = true`
- [ ] Store de teste não recebe freemium automático
- [ ] Store de teste identificável por badge "TESTE" no admin
- [ ] Store de teste excluída de métricas comerciais e relatórios antifraude
- [ ] Criação de store de teste registrada em `admin_audit_log`

### Regressão

- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido
- [ ] Testes existentes da F32 continuam passando
- [ ] Testes existentes de F30, F24, F29.3 continuam passando
- [ ] CNPJ cru não aparece em logs, URLs, listagens admin ou responses públicas desnecessárias; no client só aparece no fluxo do próprio usuário autenticado
- [ ] `root_hash` continua usando HMAC-SHA256 com pepper server-side

---

*Baseado na exploração do código pós-F32, análise das decisões de arquitetura existentes, alinhamento de escopo entre agentes, e refinamento dos comportamentos por decisão.*

*Próximo passo: sua revisão e aprovação para iniciar o proposal OpenSpec.*
