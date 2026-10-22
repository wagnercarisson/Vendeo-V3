## 1. N├║cleo de CNPJ

- [x] 1.1 Atualizar `src/lib/cnpj/normalize.ts` para remover somente formata├º├úo conhecida (`.`, `/`, `-`, espa├ºos), converter `a-z` para mai├║scula e N├âO descartar caracteres desconhecidos (acentos, emojis, s├¡mbolos). — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.2 Atualizar `src/lib/cnpj/validate.ts` para validar `^[A-Z0-9]{12}[0-9]{2}$`, rejeitar qualquer caractere fora de `[0-9A-Za-z./\-\s]`, calcular os dois DVs por `charCode ÔêÆ 48` com os pesos oficiais e retornar `"CNPJ deve ter 14 caracteres"` apenas para comprimento ap├│s remover formata├º├úo. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.3 Garantir que a lista de sequ├¬ncias num├®ricas conhecidas continue rejeitada e que CNPJs num├®ricos retornem exatamente o mesmo `normalized` de antes. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.4 Atualizar `src/lib/cnpj/mask.ts` para aceitar o padr├úo can├┤nico alfanum├®rico, preservar as posi├º├Áes 9ÔÇô12 e retornar `"CNPJ inv├ílido"` para entrada fora do padr├úo (fail-closed). — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.5 Criar `src/lib/cnpj/input-mask.ts` com `hasInvalidCnpjChars`, `formatCnpjInput(raw, previousValue)` fail-closed e `formatCnpj` (exibi├º├úo completa), reutilizando a normaliza├º├úo estrita no valor can├┤nico. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.6 Atualizar `src/lib/cnpj/types.ts` e coment├írios de `hash.ts` para refletir o CNPJ can├┤nico alfanum├®rico; n├úo alterar o algoritmo do HMAC. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md
- [x] 1.7 Substituir normaliza├º├Áes locais de CNPJ (`replace(/\D/g, "")`) por `normalizeCnpj`/`formatCnpjInput` em todos os pontos mapeados. — Evidência: 50.3-EVIDENCE.md §9; suíte src/lib/cnpj (100 testes); 50.3-01-SUMMARY.md

## 2. Provedores e orquestra├º├úo

- [x] 2.1 Adicionar `unsupported_format` e `supportsAlphanumeric` aos tipos/contrato de `src/lib/cnpj/lookup-providers/types.ts`. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.2 Atualizar `BrasilApiProvider` para mapear HTTP 400/422 de CNPJ alfanum├®rico para `unsupported_format`, tratar 404 alfanum├®rico como amb├¡guo quando `supportsAlphanumeric = false` e manter 400/422 num├®rico como `unavailable`. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.3 Atualizar `CnpjaProvider` com as mesmas regras de `unsupported_format` e 404 amb├¡guo, preservando timeout, retry, 429 e 5xx. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.4 Atualizar `CnpjVerificationService.resolve` para normalizar antes do cache, tentar fallback em 404 amb├¡guo, s├│ cachear `not_found` conclusivo e retornar `unavailable` quando houver mistura de `unsupported_format` + `unavailable`. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.5 Garantir que `cnpj_lookup_cache` use somente a chave can├┤nica e que caixa/pontua├º├úo n├úo criem entradas duplicadas. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md
- [x] 2.6 Adicionar testes de contrato dos dois provedores para 200, 404 num├®rico, 404 alfanum├®rico amb├¡guo, 404 alfanum├®rico conclusivo, 400/422 alfanum├®rico, 400/422 num├®rico, 429, 5xx e timeout. — Evidência: 50.3-EVIDENCE.md §9; testes de contrato dos provedores + verification-service; 50.3-02-SUMMARY.md

## 3. APIs e contratos

