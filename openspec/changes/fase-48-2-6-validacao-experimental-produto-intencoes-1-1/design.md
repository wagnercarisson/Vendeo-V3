## Context

A F48.2.5 deixou compositor determinístico, políticas versionadas, preflight server-side, prompt aprovado/sent preservado byte a byte, runs/linhagem/snapshots e evidências financeiras. A bancada possui `form-rules.ts` replicando `inferIntent`/`availableIntents` do formulário produtivo e testes de paridade; o formulário limita opções pela matriz, mas aplica inferência automática. `BenchProductSchema`/`BenchOfferSchema` aceitam preço/intenção independentemente; `resolveBenchIntent` respeita intenção explícita sem conferir compatibilidade. Com isso, chamadas diretas à API podem compor e persistir combinações inválidas.

Evidências: `src/components/flow/campaign-input-form.tsx` (opções disponíveis), `use-campaign-form.ts` (inferência e troca ao editar preço), `src/lib/lab/bench/domain/form-rules.ts` e `__tests__/form-parity.contract.test.ts` (cópia/testes), `domain/schemas.ts` (schemas permissivos), `domain/campaign-snapshot.ts` (intenção explícita sem matrix guard), `api/.../compose/route.ts` e `runs/route.ts` (parsing e preflight), `preflight-revalidation.ts` (evidência de conteúdo/versões), `config-registry.ts`/policy registry (Destaque/Exclusivo desabilitados). O formulário de produção já tem comportamento de incompatibilidade que pode substituir intenção automaticamente; o requisito de escolha explícita será aplicado somente à bancada.

Contratos observados: `BADGE_OPTIONS_BY_INTENT` e validação existente por intenção são a autoridade para selos e permanecem inalterados. Escolha explícita de “Exclusivo”/“Edição Limitada” é dado do usuário, não invenção do diretor; a política Exclusivo não pode criar tais alegações. A UI atualmente só expõe validade em Oferta, mas schema/backend não rejeitam validade para outras intenções. Esta change fecha a lacuna na bancada: validade exclusivamente em Oferta e nenhum descarte silencioso ao trocar intenção.

## Goals / Non-Goals

**Goals:**
- Habilitar políticas versionadas Destaque e Exclusivo para Produto 1:1 e conservar Oferta e o núcleo neutro.
- Aplicar a matriz normativa de preços na UI/schema/backend; incompatibilidade após edição exige seleção explícita, sem troca silenciosa.
- Permitir validade somente em Oferta, com bloqueio explícito na UI/backend e preservação dos formatos/validações atuais.
- Invalidar preflight quando preço ou intenção mudar, preservando prompt aprovado/enviado byte a byte.
- Ajustar levemente o prompt-base neutro; deixar regras de intenção exclusivamente nas políticas.
- Produzir evidência documental e UAT manual das três intenções com Sunburst medium.

**Non-Goals:**
- Serviço, outros formatos, novos adapters/transporte, mudanças de pricing ou banco.
- Produção, migrations produtivas, créditos, revisão visual automática, corretor ortográfico ou IA revisora.
- Comparação entre modelos. Geração executada automaticamente, batch ou sem confirmação financeira individual.
- Promoção produtiva do pacote candidato.

## Decisions

### D1 — Extrair a autoridade comportamental pura dentro da bancada e criar enforcement compartilhado

Manter a produção intocada nesta fase, inclusive `src/components/flow/use-campaign-form.ts` e `src/components/flow/campaign-input-form.tsx`. Extrair os helpers de inferência/opções atualmente espelhados pela bancada para um módulo puro dentro de `src/lib/lab/bench/domain/`; `form-rules.ts` mantém seus exports existentes como wrappers por delegação. UI, schemas, snapshot e backend da bancada consomem uma única autoridade nesse bounded context. O contrato normativo acrescenta apenas a rejeição de preço original isolado à autoridade comportamental existente da bancada: preço de e por → somente Oferta; somente por → Oferta ou Destaque; sem preço → Destaque ou Exclusivo; preço original isolado → inválido. Testes de paridade continuam comparando os exports da bancada contra o hook produtivo, que permanece inalterado. Validar combinação após parse de schema, antes de compor e antes de reservar/persistir run. A UI não seleciona automaticamente intenção incompatível: informa incompatibilidade, limpa evidência preflight e solicita escolha explícita.

Alternativa rejeitada: importar `availableIntents` de `form-rules.ts` dentro da autoridade nova, pois isso preservaria a duplicação e criaria dependência circular se os exports compatíveis delegassem à autoridade. Alternativas rejeitadas: alterar o hook/formulário produtivo nesta fase ou criar uma segunda matriz independente. A implementação produtiva equivalente permanece isolada deliberadamente; possível unificação entre pipelines fica para uma fase de integração produtiva.

