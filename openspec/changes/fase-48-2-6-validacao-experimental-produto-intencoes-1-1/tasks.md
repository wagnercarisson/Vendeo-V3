## 1. Baseline e contratos

- [x] 1.1 Registrar baseline, confirmar arquivos protegidos e auditar schema/API, registries de política, preflight, linhagem e custo; manter produção/migrations sem alterações.
- [x] 1.2 Documentar contratos atuais de selos sem alterá-los; implementar validade exclusiva de Oferta na bancada, preservando formatos/validações e comportamento explícito ao trocar intenção.
- [x] 1.3 Extrair inferência/opções para uma única autoridade pura em `src/lib/lab/bench/domain/`; preservar exports de `form-rules.ts` por delegação e paridade com hook produtivo intocado.

## 2. Matriz preço × intenção

- [x] 2.1 Implementar validação compartilhada para de+por → Oferta, somente por → Oferta/Destaque, sem preço → Destaque/Exclusivo e preço original isolado → inválido.
- [x] 2.2 Integrar validação aos schemas/domínio e garantir `/compose` e `/runs` recusam combinações incompatíveis antes de compor, persistir ou invocar provider.
- [x] 2.3 Atualizar UI da bancada para exigir escolha explícita após mudança incompatível de preço, sem troca silenciosa, e invalidar prompt/preflight.
- [x] 2.4 Testar cada combinação válida/inválida em lógica pura, schema, UI relevante, compose e runs; verificar API direta e ausência de side effects para rejeições.
- [x] 2.5 Testar validade ausente/presente nas três intenções; troca com validade preservada bloqueia até regularização explícita, sem persistência/provider.

## 3. Preflight e integridade do prompt

- [x] 3.1 Vincular preflight a preço/intenção efetivos e invalidá-lo após qualquer mudança relevante ou versão de política.
- [x] 3.2 Testar alteração de preço/intenção após aprovação e rejeição stale antes de persistência/provider; confirmar preset/modelo/qualidade não invalidam texto por si só.
- [x] 3.3 Provar preservação byte a byte do prompt-base aprovado, prompt aprovado e prompt enviado em fluxos válidos.
- [x] 3.4 Propagar `backgroundDirection` pelo schema, snapshot, prompt e preflight/API; validar `Manter cenário original` somente com exatamente uma referência de produto, sem contar identidade.

## 4. Políticas e prompt-base

- [x] 4.1 Habilitar apenas Produto + 1:1 com políticas versionadas Oferta, Destaque e Exclusivo nos registries/config da bancada.
- [x] 4.2 Manter Oferta e Destaque; versionar Exclusivo v3 com a frase literal editorial aprovada, sem alterar opções/permissões de selos.
- [x] 4.3 Usar uma única instrução compilada de nome `Nome obrigatório na arte: {nome}. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.`; preservar nome de entrada sem correção silenciosa; descrição opcional adaptável/melhorável/omitível sem mudar significado; cada texto obrigatório integral uma única vez; manter revisão textual e `keep_exactly`. A política Produto passa a `48.2.6-produto-v4`.
- [x] 4.4 Fazer ajuste pequeno e neutro no prompt-base reutilizável, sem regra específica de intenção; atualizar golden/versões sem alterar núcleo neutro.
- [x] 4.5 Com uma imagem, usar somente a instrução aprovada de produto principal/fidelidade sem mencionar primeira imagem, variante ou auxiliares; para duas ou mais, orientar primeira como protagonista e auxiliares como apoio secundário, com fidelidade instruída uma única vez; testar por intenção e contagem.
- [x] 4.6 Testar contribuições/instruções versionadas e disjuntas das três intenções, inclusão/omissão de preço e texto de política; não inferir sucesso visual do modelo; confirmar Serviço/outros formatos continuam desabilitados e fail-closed.
- [x] 4.7 Serializar nome + preservação em uma única linha compilada conforme contrato e versionar somente Produto como `48.2.6-produto-v4`.
- [x] 4.8 Serializar `discountedPriceText` com rótulo neutro `Preço de venda`; essa alteração foi versionada no compositor v2 e é preservada por incrementos posteriores v4/v5. Provar que Destaque com preço único preserva valor sem texto/versão Oferta, enquanto a semântica promocional permanece na instrução Oferta existente e inalterada.
- [x] 4.9 Versionar somente a política Exclusivo para `48.2.6-exclusivo-v3`; testar composição sem selo e com os selos permitidos `Exclusivo` e `Edição Limitada`, mantendo opções/permissões inalteradas e preservando a evidência v1.
- [x] 4.10 Oferecer direção de fundo de seleção única para as três intenções: Fundo de estúdio, Cenário ambientado e Manter cenário original; sem padrão automático, inclusive em Oferta. Remover o checkbox bench independente `preserveImageContext`; eventual flag interna deve derivar da direção selecionada.
- [x] 4.11 Invalidar direção `original` quando a quantidade mudar de exatamente uma imagem de produto; exigir reseleção explícita, excluir identidade da contagem e testar intenção × fundo, API/schema/snapshot/prompt/preflight e transições UI.

