## 1. Núcleo de CNPJ

- [x] 1.1 Atualizar `src/lib/cnpj/normalize.ts` para remover somente formatação conhecida (`.`, `/`, `-`, espaços), converter `a-z` para maiúscula e NÃO descartar caracteres desconhecidos (acentos, emojis, símbolos). — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.2 Atualizar `src/lib/cnpj/validate.ts` para validar `^[A-Z0-9]{12}[0-9]{2}$`, rejeitar qualquer caractere fora de `[0-9A-Za-z./\-\s]`, calcular os dois DVs por `charCode − 48` com os pesos oficiais e retornar `"CNPJ deve ter 14 caracteres"` apenas para comprimento após remover formatação. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.3 Garantir que a lista de sequências numéricas conhecidas continue rejeitada e que CNPJs numéricos retornem exatamente o mesmo `normalized` de antes. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.4 Atualizar `src/lib/cnpj/mask.ts` para aceitar o padrão canônico alfanumérico, preservar as posições 9–12 e retornar `"CNPJ inválido"` para entrada fora do padrão (fail-closed). — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.5 Criar `src/lib/cnpj/input-mask.ts` com `hasInvalidCnpjChars`, `formatCnpjInput(raw, previousValue)` fail-closed e `formatCnpj` (exibição completa), reutilizando a normalização estrita no valor canônico. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.6 Atualizar `src/lib/cnpj/types.ts` e comentários de `hash.ts` para refletir o CNPJ canônico alfanumérico; não alterar o algoritmo do HMAC. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.7 Substituir normalizações locais de CNPJ (`replace(/\D/g, "")`) por `normalizeCnpj`/`formatCnpjInput` em todos os pontos mapeados. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md

## 2. Provedores e orquestração

- [x] 2.1 Adicionar `unsupported_format` e `supportsAlphanumeric` aos tipos/contrato de `src/lib/cnpj/lookup-providers/types.ts`. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.2 Atualizar `BrasilApiProvider` para mapear HTTP 400/422 de CNPJ alfanumérico para `unsupported_format`, tratar 404 alfanumérico como ambíguo quando `supportsAlphanumeric = false` e manter 400/422 numérico como `unavailable`. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.3 Atualizar `CnpjaProvider` com as mesmas regras de `unsupported_format` e 404 ambíguo, preservando timeout, retry, 429 e 5xx. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.4 Atualizar `CnpjVerificationService.resolve` para normalizar antes do cache, tentar fallback em 404 ambíguo, só cachear `not_found` conclusivo e retornar `unavailable` quando houver mistura de `unsupported_format` + `unavailable`. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.5 Garantir que `cnpj_lookup_cache` use somente a chave canônica e que caixa/pontuação não criem entradas duplicadas. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.6 Adicionar testes de contrato dos dois provedores para 200, 404 numérico, 404 alfanumérico ambíguo, 404 alfanumérico conclusivo, 400/422 alfanumérico, 400/422 numérico, 429, 5xx e timeout. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md

## 3. APIs e contratos

- [x] 3.1 Atualizar o schema de `src/app/api/store/update-cnpj/route.ts` para aceitar CNPJ canônico alfanumérico e canonicalizar antes de validar. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.2 Garantir que `update-cnpj` calcule `cnpj_root_hash` a partir da raiz canônica e trate `unsupported_format` sem persistir dados fiscais. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.3 Atualizar `POST /api/store` para canonicalizar antes de validar, comparar duplicidade, consultar e persistir; em `unsupported_format` definitivo, criar com `defer` e `reason = api_unsupported_format`; em mistura com indisponibilidade, usar `api_unavailable`; sem grant em ambos. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.4 Atualizar `GET /api/cnpj/lookup` para aceitar alfanumérico e retornar `status: "unsupported_format"` somente quando todos os provedores tentados rejeitarem explicitamente o formato; caso contrário retornar `unavailable`. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.5 Atualizar `reconsult-cnpj` para tratar `unsupported_format` como indisponibilidade controlada, sem sobrescrever dados oficiais. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.6 Atualizar `admin/stores/create-test` para calcular o hash a partir do CNPJ canônico. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.7 Revisar schemas Zod, mensagens e comentários de API que ainda dizem “14 dígitos” e corrigir somente onde o contrato passou a ser alfanumérico. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md

## 4. UI de onboarding, legado e admin