### D2 — Matriz integral no servidor e invalidação por revisão comercial

Criar/usar validação server-side compartilhada tanto em `/compose` quanto em `/runs`; schemas continuam validando shape/tipos, e guard de domínio valida consistência preços-intenção. Alteração nos valores de preço/intenção depois de compor/aprovar invalida a evidência e retorna erro stale antes de persistir run/provider. O prompt aprovado continua sendo enviado byte a byte; trocar modelo/preset/qualidade não altera a evidência textual aprovada.

Alternativa rejeitada: reescrever silenciosamente intenção no servidor. A escolha humana evita mudança de objetivo comercial não consentida.

### D3 — Políticas curtas por intenção

Registrar políticas/version para as três intenções nos registries existentes, habilitadas somente em Produto + 1:1. Instruções finais concisas estão nos deltas: Oferta destaca preço por e mantém preço de secundário; Destaque prioriza apresentação e preço informado secundário; Exclusivo v3 usa literalmente “Exclusivo: apresente o produto sem preço em uma composição editorial, sóbria e arejada, com hierarquia discreta e sem chamadas promocionais. Respeite os selos informados sem inventar informações.” Selos mantêm exatamente listas e permissões existentes; selo escolhido pelo usuário é dado de entrada. Validade informada em Oferta continua no prompt como dado comercial; regra de aceitação por intenção é enforcement UI/backend e não explicação ao modelo. A regra geral e Produto não duplicam orientações comerciais.

#### D3.1 — Ajuste intrafase Exclusivo v3 e preservação da tentativa v1

A versão vigente da política Exclusivo SHALL ser `48.2.6-exclusivo-v3` e conter somente a instrução literal aprovada. A evidência e a decisão do usuário sobre a primeira arte Exclusivo sob `48.2.6-exclusivo-v1` permanecem preservadas, sem sobrescrever a tentativa anterior; v2 não teve tentativa visual. A comparação preparada v1 × v3 SHALL ser descrita como antes × depois, não controlada para isolar o efeito da política Exclusivo: a política Produto, o compositor e a instrução de fundo também mudaram desde a tentativa v1. Reutilizar os mesmos dados/imagem existentes e `gpt-image-2.5-sunburst` `medium` somente se isso for confirmado; direção de fundo v1 desconhecida permanece `pending`, sem alegação de controle. Não atribuir eventual diferença visual exclusivamente à política Exclusivo. Não executar nova geração até revisão humana e confirmação financeira individual.

Alternativa rejeitada: ramificações no compositor neutro ou no prompt-base, que duplicariam decisões de política.

### D4 — Texto literal e imagens auxiliares

Instrução de nome única no prompt compilado: `Nome obrigatório na arte: {nome}. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.` Não manter outra linha “Nome: completo…”; a entrada do nome permanece intacta e não é corrigida silenciosamente. Descrição continua opcional/adaptável/omitível sem alterar significado; cada texto obrigatório aparece integralmente uma única vez. Mantêm-se revisão textual/`keep_exactly` e a regra de texto obrigatório não se repete em outra política.

As instruções de imagem variam pela quantidade de referências de produto, nunca incluindo a imagem de identidade nessa contagem:

| Referências de produto | Instrução de imagem |
|---|---|
| 0 | `Produto como elemento principal da peça.` |
| 1 | `Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.` |
| 2+ | `A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.` e `Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.` |

Para uma imagem, não mencionar primeira imagem, variante ou imagens auxiliares; a frase completa da linha de referência é a única orientação de imagem. Para duas ou mais, manter protagonismo da primeira e apoio secundário das auxiliares, com a fidelidade descrita exatamente uma vez. Não declarar suporte a produtos independentes/combos nem garantir aparição das auxiliares. Limites, ordem e transporte ficam regidos pelos contratos técnicos existentes. Repetição de texto e presença de imagens são contratos distintos.

#### D4.1 — Rótulo do nome compilado

O compositor serializa nome e orientação em uma linha: `Nome obrigatório na arte: {nome}. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.` A política Produto muda para `48.2.6-produto-v4`; não há linha adicional “Nome: completo…”. A serialização preserva exatamente o valor de entrada, sem correção silenciosa.

#### D4.6 — Papel de imagem condicionado à contagem

A política Produto recebe a contagem das referências de produto na resolução de políticas. Com uma referência, emite apenas a instrução única de elemento principal/fidelidade aprovada; com duas ou mais, emite a orientação validada de protagonista/auxiliares e a orientação de fidelidade exatamente uma vez; com zero, emite apenas a orientação geral de elemento principal, sem alegar fidelidade a imagem ausente. A mesma contagem/referências alimenta composição e revalidação do preflight para que o prompt aprovado seja reproduzível.

