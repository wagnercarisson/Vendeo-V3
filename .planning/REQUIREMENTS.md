# Requirements: Vendeo V3

**Status operacional:** a **F56.1 — Contrato produtivo, modelos e fallback** está com **COBERTURA CONCLUÍDA** (11/11 planos GSD; UAT humano local aprovado; GSD 10/10; OpenSpec 55/55; verificada/sincronizada/arquivada em 2026-10-06 em `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/`), com os 27 REQ-IDs mapeados dos 8 specs OpenSpec da change agora arquivada.

**Estado atual:** F50 — Demonstração Gratuita e Validade dos Créditos — está concluída (17/17 planos, 17/17 summaries, 10 waves). F50.1 — Formalização Legal e Ativação da Demonstração — é futura, não ativa, ainda não planejada e aguarda a constituição da PJ. F50.1 ainda não possui REQ-IDs. F56.1 foi formalmente registrada no ROADMAP em 2026-10-05 e possui 27 REQ-IDs; a **F56.2a — Preparação não operacional do Produto 1:1** foi verificada, sincronizada e arquivada em 2026-10-07 com cobertura concluída (19 REQ-IDs; 6/6 planos, 31/31 tasks; UAT 4 pass + 1 N/A; segurança 20/20). F56.2b1 e F56.2b2 permanecem ativas/futuras, sem cobertura concluída atribuída nesta atualização; F56.2b1 mantém como pré-requisito investigar o warning HTTP 502 da F56.2a. A **F51.1 — Landing visual de produto** é uma **frente paralela deste worktree** (`escopo/landing`), registrada em 2026-10-08 e **em execução — Plano 08 pendente de validação e aprovação**, com **10 REQ-IDs** (`REQ-51.1-01`..`REQ-51.1-10`) derivados das duas capacidades OpenSpec da change ativa `fase-51-1-landing-visual-produto`; ela não substitui a fase ativa e não altera IDs, conteúdos ou status dos requisitos F56. A **F51.2 — Fundação SEO / descoberta orgânica** é a fatia técnica sucessora na **mesma frente paralela** (`escopo/landing`), registrada em 2026-10-12, com **18 REQ-IDs** (`REQ-51.2-01`..`REQ-51.2-18`) derivados das três capacidades OpenSpec da change ativa `fase-51-2-fundacao-seo-descoberta-organica`; ela está **planejada (planos aguardando revisão conjunta), não implementada**, não altera a posição global (F56.2a) nem os REQ-IDs/conteúdos/status da F56.

Este arquivo é um índice operacional, não uma tabela histórica. Checkboxes, tabelas e estados legados foram preservados integralmente em [`REQUIREMENTS-ARCHIVE.md`](./REQUIREMENTS-ARCHIVE.md) e não devem ser interpretados como pendências atuais.

## Índice Histórico

