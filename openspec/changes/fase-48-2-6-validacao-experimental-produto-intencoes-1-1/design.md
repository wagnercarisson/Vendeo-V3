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

Registrar políticas/version para as três intenções nos registries existentes, habilitadas somente em Produto + 1:1. Instruções finais concisas estão nos deltas: Oferta destaca preço por e mantém preço de secundário; Destaque prioriza apresentação e preço informado secundário; Exclusivo valoriza apresentação sem preço e não inventa atributos/alegações. Selos mantêm exatamente listas e permissões existentes; selo escolhido pelo usuário é dado de entrada. Validade informada em Oferta continua no prompt como dado comercial; regra de aceitação por intenção é enforcement UI/backend e não explicação ao modelo. A regra geral e Produto não duplicam orientações comerciais.

Alternativa rejeitada: ramificações no compositor neutro ou no prompt-base, que duplicariam decisões de política.

### D4 — Texto literal e imagens auxiliares

Instruções curtas: “Nome: completo, sem alterar palavras; capitalização e arranjo livres.”; “Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.”; “Textos obrigatórios: reprodução integral.” A política Produto atualiza os requisitos existentes e mantém revisão textual/`keep_exactly`; presença/fidelidade na imagem são avaliadas por humanos. Para imagens, usar somente: “Use a imagem principal como protagonista. As imagens auxiliares enriquecem a campanha; use-as sempre que possível, sem competir com a principal.” Permitir múltiplas representações, ângulos e variantes do produto anunciado, sem declarar suporte a produtos independentes/combos. Auxiliares opcionais e sem garantia de aparição. Limites, ordem e transporte ficam regidos pelos contratos técnicos existentes, sem reexplicá-los no prompt. Repetição de texto e presença de imagens são contratos distintos.

#### D4.1 — Rótulo do nome compilado

O compositor serializa o campo como `Nome do produto obrigatório: {nome}`. Somente `PRODUTO_POLICY_VERSION` muda para `48.2.6-produto-v2`; a frase de preservação do nome e sua liberdade de apresentação permanecem intactas, sem nova regra.

### D4a — Validade exclusiva de Oferta

Manter formatos e validações atuais de validade. A validade informada em Oferta continua incluída no prompt como dado comercial. A bancada não oferece validade em Destaque/Exclusivo e backend recusa payloads com validade nessas intenções, tanto em composição como em execução. Se houver validade ao selecionar intenção incompatível, bloquear composição/execução e exigir remoção ou regularização explícita; preservar o valor até escolha explícita, sem limpeza automática. Não explicar ao modelo quais intenções aceitam validade e não modificar formulário/pipeline produtivos.

### D4b — Prompt-base reutilizável conciso

Fazer um ajuste pequeno no conteúdo complementar padrão, sem incluir regras de intenção nem contratos técnicos. Proposta: “Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.” Preservar carregamento inicial, edição, versão e evidência byte a byte. Essa redação substitui, não acumula, as frases complementares equivalentes atualmente existentes.

### D5 — UAT manual e evidência existente

Usar runs, snapshots, linhagem, versões, preflight, prompt_sent e telemetria existentes; sem schema/tabela nova. Usuário gera manualmente cada run com `gpt-image-2.5-sunburst`, inicialmente `medium`, após CHECKPOINT A e confirmação financeira individual. Sem comparar modelos. Registrar hipótese, entradas, IDs de run, custo e fonte do custo, latência, limites e decisão; tarifas iguais por token não significam custo total igual. Congelar pacote candidato apenas documental, sem loader/runtime/promoção.

### D6 — Checkpoints e autoridade

CHECKPOINT A revisa contratos e gates antes de qualquer teste pago. Contrato de validade está decidido: somente Oferta; selos preservam listas/permissões atuais. CHECKPOINT B é UAT manual do usuário para as três intenções e critérios previstos. Critérios sem evidência ficam `pending`; o usuário pode aprovar encerramento com limitações se enumerar lacunas/follow-ups e aceitar explicitamente, sem converter pendências em avaliações ou presumir fidelidade de arte. Cada geração manual exige confirmação financeira individual; sem autorização global/batch/autonomia. Executor implementa, testa, registra evidências, apoia UAT e atualiza tracking não destrutivamente conforme o resultado. Somente responsável do projeto executa `/opsx-verify`, `/opsx-sync` e `/opsx-archive`.

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