- [x] 3.1 Atualizar o schema de `src/app/api/store/update-cnpj/route.ts` para aceitar CNPJ can├┤nico alfanum├®rico e canonicalizar antes de validar. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.2 Garantir que `update-cnpj` calcule `cnpj_root_hash` a partir da raiz can├┤nica e trate `unsupported_format` sem persistir dados fiscais. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.3 Atualizar `POST /api/store` para canonicalizar antes de validar, comparar duplicidade, consultar e persistir; em `unsupported_format` definitivo, criar com `defer` e `reason = api_unsupported_format`; em mistura com indisponibilidade, usar `api_unavailable`; sem grant em ambos. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.4 Atualizar `GET /api/cnpj/lookup` para aceitar alfanum├®rico e retornar `status: "unsupported_format"` somente quando todos os provedores tentados rejeitarem explicitamente o formato; caso contr├írio retornar `unavailable`. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.5 Atualizar `reconsult-cnpj` para tratar `unsupported_format` como indisponibilidade controlada, sem sobrescrever dados oficiais. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.6 Atualizar `admin/stores/create-test` para calcular o hash a partir do CNPJ can├┤nico. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md
- [x] 3.7 Revisar schemas Zod, mensagens e coment├írios de API que ainda dizem ÔÇ£14 d├¡gitosÔÇØ e corrigir somente onde o contrato passou a ser alfanum├®rico. — Evidência: 50.3-EVIDENCE.md §9; testes de rota (210 testes agregados); 50.3-03-SUMMARY.md

## 4. UI de onboarding, legado e admin

- [x] 4.1 Atualizar `src/components/flow/store-identity-form.tsx` para detectar `hasInvalidCnpjChars` no onChange/colagem, manter o ├║ltimo valor v├ílido, exibir erro local, limpar lookup e bloquear consulta/submiss├úo; usar `formatCnpj` para exibi├º├úo. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.2 Atualizar a compara├º├úo de CNPJ persistido no `store-identity-form.tsx` para `normalizeCnpj(formData.cnpj) === initialStore.cnpj_normalized`. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.3 Atualizar `src/components/flow/use-store-form.ts` para normalizar o CNPJ antes de POST create, PATCH/update-cnpj e elegibilidade de fiscal no auto-save. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.4 Atualizar `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx` para m├íscara alfanum├®rica, detec├º├úo de caractere desconhecido, erro local e bloqueio de envio. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.5 Atualizar a tela admin `create-test-store` para m├íscara alfanum├®rica e placeholder `XX.XXX.XXX/XXXX-DV`. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.6 Confirmar que todas as exibi├º├Áes admin usam `maskCnpj` e que o sufixo alfanum├®rico ├® preservado. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.7 Ajustar placeholders, `maxLength`, `autoCapitalize` e textos auxiliares sem alterar o design system existente. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.8 Garantir que o erro local de CNPJ s├│ seja limpo ap├│s `validateCnpj` retornar sucesso e que entradas parciais v├ílidas mantenham o erro anterior. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md
- [x] 4.9 Garantir que colar `12.ABC.345/01DE-35­ƒÿÇ` n├úo dispare `/api/cnpj/lookup` no blur nem submeta o formul├írio, em onboarding e em `/cadastro/cnpj`. — Evidência: 50.3-EVIDENCE.md §9; testes de componente/hook; UAT itens 2 e 3; 50.3-04-SUMMARY.md

## 5. Banco de dados e migration

- [x] 5.1 Criar migration forward-only `supabase/migrations/<timestamp>_f50_3_cnpj_alfanumerico.sql` sem editar migrations hist├│ricas. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.2 Incluir pr├®-checagem fail-closed: CNPJ n├úo nulo fora do novo padr├úo, CNPJ sem root hash, dados fiscais sem CNPJ e contagem informativa de alfanum├®ricos existentes. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.3 Recriar `chk_stores_cnpj_atomic` com `^[A-Z0-9]{12}[0-9]{2}$`, usando `NOT VALID` + `VALIDATE CONSTRAINT` em transa├º├úo. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.4 Atualizar coment├írios de `stores.cnpj_normalized`, `stores.cnpj_root_hash` e `cnpj_lookup_cache.cnpj_normalized`. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.5 Incluir p├│s-checagem que confirme a defini├º├úo da constraint e a aus├¬ncia de reescrita de CNPJs. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.6 Garantir que a migration n├úo altera `stores.user_id`, RLS, `freemium_entitlements`, trial de 28 dias, cr├®ditos ou ├¡ndices existentes. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md
- [x] 5.7 Documentar rollback em duas fases: antes de existir CNPJ alfanum├®rico, reverter a aplica├º├úo; depois do primeiro dado alfanum├®rico, n├úo voltar para vers├úo numeric-only, usar corre├º├úo forward-only ou vers├úo de emerg├¬ncia que leia/preserve o valor, com write freeze se necess├írio. — Evidência: 50.3-06-SUMMARY.md; migration no isolado com 25/25 asserções; 50.3-ROLLBACK.md

## 6. Testes e vetores oficiais