| Namespace / período | Fonte autoritativa atual |
|---|---|
| Requisitos legados v1.0–v1.2 | `.planning/milestones/*-REQUIREMENTS.md` e OpenSpec arquivado correspondente |
| F23–F30: fundação, pipeline, operação e base legal | `.planning/phases/23-*` a `.planning/phases/30-*`, summaries/verificações e `openspec/changes/archive/` |
| F31.1–F35: modelo comercial, elegibilidade, readiness e changelog | `.planning/phases/31-*` a `.planning/phases/35-*`, summaries/verificações e OpenSpec arquivado |
| F36–F43: onboarding, aprovação, custos, brief, mídia e signup | `.planning/phases/36-*` a `.planning/phases/43-*`, summaries/verificações e OpenSpec arquivado |
| F44.1.1, F45–F49: temas, direção de arte, gateway, catálogo, laboratório e orientação | `.planning/phases/44-*` a `.planning/phases/49-*`, summaries/verificações e OpenSpec arquivado |
| F50: demonstração gratuita e validade dos créditos | `.planning/phases/50-demonstracao-gratuita-validade-creditos/`, `50-VERIFICATION.md`, summaries e `openspec/changes/archive/2026-09-23-fase-50-demonstracao-gratuita-e-validade-dos-creditos/` |
| F50.1: formalização legal e ativação | Futura; fonte de planejamento será um novo plano/OpenSpec quando a fase for formalmente constituída |
| F56.1: contrato produtivo, modelos e fallback | Ativos abaixo; fonte `openspec/changes/fase-56-1-contrato-produtivo-modelos-fallback/` |
| F56.2a: preparação não operacional do Produto 1:1 | Cobertura concluída abaixo; fonte arquivada `openspec/changes/archive/2026-10-07-fase-56-2a-preparacao-nao-operacional-produto-1-1/` |
| F51.1: landing visual de produto | Frente paralela deste worktree; change OpenSpec **ativa** `openspec/changes/fase-51-1-landing-visual-produto/`; requisitos derivados abaixo (em execução — Plano 08 pendente de validação e aprovação) |
| F51.2: fundação SEO / descoberta orgânica | Frente paralela deste worktree; change OpenSpec **ativa** `openspec/changes/fase-51-2-fundacao-seo-descoberta-organica/`; requisitos derivados abaixo (planejada — planos aguardando revisão conjunta; não executada) |
| Monetização pública / Stripe | Iniciativa diferida para v1.7+, fora da numeração e sem requisitos ativos |

## F56.1 — Cobertura concluída (Contrato produtivo, modelos e fallback)

**Fonte (arquivada):** `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/` (8 specs). **Status:** COBERTURA CONCLUÍDA da F56.1 — 11/11 planos, UAT humano local aprovado, GSD 10/10, OpenSpec 55/55, verificada/sincronizada/arquivada em 2026-10-06 em `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/`. Cada requirement OpenSpec abaixo mapeia para um REQ-ID usado no frontmatter `requirements` dos planos e no gate de cobertura (todos concluídos).

| REQ-ID | Requirement (OpenSpec) | Spec |
|--------|------------------------|------|
| REQ-56.1-01 | Configuração global de par principal e fallback (modelo + qualidade) | image-generation-model-pair-config |
| REQ-56.1-02 | Catálogo elegível fechado de pares modelo–qualidade | image-generation-model-pair-config |
| REQ-56.1-03 | Escolha inicial registrada como decisão humana expressa | image-generation-model-pair-config |
| REQ-56.1-04 | Persistência auditável com RPC | image-generation-model-pair-config |
| REQ-56.1-05 | Leitura server-only e invalidação de cache | image-generation-model-pair-config |
| REQ-56.1-06 | Tratamento fail-closed de configuração inválida | image-generation-model-pair-config |
| REQ-56.1-07 | Isolamento do fluxo legado | image-generation-model-pair-config |
| REQ-56.1-08 | Snapshot imutável da configuração por campanha | image-generation-config-snapshot |
| REQ-56.1-09 | Alteração posterior do admin não muda o passado | image-generation-config-snapshot |
| REQ-56.1-10 | Correlação do snapshot com a telemetria | image-generation-config-snapshot |
| REQ-56.1-11 | Tolerância a operações legadas sem snapshot | image-generation-config-snapshot |
| REQ-56.1-12 | Taxonomia de falhas elegíveis e não elegíveis | image-generation-failure-policy |
| REQ-56.1-13 | Política de execução com teto de chamadas | image-generation-failure-policy |
| REQ-56.1-14 | Rate limit é transitório | image-generation-failure-policy |
| REQ-56.1-15 | Disponibilidade/capacidade aciona fallback sem repetição inútil | image-generation-failure-policy |
| REQ-56.1-16 | Falha técnica não é cobrada do lojista | image-generation-failure-policy |
| REQ-56.1-17 | Resposta pública identificável com código e referência | image-generation-support-reference |
| REQ-56.1-18 | A mensagem pública não revela o motivo interno | image-generation-support-reference |
| REQ-56.1-19 | Correlação segura no admin/suporte | image-generation-support-reference |
| REQ-56.1-20 | Referência não é credencial nem dado sensível | image-generation-support-reference |
| REQ-56.1-21 | Propagação da qualidade até o adapter | image-generation-instrumentation |
| REQ-56.1-22 | Observabilidade por tentativa (modelo–qualidade) | image-generation-instrumentation |
| REQ-56.1-23 | Cálculo de custo por par modelo–qualidade | image-generation-instrumentation |
| REQ-56.1-24 | Registro dos modelos elegíveis em capacidade própria do novo fluxo | ai-model-catalog |
| REQ-56.1-25 | Dimensão de qualidade no pricing de imagem (aditiva) | ai-model-pricing |
| REQ-56.1-26 | Cobertura de pricing ciente de qualidade para os pares elegíveis | ai-model-pricing |
| REQ-56.1-27 | Envelope de telemetria registra o par modelo–qualidade | ai-invocation-gateway |

