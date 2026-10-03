## 1. Baseline e contratos

- [ ] 1.1 Registrar baseline, confirmar arquivos protegidos e auditar schema/API, registries de política, preflight, linhagem e custo; manter produção/migrations sem alterações.
- [ ] 1.2 Documentar contratos atuais de selos sem alterá-los; implementar validade exclusiva de Oferta na bancada, preservando formatos/validações e comportamento explícito ao trocar intenção.
- [ ] 1.3 Extrair inferência/opções para uma única autoridade pura em `src/lib/lab/bench/domain/`; preservar exports de `form-rules.ts` por delegação e paridade com hook produtivo intocado.

## 2. Matriz preço × intenção

- [ ] 2.1 Implementar validação compartilhada para de+por → Oferta, somente por → Oferta/Destaque, sem preço → Destaque/Exclusivo e preço original isolado → inválido.
- [ ] 2.2 Integrar validação aos schemas/domínio e garantir `/compose` e `/runs` recusam combinações incompatíveis antes de compor, persistir ou invocar provider.
- [ ] 2.3 Atualizar UI da bancada para exigir escolha explícita após mudança incompatível de preço, sem troca silenciosa, e invalidar prompt/preflight.
- [ ] 2.4 Testar cada combinação válida/inválida em lógica pura, schema, UI relevante, compose e runs; verificar API direta e ausência de side effects para rejeições.
- [ ] 2.5 Testar validade ausente/presente nas três intenções; troca com validade preservada bloqueia até regularização explícita, sem persistência/provider.

## 3. Preflight e integridade do prompt

- [ ] 3.1 Vincular preflight a preço/intenção efetivos e invalidá-lo após qualquer mudança relevante ou versão de política.
- [ ] 3.2 Testar alteração de preço/intenção após aprovação e rejeição stale antes de persistência/provider; confirmar preset/modelo/qualidade não invalidam texto por si só.
- [ ] 3.3 Provar preservação byte a byte do prompt-base aprovado, prompt aprovado e prompt enviado em fluxos válidos.

## 4. Políticas e prompt-base

- [ ] 4.1 Habilitar apenas Produto + 1:1 com políticas versionadas Oferta, Destaque e Exclusivo nos registries/config da bancada.
- [ ] 4.2 Manter Oferta; definir Destaque com apresentação do produto e preço secundário informado; Exclusivo com apresentação sem preço e sem alegações/atributos inventados.
- [ ] 4.3 Usar o rótulo `Nome do produto obrigatório: {nome}`; preservar nome completo sem alterar palavras (capitalização, quebras de linha e arranjo livres); descrição opcional adaptável/melhorável/omitível sem mudar significado; texto obrigatório integral; manter revisão textual e `keep_exactly`. A mudança do rótulo versiona somente Produto como `48.2.6-produto-v2`.
- [ ] 4.4 Fazer ajuste pequeno e neutro no prompt-base reutilizável, sem regra específica de intenção; atualizar golden/versões sem alterar núcleo neutro.
- [ ] 4.5 Atualizar orientação de auxiliares para “As imagens auxiliares enriquecem a campanha; use-as sempre que possível.”; preservar protagonismo da principal, ordem/transporte e ausência de garantia de aparição.
- [ ] 4.6 Testar contribuições/instruções versionadas e disjuntas das três intenções, inclusão/omissão de preço e texto de política; não inferir sucesso visual do modelo; confirmar Serviço/outros formatos continuam desabilitados e fail-closed.
- [ ] 4.7 Serializar o nome como `Nome do produto obrigatório: {nome}` e versionar somente Produto como `48.2.6-produto-v2`, preservando literalmente a instrução de liberdade do nome.
- [ ] 4.8 Serializar `discountedPriceText` com rótulo neutro `Preço de venda`; versionar somente o compositor como `48.2.4-prompt-composer-v2`. Provar que Destaque com preço único preserva valor sem texto/versão Oferta, enquanto a semântica promocional permanece na instrução Oferta existente e inalterada.

## 5. Evidências e validação técnica

- [ ] 5.1 Reutilizar runs, snapshots, linhagem, preflight e telemetria; criar registro documental enxuto de rodada, rubrica UAT e manifesto do candidato sem tabela nova.
- [ ] 5.2 Confirmar protocolo manual `gpt-image-2.5-sunburst` medium, sem comparação de modelos; registrar custos/usage/latência por run sem inferir custo total a partir de tarifas por token.
- [ ] 5.3 Executar threat model/verificação proporcional: guard admin/local-only, chave exclusiva da bancada, isolamento/manifesto, segredos, CAS single-run e recusas sem side effects antes do provider.
- [ ] 5.4 Rodar testes relevantes, typecheck, lint e build sem chamada de provider; comprovar que adapters/transporte/pricing/banco/produção/migrations/créditos não foram alterados.

## 6. Checkpoints, UAT e fechamento documental

- [ ] 6.1 **CHECKPOINT A — responsável:** revisar matriz, políticas, validade exclusiva de Oferta, preservação de contratos de selos, threat model e gates antes de qualquer geração paga.
- [ ] 6.2 Após CHECKPOINT A aprovado, usuário prepara UAT local e confirma financeiramente cada execução de forma individual; nenhuma execução é tarefa autônoma.
- [ ] 6.3 **CHECKPOINT B — usuário:** avaliar manualmente Oferta, Destaque e Exclusivo quanto a produto/embalagem, nome, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência; registrar dados ausentes como `pending`; permitir encerramento com limitações somente com aceitação explícita e lacunas/follow-ups enumerados.
- [ ] 6.4 Congelar pacote candidato documental ligado aos runs, com versões, custo/fonte, latência, avaliações, limitações e decisão humana; não promover para produção.
- [ ] 6.5 Executor registra resultado em tracking de forma não destrutiva conforme UAT; entrega para revisão. Somente responsável executa `/opsx-verify`, `/opsx-sync` e `/opsx-archive`.