- [x] 6.1 Atualizar `src/lib/cnpj/__tests__/normalize.test.ts` com letras preservadas, min├║sculas, pontua├º├úo, espa├ºos, acentos e emojis (sem descarte silencioso). — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.2 Atualizar `src/lib/cnpj/__tests__/validate.test.ts` com `12.ABC.345/01DE-35` v├ílido, `12.ABC.345/01DE-34` inv├ílido, DVs alfab├®ticos inv├ílidos, `00000000000000` rejeitado e regress├úo num├®rica completa. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.3 Adicionar testes de `hasInvalidCnpjChars`, `formatCnpjInput(raw, previousValue)`, `formatCnpj` e `maskCnpj` alfanum├®rico, incluindo placeholder fail-closed para entrada inv├ílida. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.4 Adicionar teste de hash garantindo que raiz can├┤nica alfanum├®rica e num├®rica produzem os hashes esperados e que caixa/pontua├º├úo n├úo mudam o hash. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.5 Adicionar testes de cache hit/miss com entrada mascarada, min├║scula e can├┤nica, comprovando uma ├║nica chave e que 404 amb├¡guo n├úo cacheia `not_found`. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.6 Adicionar testes de integra├º├úo para cria├º├úo, atualiza├º├úo, reconsulta, duplicidade, `unsupported_format` definitivo, mistura com `unavailable`, `not_found` conclusivo e respostas de erro. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.7 Adicionar regress├úo para CNPJs num├®ricos existentes em APIs, componentes e invariantes de freemium. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.8 Criar `scripts/verify/50-3-cnpj-alfanumerico-verification.mjs` para validar a constraint local com a matriz de vetores e as checagens pr├®/p├│s-migration. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)
- [x] 6.9 Adicionar testes de componente garantindo que `12.ABC.345/01DE-35­ƒÿÇ` mant├®m o ├║ltimo valor v├ílido, exibe erro, n├úo chama lookup no blur e n├úo submete; e que o erro s├│ ├® limpo ap├│s entrada v├ílida. — Evidência: suítes de teste F50.3; 50.3-EVIDENCE.md §7; 50.3-08-SUMMARY.md (drift)

## 7. Verifica├º├úo e checkpoints

- [x] 7.1 Checkpoint 1: rodar `npm run typecheck`, `npm run lint` e testes unit├írios do n├║cleo CNPJ; corrigir antes de seguir. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [x] 7.2 Checkpoint 2: rodar testes de provedores, orquestra├º├úo e APIs; confirmar que CNPJs num├®ricos n├úo regrediram. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [x] 7.3 Checkpoint 3: aplicar a migration em banco local e rodar o script de verifica├º├úo pr├®/p├│s; confirmar constraint e dados intactos. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [x] 7.4 Checkpoint 4: rodar `npm run test` completo e `npm run build`. — Evidência: 50.3-07-SUMMARY.md; 50.3-EVIDENCE.md §1–6
- [ ] 7.5 Checkpoint 5: valida├º├úo manual local do fluxo de onboarding com CNPJ num├®rico, o vetor de c├ílculo `12.ABC.345/01DE-35` e o primeiro CNPJ alfanum├®rico emitido `00.000.000/E08G-12` (digita├º├úo, colagem, edi├º├úo, m├íscara, erro de DV, caractere inv├ílido sem lookup/envio, cache hit/miss e reconsulta). — Cobertura: máscara, colagem hostil, DV e bloqueio (UAT itens 1–3); persistência canônica + hash via test store (item 5). Lacuna: validação manual completa de onboarding/cache/reconsulta em loja normal. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [x] 7.6 Registrar evid├¬ncias de valida├º├úo no change (comandos, resultados e limita├º├Áes) sem aplicar migration remota. — Evidência: 50.3-EVIDENCE.md §9

## 8. Documenta├º├úo, limites e follow-ups

- [x] 8.1 Atualizar coment├írios, tipos e textos que dizem ÔÇ£14 d├¡gitosÔÇØ apenas onde o contrato passou a ser alfanum├®rico. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.2 Registrar a limita├º├úo atual de `substring(cnpj_normalized, 9, 4) = '0001'` para identifica├º├úo de matriz e a depend├¬ncia de revis├úo antes de reativar o freemium legado. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.3 Registrar que a oferta individualizada por CNPJ completo ├® F50.4 e que esta fase n├úo introduz depend├¬ncia entre CNPJ e `user_id`. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.4 Registrar que provedores ainda podem n├úo suportar o formato e que a pol├¡tica de verifica├º├úo atual foi preservada; qualquer relaxamento ├® decis├úo futura. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8
- [x] 8.5 Confirmar explicitamente que n├úo houve altera├º├úo de trial de 28 dias, bloqueio por raiz, `freemium_entitlements`, ownership, RLS, saldos, grants, enrollments ou flags. — Evidência: docs/alinhamento-fase-50-3-cnpj-alfanumerico.md; 50.3-EVIDENCE.md §8