## F56.2a — Cobertura concluída (Preparação não operacional do Produto 1:1)

**Fonte arquivada:** `openspec/changes/archive/2026-10-07-fase-56-2a-preparacao-nao-operacional-produto-1-1/` (5 specs principais sincronizadas: 2 atualizadas + 3 criadas). **Status:** COBERTURA CONCLUÍDA — 6/6 planos e summaries; 31/31 tasks OpenSpec; UAT 4 pass + 1 N/A; segurança 20/20 ameaças fechadas, 0 abertas; change verificada, sincronizada e arquivada em 2026-10-07. A anomalia do reset final (exit 1 / HTTP 502, causa desconhecida) permanece warning operacional, não sucesso de reset, e deve ser investigada antes de depender do procedimento na F56.2b1. F56.2a permaneceu inativa: sem rota/provider/crédito/entrega/download real.

| REQ-ID | Requirement (OpenSpec) | Spec |
|--------|------------------------|------|
| REQ-56.2a-01 | Estrutura das duas chaves de ativação, desligadas por padrão | product-1-1-flow-activation |
| REQ-56.2a-02 | Decisão server-side pura e fail-closed | product-1-1-flow-activation |
| REQ-56.2a-03 | Precedência determinística entre as chaves (geral prevalece) | product-1-1-flow-activation |
| REQ-56.2a-04 | Barreira de não-ativação nesta fatia | product-1-1-flow-activation |
| REQ-56.2a-05 | Contratos de seleção explícita de intenção | product-1-1-intent-background-selection |
| REQ-56.2a-06 | Contratos e componentes de direção de fundo | product-1-1-intent-background-selection |
| REQ-56.2a-07 | "Manter cenário original" exige exatamente uma imagem de produto (identidade não conta) | product-1-1-intent-background-selection |
| REQ-56.2a-08 | Validação de seleção como erro de campo (nunca `IMG-001`) | product-1-1-intent-background-selection |
| REQ-56.2a-09 | Componentes inativos não expostos ao lojista | product-1-1-intent-background-selection |
| REQ-56.2a-10 | Incorporação versionada e congelada dos prompts e regras aprovados (Produto v4/compositor v5) | product-1-1-prompt-composition |
| REQ-56.2a-11 | Conteúdo obrigatório do prompt | product-1-1-prompt-composition |
| REQ-56.2a-12 | Sem troca silenciosa da intenção | product-1-1-prompt-composition |
| REQ-56.2a-13 | Equivalência com a bancada aprovada (F48.2.6) | product-1-1-prompt-composition |
| REQ-56.2a-14 | Bancada não é dependência de runtime | product-1-1-prompt-composition |
| REQ-56.2a-15 | Estrutura append-only de operações/tentativas vinculada à campanha e ao snapshot original | image-generation-config-snapshot |
| REQ-56.2a-16 | Contrato de reuso do snapshot original | image-generation-config-snapshot |
| REQ-56.2a-17 | Não sobrescrever o run/trace histórico | image-generation-config-snapshot |
| REQ-56.2a-18 | Registro das duas chaves de ativação com default fail-closed | feature-flag-control |
| REQ-56.2a-19 | Alteração auditável das chaves pela RPC existente | feature-flag-control |