## 5. Evidências e validação técnica

- [x] 5.1 Reutilizar runs, snapshots, linhagem, preflight e telemetria; criar registro documental enxuto de rodada, rubrica UAT e manifesto do candidato sem tabela nova.
- [x] 5.2 Confirmar protocolo manual `gpt-image-2.5-sunburst` medium, sem comparação de modelos; registrar custos/usage/latência por run sem inferir custo total a partir de tarifas por token.
- [x] 5.3 Executar threat model/verificação proporcional: guard admin/local-only, chave exclusiva da bancada, isolamento/manifesto, segredos, CAS single-run e recusas sem side effects antes do provider.
- [x] 5.4 Rodar testes relevantes, typecheck, lint e build sem chamada de provider; comprovar que adapters/transporte/pricing/banco/produção/migrations/créditos não foram alterados.

## 6. Checkpoints, UAT e fechamento documental

- [x] 6.1 **CHECKPOINT A — responsável:** revisar matriz, políticas, validade exclusiva de Oferta, preservação de contratos de selos, threat model e gates antes de qualquer geração paga.
- [x] 6.2 Após CHECKPOINT A aprovado, usuário prepara UAT local e confirma financeiramente cada execução de forma individual; nenhuma execução é tarefa autônoma. As duas execuções finais existentes foram manuais/succeeded; nenhuma foi iniciada pelo executor.
- [x] 6.3 **CHECKPOINT B — usuário:** avaliar manualmente Oferta, Destaque e Exclusivo quanto a produto/embalagem, variante protagonista/auxiliares, direção de fundo, nome, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência; preservar a tentativa v1 e registrar v1 × v3 como comparação antes × depois não controlada para isolar Exclusivo, pois Produto, compositor e instrução de fundo também mudaram. Reutilizar dados/imagem e Sunburst medium se confirmados, manter lacunas como `pending` e não atribuir diferenças somente à política Exclusivo; cada nova geração exige confirmação financeira individual; encerramento com limitações requer aceitação explícita e lacunas/follow-ups enumerados. Decisão humana: `approved_with_limitations`, com limitações/follow-ups documentados.
- [x] 6.4 Congelar pacote UAT documental ligado aos runs, com versões, custo/fonte, latência, avaliações, limitações e decisão humana; nenhum candidato é promovido para produção.
- [ ] 6.5 Executor registra resultado em tracking de forma não destrutiva conforme UAT; entrega para revisão. Somente responsável executa `/opsx-verify`, `/opsx-sync` e `/opsx-archive`.

## 7. Refinamentos da revisão humana pré-checkpoint

- [x] 7.1 Ocultar a opção `Manter cenário original` no seletor quando houver 0 ou 2+ imagens de produto; não a deixar visível/desabilitada.
- [x] 7.2 Manter os nomes curtos na UI e serializar somente a frase específica do fundo selecionado; incrementar o compositor para `48.2.4-prompt-composer-v4`.
- [x] 7.3 Registrar v1 × v3 como antes × depois não controlada para isolar Exclusivo; explicitar mudanças adicionais em Produto/compositor/fundo e remover inferência causal exclusiva.
- [x] 7.4 Atualizar política Produto para v4 e compilar o nome em uma única instrução, preservando todas as palavras/números/unidades e sem correção silenciosa.
- [x] 7.5 Condicionar instrução visual do produto a zero/uma/múltiplas referências; provar prompt de uma e múltiplas imagens nas três intenções sem fidelidade duplicada.
- [x] 7.6 Registrar o relato manual Johnnie Walker/Destaque e Exclusivo (“750ml”) sem atribuir versão, run ou resultado ao código atualizado.
- [x] 7.7 Incrementar compositor para `48.2.4-prompt-composer-v5` para distinguir o novo texto compilado de runs v4, e atualizar contratos/versionamento.
- [x] 7.8 Evitar ponto duplicado quando nome trimado termina em ponto; preservar entrada e saída aprovada para nomes sem ponto final, com regressão contratual.
- [x] 7.9 Corrigir a rastreabilidade histórica: frases de fundo entraram no compositor v4; v5 identifica a nova serialização do nome.
- [x] 7.10 Corrigir no design e nos artefatos UAT a rastreabilidade histórica: fundo entrou no compositor v4; a serialização de nome é compositor v5.