#### D4.7 — Versionamento e pontuação do nome no compositor

A serialização do nome SHALL ser identificada por `48.2.4-prompt-composer-v5`, pois runs v4 registram um texto compilado diferente. O valor de entrada permanece literal. Ao concatenar a instrução, se o nome trimado terminar em `.`, não acrescentar outro ponto antes de `Inclua`; nomes sem ponto final mantêm exatamente a redação normal, sem alteração.

#### D4.8 — Rastreabilidade histórica das versões do compositor

`48.2.4-prompt-composer-v4` introduziu as frases específicas de direção de fundo. `48.2.4-prompt-composer-v5` mantém essas frases e identifica a nova serialização do nome; runs v4 registram o texto de nome anterior e não podem ser descritos como tendo usado o texto v5.

#### D4.2 — Rótulo neutro compartilhado para preço

O compositor serializa `discountedPriceText` com o rótulo neutro `Preço de venda`, sem alterar valor ou demais linhas, e incrementa somente `COMPOSER_VERSION` para `48.2.4-prompt-composer-v2`. O rótulo não atribui semântica promocional: quando cabível, essa interpretação continua exclusivamente na instrução já existente da política Oferta. Nenhuma versão ou string de política muda.

#### D4.3 — Direção de fundo explicitamente escolhida

Todas as intenções exibem uma seleção única e obrigatória: `Fundo de estúdio`, `Cenário ambientado` ou `Manter cenário original`; nenhuma é default, inclusive em Oferta. A opção `Manter cenário original` só é renderizada quando há exatamente uma referência de imagem de produto; com 0 ou 2+ referências ela não aparece (não apenas desabilitada). Mudanças na contagem limpam uma seleção `original` invalidada e exigem reseleção explícita. Identidade da loja não conta. A seleção continua no briefing/snapshot, preflight e validação server-side. O checkbox legado `preserveImageContext` não é uma segunda escolha; eventual flag booleana interna deriva apenas da direção escolhida. O seletor mostra nomes curtos, mas somente a instrução específica da direção selecionada entra no prompt:

| Direção | Instrução compilada |
|---|---|
| Estúdio | `Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.` |
| Ambientado | `Crie um cenário ambientado coerente com o produto e a marca, sem prejudicar a leitura.` |
| Original | `Mantenha o cenário da imagem enviada como base; não o substitua por outro.` |

Essas frases substituem a serialização anterior de rótulo puro e foram introduzidas em `COMPOSER_VERSION=48.2.4-prompt-composer-v4`.

#### D4.4 — Versões vigentes após ajuste intrafase

A política Produto SHALL ser `48.2.6-produto-v4`; a política Exclusivo SHALL ser `48.2.6-exclusivo-v3`. A v1 Exclusivo e sua evidência permanecem históricas; a v2 sem tentativa visual é preservada no histórico, sem promoção nem inferência de resultado.

#### D4.5 — Instruções específicas de direção de fundo

O controle mantém rótulos curtos na UI. A serialização do prompt SHALL usar exclusivamente a frase da opção selecionada conforme a tabela de D4.3, sem incluir o rótulo isoladamente ou as frases das opções não selecionadas. Essa mudança foi versionada em `48.2.4-prompt-composer-v4`.

### D4a — Validade exclusiva de Oferta

Manter formatos e validações atuais de validade. A validade informada em Oferta continua incluída no prompt como dado comercial. A bancada não oferece validade em Destaque/Exclusivo e backend recusa payloads com validade nessas intenções, tanto em composição como em execução. Se houver validade ao selecionar intenção incompatível, bloquear composição/execução e exigir remoção ou regularização explícita; preservar o valor até escolha explícita, sem limpeza automática. Não explicar ao modelo quais intenções aceitam validade e não modificar formulário/pipeline produtivos.

### D4b — Prompt-base reutilizável conciso

Fazer um ajuste pequeno no conteúdo complementar padrão, sem incluir regras de intenção nem contratos técnicos. Proposta: “Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.” Preservar carregamento inicial, edição, versão e evidência byte a byte. Essa redação substitui, não acumula, as frases complementares equivalentes atualmente existentes.

### D5 — UAT manual e evidência existente

Usar runs, snapshots, linhagem, versões, preflight, prompt_sent e telemetria existentes; sem schema/tabela nova. Usuário gera manualmente cada run com `gpt-image-2.5-sunburst`, inicialmente `medium`, após CHECKPOINT A e confirmação financeira individual. Sem comparar modelos. Registrar hipótese, entradas, IDs de run, custo e fonte do custo, latência, limites e decisão; tarifas iguais por token não significam custo total igual. Congelar pacote candidato apenas documental, sem loader/runtime/promoção.