## F51.1 — Concluída na branch local (Landing visual de produto) — NÃO publicada (typecheck = exceção externa aceita)

**Fonte (ativa):** `openspec/changes/fase-51-1-landing-visual-produto/` — `proposal.md`, `design.md` (D1–D10), `tasks.md` (33 tasks em 7 seções) e specs `landing-conversion-experience` (ADDED) e `access-request-history` (MODIFIED). **Status:** CONCLUÍDA NA BRANCH LOCAL (NÃO publicada) — frente paralela deste worktree (`escopo/landing`), registrada em 2026-10-08; Planos 01–08 concluídos; aprovação humana (mobile+desktop, ambos os modos); `build` verde; `typecheck` = **exceção externa aceita** (`ssl`/`pg`, F56 — **não** aprovado); OpenSpec **arquivado**. Publicação adiada até a F56 ser concluída/integrada; `openspec validate --strict` válido. Cada requirement OpenSpec abaixo mapeia para um REQ-ID usado no frontmatter `requirements` dos planos e no gate de cobertura. Esta frente **não** altera os REQ-IDs da F56.

| REQ-ID | Requirement (OpenSpec) | Spec |
|--------|------------------------|------|
| REQ-51.1-01 | Estrutura da landing com blocos de função única (ordem; sem "Como funciona" duplicado; "Novidades" secundária/rodapé) | landing-conversion-experience |
| REQ-51.1-02 | Narrativa e copy orientadas ao resultado (headline/subheadline aprovadas; narrativa "o usuário escolhe a apresentação; o Vendeo prepara a campanha", sem exigir string literal; sem termos internos) | landing-conversion-experience |
| REQ-51.1-03 | Direção e função das imagens (função/proporção/requisito; troca sem refazer layout; sem provas inventadas) | landing-conversion-experience |
| REQ-51.1-04 | Escopo de capacidades comunicadas (1:1; estúdio/ambientado/original; oferta/destaque/exclusivo; sem ativar fluxo; sem "em breve") | landing-conversion-experience |
| REQ-51.1-05 | Conteúdo demonstrativo estático sem geração ao vivo (sem API de geração; sem geração paga) | landing-conversion-experience |
| REQ-51.1-06 | Oferta comunicada em componente independente (mensagem curta; mecânica em secundário/FAQ; sem prometer ilimitado; beta fechado não inicia período) | landing-conversion-experience |
| REQ-51.1-07 | Controles de acesso e ações secundárias ("Entrar" secundário; oferta e final no mesmo modo da flag) | landing-conversion-experience |
| REQ-51.1-08 | Acessibilidade e preservação de links e estados existentes (headings/landmarks/foco/alvos ≥44px; links legais; formulário por modo da chave) | landing-conversion-experience |
| REQ-51.1-09 | Fronteira e independência da fatia (preferir page.tsx + components/landing; proibido alterar F56/contratos; alteração global justificada) | landing-conversion-experience |
| REQ-51.1-10 | CTA da landing conforme a flag em todos os CTAs de aquisição — hero, transformação, identidade e oferta — nos dois modos (off → solicitação; on → Google/email) | access-request-history |

## F51.2 — Em execução na branch local (Fundação SEO / descoberta orgânica) — 5/8 planos — NÃO publicada