- [x] 4.1 Atualizar `src/components/flow/store-identity-form.tsx` para detectar `hasInvalidCnpjChars` no onChange/colagem, manter o último valor válido, exibir erro local, limpar lookup e bloquear consulta/submissão; usar `formatCnpj` para exibição. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.2 Atualizar a comparação de CNPJ persistido no `store-identity-form.tsx` para `normalizeCnpj(formData.cnpj) === initialStore.cnpj_normalized`. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.3 Atualizar `src/components/flow/use-store-form.ts` para normalizar o CNPJ antes de POST create, PATCH/update-cnpj e elegibilidade de fiscal no auto-save. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.4 Atualizar `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx` para máscara alfanumérica, detecção de caractere desconhecido, erro local e bloqueio de envio. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.5 Atualizar a tela admin `create-test-store` para máscara alfanumérica e placeholder `XX.XXX.XXX/XXXX-DV`. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.6 Confirmar que todas as exibições admin usam `maskCnpj` e que o sufixo alfanumérico é preservado. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.7 Ajustar placeholders, `maxLength`, `autoCapitalize` e textos auxiliares sem alterar o design system existente. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.8 Garantir que o erro local de CNPJ só seja limpo após `validateCnpj` retornar sucesso e que entradas parciais válidas mantenham o erro anterior. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.9 Garantir que colar `12.ABC.345/01DE-35😀` não dispare `/api/cnpj/lookup` no blur nem submeta o formulário, em onboarding e em `/cadastro/cnpj`. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md

## 5. Banco de dados e migration

- [x] 5.1 Criar migration forward-only `supabase/migrations/<timestamp>_f50_3_cnpj_alfanumerico.sql` sem editar migrations históricas. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.2 Incluir pré-checagem fail-closed: CNPJ não nulo fora do novo padrão, CNPJ sem root hash, dados fiscais sem CNPJ e contagem informativa de alfanuméricos existentes. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.3 Recriar `chk_stores_cnpj_atomic` com `^[A-Z0-9]{12}[0-9]{2}$`, usando `NOT VALID` + `VALIDATE CONSTRAINT` em transação. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.4 Atualizar comentários de `stores.cnpj_normalized`, `stores.cnpj_root_hash` e `cnpj_lookup_cache.cnpj_normalized`. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.5 Incluir pós-checagem que confirme a definição da constraint e a ausência de reescrita de CNPJs. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.6 Garantir que a migration não altera `stores.user_id`, RLS, `freemium_entitlements`, trial de 28 dias, créditos ou índices existentes. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.7 Documentar rollback em duas fases: antes de existir CNPJ alfanumérico, reverter a aplicação; depois do primeiro dado alfanumérico, não voltar para versão numeric-only, usar correção forward-only ou versão de emergência que leia/preserve o valor, com write freeze se necessário. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md

## 6. Testes e vetores oficiais

- [x] 6.1 Atualizar `src/lib/cnpj/__tests__/normalize.test.ts` com letras preservadas, minúsculas, pontuação, espaços, acentos e emojis (sem descarte silencioso). — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.2 Atualizar `src/lib/cnpj/__tests__/validate.test.ts` com `12.ABC.345/01DE-35` válido, `12.ABC.345/01DE-34` inválido, DVs alfabéticos inválidos, `00000000000000` rejeitado e regressão numérica completa. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.3 Adicionar testes de `hasInvalidCnpjChars`, `formatCnpjInput(raw, previousValue)`, `formatCnpj` e `maskCnpj` alfanumérico, incluindo placeholder fail-closed para entrada inválida. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.4 Adicionar teste de hash garantindo que raiz canônica alfanumérica e numérica produzem os hashes esperados e que caixa/pontuação não mudam o hash. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.5 Adicionar testes de cache hit/miss com entrada mascarada, minúscula e canônica, comprovando uma única chave e que 404 ambíguo não cacheia `not_found`. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.6 Adicionar testes de integração para criação, atualização, reconsulta, duplicidade, `unsupported_format` definitivo, mistura com `unavailable`, `not_found` conclusivo e respostas de erro. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.7 Adicionar regressão para CNPJs numéricos existentes em APIs, componentes e invariantes de freemium. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.8 Criar `scripts/verify/50-3-cnpj-alfanumerico-verification.mjs` para validar a constraint local com a matriz de vetores e as checagens pré/pós-migration. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.9 Adicionar testes de componente garantindo que `12.ABC.345/01DE-35😀` mantém o último valor válido, exibe erro, não chama lookup no blur e não submete; e que o erro só é limpo após entrada válida. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)

## 7. Verificação e checkpoints

- [x] 7.1 Checkpoint 1: rodar `npm run typecheck`, `npm run lint` e testes unitários do núcleo CNPJ; corrigir antes de seguir. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [x] 7.2 Checkpoint 2: rodar testes de provedores, orquestração e APIs; confirmar que CNPJs numéricos não regrediram. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [x] 7.3 Checkpoint 3: aplicar a migration em banco local e rodar o script de verificação pré/pós; confirmar constraint e dados intactos. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [x] 7.4 Checkpoint 4: rodar `npm run test` completo e `npm run build`. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [ ] 7.5 Checkpoint 5: validação manual local do fluxo de onboarding com CNPJ numérico, o vetor de cálculo `12.ABC.345/01DE-35` e o primeiro CNPJ alfanumérico emitido `00.000.000/E08G-12` (digitação, colagem, edição, máscara, erro de DV, caractere inválido sem lookup/envio, cache hit/miss e reconsulta). — Cobertura: máscara, colagem hostil, DV e bloqueio (UAT itens 1–3); persistência canônica + hash via test store (item 5). Lacuna: validação manual completa de onboarding/cache/reconsulta em loja normal. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [x] 7.6 Registrar evidências de validação no change (comandos, resultados e limitações) sem aplicar migration remota. — Evidência: 50.3-EVIDENCE.md §9