### D6 — Checkpoints e autoridade

CHECKPOINT A revisa contratos e gates antes de qualquer teste pago. Contrato de validade está decidido: somente Oferta; selos preservam listas/permissões atuais. CHECKPOINT B é UAT manual do usuário para as três intenções e critérios previstos. Critérios sem evidência ficam `pending`; o usuário pode aprovar encerramento com limitações se enumerar lacunas/follow-ups e aceitar explicitamente, sem converter pendências em avaliações ou presumir fidelidade de arte. Cada geração manual exige confirmação financeira individual; sem autorização global/batch/autonomia. Executor implementa, testa, registra evidências, apoia UAT e atualiza tracking não destrutivamente conforme o resultado. Somente responsável do projeto executa `/opsx-verify`, `/opsx-sync` e `/opsx-archive`.

#### D6.1 — Revisão humana antes de comparação manual v1 × v3

O usuário revisa os gates, a saída de composição e a preparação v1 × v3 antes de qualquer geração. Não executar geração paga nem iniciar CHECKPOINT B durante Task 0. Cada tentativa posterior requer confirmação financeira individual. Se dados de direção de fundo da evidência v1 estiverem ausentes, manter isso como limitação e não descrever a comparação como controlada.

## Threat Model

- **Chamada paga por payload incompatível ou preflight adulterado:** validação server-side de matriz, validade e evidência aprovada antes da persistência executável/provider; testes negativos verificam ausência de side effects.
- **Acesso fora do laboratório local/admin:** manter guards admin→ambiente, manifesto de lojas e chave exclusiva da bancada; verificar fail-closed sem leitura remota.
- **Exposição de segredo ou escrita produtiva:** erros sanitizados; confirmar boundaries de adapter, allowlists, storage, tabelas produtivas, migrations e créditos intocados.
- **Concorrência/repetição:** preservar CAS/slot single-run e confirmação individual existente; não introduzir batch ou retry autônomo.

## Risks / Trade-offs

- **Preço/intenção incoerentes via API** → validar em compose e runs antes de persistência/provider; cobrir todas as combinações válidas/inválidas.
- **Mudanças comerciais mantêm prompt antigo** → vincular evidência de preflight a valores de preço/intenção e revalidar no servidor.
- **Usuário tenta validade com intenção incompatível** → preservar valor e exigir regularização explícita; validar UI/API antes de persistência/provider.
- **Payload direto contorna validade exclusiva de Oferta** → validar no backend antes de persistência/provider e testar side effects ausentes.
- **Abuso/isolamento da bancada** → preservar admin/local fail-closed, chave exclusiva, allowlist e fronteiras produtivas; verificar ameaças e recusas pré-provider.
- **Modelo altera nome/textos ou inventa apelos** → orientação de política versionada e avaliação humana por run; sem promessa técnica.
- **Auxiliares ignoradas ou concorrentes** → linguagem de política/UI honesta e avaliação humana, sem garantia de aparição.
- **Custo total não inferível de tarifa de saída** → registrar custo e fonte por run, custos adicionais de entrada e latência; não equiparar tarifas por token a custo total.

## Migration Plan

1. Congelar baseline e auditar política/config, contratos de selo e validade e reuso de evidência.
2. Implementar habilitação/políticas e guard compartilhado preço-intenção; teste de matriz em UI/schema/API.
3. Provar invalidação de preflight e prompt aprovado/sent byte a byte; atualizar frase de auxiliares e prompt-base neutro.
4. Executar verificação de segurança proporcional ao threat model: fronteiras, segredos/chave exclusiva, admin/local-only e recusas pré-provider.
5. Rodar gates sem provider, validar isolamento e fronteiras de produção/migrations.
6. **CHECKPOINT A** humano; somente após aprovação preparar UAT manual e confirmação financeira individual.
7. **CHECKPOINT B** manual pelo usuário nas três intenções com Sunburst medium; registrar limitações e congelar candidato documental sem promoção. Permitir fechamento aprovado com limitações registradas explicitamente.
8. Executor atualiza tracking de forma não destrutiva conforme resultado e entrega para revisão; somente responsável executa OpenSpec verify/sync/archive.

Rollback: reverter mudanças exclusivamente locais da bancada e documentos da change; não há migration nem alteração produtiva.

## Open Questions

Nenhuma decisão de produto permanece bloqueante. CHECKPOINT A continua gate operacional obrigatório antes das gerações pagas.