**Fonte (ativa):** `openspec/changes/fase-51-2-fundacao-seo-descoberta-organica/` — `proposal.md`, `design.md` (D1–D15), `tasks.md` (9 seções) e specs `seo-discovery-foundation` (ADDED), `organic-discovery-readiness` (ADDED) e `route-redirects` (MODIFIED + ADDED). **Status:** EM EXECUÇÃO — frente paralela deste worktree (`escopo/landing`), registrada em 2026-10-12; **5/8 planos concluídos** (plano 51.2-01 auditoria + decisão C2; plano 51.2-02 helpers puros `src/lib/seo/*` + 76 testes; plano 51.2-03 `metadataBase`/default `noindex` na raiz + metadata/OG/Twitter da home — REQ-51.2-02/03/04/08 implementados localmente; plano 51.2-04 `robots.ts`/`sitemap.ts` fail-closed + 16 testes — REQ-51.2-07/09 implementados localmente; plano 51.2-05 `headers()`/`X-Robots-Tag` em `next.config.ts` (4 redirects 301 intactos) + `noindex` explícito nas páginas legais + 50 testes — REQ-51.2-05/06/08/10/11 implementados localmente); **não publicada**, sem configuração externa, sem deploy e sem fechamento OpenSpec (verify/sync/archive). A **preparação técnica** (a) é validada na branch; a **ativação/validação pública** (b) depende da integração/publicação conjunta com a F56. A fatia **não** altera os REQ-IDs, conteúdos ou status da F56 e não altera a posição global (permanece F56.2a). Cada requirement OpenSpec abaixo mapeia para um REQ-ID usado no frontmatter `requirements` dos planos e no gate de cobertura.

| REQ-ID | Requirement (OpenSpec) | Spec |
|--------|------------------------|------|
| REQ-51.2-01 | Origem canônica (`https://vendeo.tech`, sem `www`) e auditoria de host/protocolo — canonicalização é operacional externa; redirects de caminho intactos | seo-discovery-foundation |
| REQ-51.2-02 | `metadataBase`, validação explícita da origem (`https`, host `vendeo.tech`, sem `www`/caminho/query/fragmento) e URLs absolutas por ambiente — sem lançar exceção e sem emitir URL divergente | seo-discovery-foundation |
| REQ-51.2-03 | Metadata da home aprovada (título/descrição exatos) sem alterar o H1 nem o conteúdo visível | seo-discovery-foundation |
| REQ-51.2-04 | Metadata de compartilhamento coerente (Open Graph `pt_BR`/`siteName` + Twitter) com URL absoluta e imagem institucional | seo-discovery-foundation |
| REQ-51.2-05 | Política de indexação por rota e superfície (`index`/`noindex`; sitemap) | seo-discovery-foundation |
| REQ-51.2-06 | Distinção de ambiente fail-closed (`VERCEL_ENV === "production"` **e** origem validada) | seo-discovery-foundation |
| REQ-51.2-07 | `robots.txt` que orienta crawling sem impedir a leitura do `noindex` (sem `Disallow` bloqueante; sem sitemap divergente) | seo-discovery-foundation |
| REQ-51.2-08 | Padrão de não indexação (`noindex, nofollow`) na raiz com a home como única exceção explícita e testada | seo-discovery-foundation |
| REQ-51.2-09 | `sitemap.xml` restrito a URLs canônicas realmente indexáveis (só `${origin}/` sob a condição combinada; vazio caso contrário) | seo-discovery-foundation |
| REQ-51.2-10 | Documentos legais e versões Markdown acessíveis mas não indexáveis (`noindex`/`X-Robots-Tag`, sem `Disallow`) | seo-discovery-foundation |
| REQ-51.2-11 | `/api/**` fora do sitemap e com `X-Robots-Tag: noindex`, sem alterar lógica/status/headers preexistentes | seo-discovery-foundation |
| REQ-51.2-12 | Imagem de compartilhamento institucional (composição determinística/local, sem IA/pago; caminhos locais fora do código; aprovação visual C1) | seo-discovery-foundation |
| REQ-51.2-13 | Fronteira da fatia e proibição de prometer indexação/tráfego/posição | seo-discovery-foundation |
| REQ-51.2-14 | Diagnóstico de performance registrado sem alterar a landing (mudanças exigem aprovação separada — C3) | organic-discovery-readiness |
| REQ-51.2-15 | Baseline do Search Console sem configuração externa e sem inventar dados | organic-discovery-readiness |
| REQ-51.2-16 | Limite de expectativa honesto sobre descoberta orgânica | organic-discovery-readiness |
| REQ-51.2-17 | Validação e separação entre preparação técnica (branch) e ativação pública (após F56); exceção `ssl`/`pg` externa | organic-discovery-readiness |
| REQ-51.2-18 | Canonicalização de host/protocolo externa ao código da aplicação (sem redirects de host no repositório) | route-redirects |