## 8. Documentação, limites e follow-ups

- [x] 8.1 Atualizar comentários, tipos e textos que dizem “14 dígitos” apenas onde o contrato passou a ser alfanumérico. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.2 Registrar a limitação atual de `substring(cnpj_normalized, 9, 4) = '0001'` para identificação de matriz e a dependência de revisão antes de reativar o freemium legado. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.3 Registrar que a oferta individualizada por CNPJ completo é F50.4 e que esta fase não introduz dependência entre CNPJ e `user_id`. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.4 Registrar que provedores ainda podem não suportar o formato e que a política de verificação atual foi preservada; qualquer relaxamento é decisão futura. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.5 Confirmar explicitamente que não houve alteração de trial de 28 dias, bloqueio por raiz, `freemium_entitlements`, ownership, RLS, saldos, grants, enrollments ou flags. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8

## 9. Critérios de aceite

- [x] 9.1 Automático: `validateCnpj` aceita `12.ABC.345/01DE-35`, `00.000.000/E08G-12` e `12.345.678/0001-95`; rejeita `12.ABC.345/01DE-34`, `12.ABC.345/01DE-3A`, `12.ABC.345/01DE-3`, `12.ABC.345/01DE-355`, `12.ABC.345/01DE-35😀` e `12.ÁBC.345/01DE-35`. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.2 Automático: `normalizeCnpj` remove só formatação conhecida, converte para maiúscula e não descarta caracteres desconhecidos. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.3 Automático: `maskCnpj("12ABC34501DE35") === "**.***.***/01DE-**"` e entrada inválida retorna `"CNPJ inválido"`, nunca o valor cru. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.4 Automático: o hash da raiz de `12.abc.345/01de-35` é idêntico ao de `12ABC34501DE35`. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.5 Automático: CNPJs numéricos existentes mantêm valor, hash, máscara e comportamento de cache. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.6 Automático: a constraint local aceita os dois formatos e rejeita os inválidos, sem alterar linhas existentes. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.7 Automático: `hasInvalidCnpjChars` detecta emoji/acento/símbolo; `formatCnpjInput("12.ABC.345/01DE-35😀", "12.ABC") === "12.ABC"`. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.8 Manual: colar `12.ABC.345/01DE-35😀` mantém o último valor válido, exibe erro local, não chama lookup e não submete; o erro só é limpo após entrada válida. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [ ] 9.9 Manual: criar loja com CNPJ alfanumérico válido e confirmar persistência canônica, raiz correta e máscara admin. — Cobertura: máscara e exibição admin (UAT item 8, PASS). Lacuna: criação de loja com lookup real alfanumérico não exercitada. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [ ] 9.10 Manual: atualizar loja legada com CNPJ alfanumérico válido e confirmar atomicidade, ausência de créditos e reconsulta. — Cobertura: persistência canônica + hash + defer via test store (UAT item 5); loja normal retorna 503 por design (item 4). Lacuna: atualização de loja legada normal com provedor compatível. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [ ] 9.11 Manual: simular provedor sem suporte (400/422 e 404), confirmar fallback, ausência de falso `not_found`, cache não envenenado e mensagem controlada. — Cobertura: fallback, cache e ausência de falso not_found (UAT itens 4, 6 e 7) + probes reais 404. Lacuna: provedor real com suporte alfanumérico (resolved) não comprovado; supportsAlphanumeric permanece false. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [x] 9.12 Manual: confirmar que rollback após existir CNPJ alfanumérico não usa versão numeric-only e que o plano forward-only/write-freeze está documentado. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.13 Manual: confirmar que nenhuma mudança comercial, de ownership ou de modelo institucional foi introduzida. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9


## Reconciliação documental (2026-10-22)

> UAT aceito como `approved_with_limitations` (2026-10-21) e plano 08 concluído (CR-01/WR-01 fechados).
> Convenção: `[x]` = critério comprovado; `[ ]` = cobertura parcial aceita com lacuna e disposição explícitas — não é execução integral.
> Resultado real: **65/69 concluídas** · **4/69 abertas com disposição de encerramento com limitação** (7.5, 9.9, 9.10, 9.11).
> Follow-ups consolidados em `FOLLOW-UPS.md`; evidências em `50.3-EVIDENCE.md` (adendo 2026-10-22).