## 9. Crit├®rios de aceite

- [x] 9.1 Autom├ítico: `validateCnpj` aceita `12.ABC.345/01DE-35`, `00.000.000/E08G-12` e `12.345.678/0001-95`; rejeita `12.ABC.345/01DE-34`, `12.ABC.345/01DE-3A`, `12.ABC.345/01DE-3`, `12.ABC.345/01DE-355`, `12.ABC.345/01DE-35­ƒÿÇ` e `12.├üBC.345/01DE-35`. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.2 Autom├ítico: `normalizeCnpj` remove s├│ formata├º├úo conhecida, converte para mai├║scula e n├úo descarta caracteres desconhecidos. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.3 Autom├ítico: `maskCnpj("12ABC34501DE35") === "**.***.***/01DE-**"` e entrada inv├ílida retorna `"CNPJ inv├ílido"`, nunca o valor cru. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.4 Autom├ítico: o hash da raiz de `12.abc.345/01de-35` ├® id├¬ntico ao de `12ABC34501DE35`. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.5 Autom├ítico: CNPJs num├®ricos existentes mant├¬m valor, hash, m├íscara e comportamento de cache. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.6 Autom├ítico: a constraint local aceita os dois formatos e rejeita os inv├ílidos, sem alterar linhas existentes. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.7 Autom├ítico: `hasInvalidCnpjChars` detecta emoji/acento/s├¡mbolo; `formatCnpjInput("12.ABC.345/01DE-35­ƒÿÇ", "12.ABC") === "12.ABC"`. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.8 Manual: colar `12.ABC.345/01DE-35­ƒÿÇ` mant├®m o ├║ltimo valor v├ílido, exibe erro local, n├úo chama lookup e n├úo submete; o erro s├│ ├® limpo ap├│s entrada v├ílida. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [ ] 9.9 Manual: criar loja com CNPJ alfanum├®rico v├ílido e confirmar persist├¬ncia can├┤nica, raiz correta e m├íscara admin. — Cobertura: máscara e exibição admin (UAT item 8, PASS). Lacuna: criação de loja com lookup real alfanumérico não exercitada. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [ ] 9.10 Manual: atualizar loja legada com CNPJ alfanum├®rico v├ílido e confirmar atomicidade, aus├¬ncia de cr├®ditos e reconsulta. — Cobertura: persistência canônica + hash + defer via test store (UAT item 5); loja normal retorna 503 por design (item 4). Lacuna: atualização de loja legada normal com provedor compatível. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [ ] 9.11 Manual: simular provedor sem suporte (400/422 e 404), confirmar fallback, aus├¬ncia de falso `not_found`, cache n├úo envenenado e mensagem controlada. — Cobertura: fallback, cache e ausência de falso not_found (UAT itens 4, 6 e 7) + probes reais 404. Lacuna: provedor real com suporte alfanumérico (resolved) não comprovado; supportsAlphanumeric permanece false. Disposição: encerramento com limitação — approved_with_limitations (2026-10-21).
- [x] 9.12 Manual: confirmar que rollback ap├│s existir CNPJ alfanum├®rico n├úo usa vers├úo numeric-only e que o plano forward-only/write-freeze est├í documentado. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9
- [x] 9.13 Manual: confirmar que nenhuma mudan├ºa comercial, de ownership ou de modelo institucional foi introduzida. — Evidência: testes automáticos F50.3; 50.3-EVIDENCE.md §9

## Reconciliação documental (2026-10-22)

> UAT aceito como `approved_with_limitations` (2026-10-21) e plano 08 concluído (CR-01/WR-01 fechados).
> Convenção: `[x]` = critério comprovado; `[ ]` = cobertura parcial aceita com lacuna e disposição explícitas — não é execução integral.
> Resultado real: **65/69 concluídas** · **4/69 abertas com disposição de encerramento com limitação** (7.5, 9.9, 9.10, 9.11).
> Follow-ups consolidados em `FOLLOW-UPS.md`; evidências em `50.3-EVIDENCE.md` (adendo 2026-10-22).