## Regras Operacionais

- Os REQ-IDs cobertos são os da F56.1 (`REQ-56.1-01`..`REQ-56.1-27`, cobertura concluída em 2026-10-06) e os da F56.2a (`REQ-56.2a-01`..`REQ-56.2a-19`, cobertura concluída em 2026-10-07). A F56.2b1 e a F56.2b2 permanecem mudanças ativas/futuras, com requisitos próprios ainda não marcados como cobertura concluída; F56.3 permanece futura.
- Os REQ-IDs da **F51.1** (`REQ-51.1-01`..`REQ-51.1-10`) estão **cobertos e concluídos na branch local** (aprovação humana mobile+desktop, ambos os modos; `build` verde; `typecheck` = **exceção externa aceita** `ssl`/`pg` da F56 — **não** aprovado; OpenSpec arquivado) e **NÃO publicados** — a publicação fica adiada até a F56 ser concluída/integrada (frente paralela, 2026-10-08). Eles **não** alteram IDs, conteúdos ou status dos requisitos da F56.
- Os REQ-IDs da **F51.2** (`REQ-51.2-01`..`REQ-51.2-18`) estão **em execução** (5/8 planos: 51.2-01 auditoria/C2 na branch; 51.2-02 helpers puros `src/lib/seo/*` + testes; 51.2-03 `metadataBase`/`noindex` default da raiz + metadata/OG/Twitter da home; 51.2-04 `robots.ts`/`sitemap.ts` fail-closed + testes, implementando localmente `REQ-51.2-02`/`REQ-51.2-03`/`REQ-51.2-04`/`REQ-51.2-07`/`REQ-51.2-08`/`REQ-51.2-09`; 51.2-05 `headers()`/`X-Robots-Tag` em `next.config.ts` (4 redirects 301 intactos) + `noindex` explícito nas páginas legais + testes, implementando localmente `REQ-51.2-05`/`REQ-51.2-06`/`REQ-51.2-08`/`REQ-51.2-10`/`REQ-51.2-11`) e **não publicados** — fundação técnica aditiva/local, sem configuração externa, sem deploy e sem fechamento OpenSpec (frente paralela, 2026-10-12). Eles **não** alteram IDs, conteúdos, status ou a posição global da F56.
- Novos REQ-IDs só devem ser adicionados quando uma nova fase for formalmente planejada, com fonte em OpenSpec e plano aprovado.
- Para uma fase concluída, consultar o OpenSpec arquivado, `VERIFICATION.md`, `SUMMARY.md`, contexto e planos da fase.
- Em caso de divergência histórica, OpenSpec arquivado + `VERIFICATION.md`/`SUMMARY.md` da fase prevalecem sobre este archive e sobre registros antigos.
- O status de fase e a continuidade operacional estão em `.planning/ROADMAP.md` e `.planning/STATE.md`.

## Referências

- Snapshot integral anterior à compactação: `.planning/REQUIREMENTS-ARCHIVE.md`.
- Índice de fases e estado atual: `.planning/ROADMAP.md` e `.planning/STATE.md`.
- Planos, contextos, summaries e verificações: `.planning/phases/`.
- Quick plans e summaries: `.planning/quick/`.
- Propostas, specs e tasks arquivadas: `openspec/changes/archive/`.
- Auditorias e decisões históricas: `.planning/` e `docs/`.
