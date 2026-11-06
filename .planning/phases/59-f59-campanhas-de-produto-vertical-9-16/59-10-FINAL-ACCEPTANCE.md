# 59-10 — Aceite visual e checklist final da F59

## 1. Aceite visual do responsável

| Campanha | Resultado |
|---|---|
| Bolo Naked Fruit v14 | Composição aprovada; preço correto; aviso ilustrativo vertical adequado. **Exceção aceita:** validade na faixa inferior; campanha considerada publicável neste caso. |
| Pão de Queijo Mineiro 500gr v14 | Composição aprovada; cenário equilibrado; preços com separador decimal único; informações comerciais legíveis. |
| Pão Francês “Fresquinho” v14 | Composição aprovada; erro “garanti” originado na entrada, confirmado pelo responsável. |
| Pão Francês 1:1 | Evidência manual positiva do fluxo quadrado, separada da validação vertical. |

O aceite é **específico dessas artes**. A proteção da validade no prompt permanece;
a exceção do Bolo não vira regra geral. **Não se registra cumprimento integral das
margens.**

## 2. Campanhas, operações e versões

| Caso | Campanha / operação | Compositor / formato | Modelo / qualidade | Custo copy + imagem |
|---|---|---|---|---|
| Bolo v14 | `b367b5c0-6abe-4161-b2c7-c8dc2c9fc401` / `71864be0-25f1-47ef-a2a6-eed45b5af340` | `f59-vertical-9-16-composer-v14` / `f59-9-16-v12` | `gpt-image-2.5-sunburst` / `medium` | US$ 0,000175 + 0,030849 |
| Pão de Queijo v14 | `72ab9ddb-9e5d-4bc7-a994-c1dc0ec3bb88` / `b703b7c5-4dda-4038-9cba-7d471c98f278` | idem v14 / v12 | idem | US$ 0,000178 + 0,028801 |
| Pão Francês v14 | `3e7562ea-8fca-42ae-8e59-e75ac513db0f` / `c717a472-ad8d-40ee-9f9a-bad34baa364f` | idem v14 / v12 | idem | US$ 0,000076 + 0,030304 |
| Pão Francês 1:1 | `14278411-c1fd-4884-9760-ee0dcf98da06` / `31f4a160-34ef-4ecf-bd0e-d0e29fd6cf53` | `48.2.4-prompt-composer-v7` / `48.2.4-formato-1-1-v1` | idem | US$ 0,000173 + 0,031704 |

Políticas v14: intenção `48.2.6-oferta-v2`/`48.2.6-destaque-v2`, conteúdo
`48.2.6-produto-v4`, estrutura `48.2.4-peca-unica-v1`, tema
`48.2.4-tema-nenhum-v1`, geral `48.2.5-general-integrity-v1`, fundo
`48.2.6-background-direction-v2`, identidade `48.2.6-identity-context-v1`,
safe area `safe-area-9-16-experimental-v3`.

Commit do compositor: `69a50617`. Estado de preparação/docs: `eec0433a`.
O prompt bruto enviado ao provider não é persistido.

## 3. Prompt de referência — Bolo v14

```text
Crie uma campanha de oferta, em peça única.

[REFERÊNCIAS]
Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.
Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.

[DADOS DA CAMPANHA]
Loja: "Padaria da Esquina"
Produto: "Bolo Naked Fruit"
Descrição: "Massa de pão de ló\nRecheio e cobertura de frutas"
Preço: "R$ 69,90"
Selo: "Imperdível"
Validade: "enquanto durarem os estoques"
Aviso obrigatório: "Imagem meramente ilustrativa"
Paleta: principal #3B2418; apoio #D59D5E.

[COMPOSIÇÃO]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.
Exerça liberdade criativa na composição: explore enquadramento, iluminação, profundidade e hierarquia visual para criar uma campanha expressiva e comercialmente atraente, respeitando as informações fornecidas, o ativo da loja e as áreas protegidas.
Destaque o preço de venda.
Não invente informações comerciais.
Trate cada preço como uma única expressão monetária. Use exatamente uma vírgula entre a parte inteira e os centavos, quando houver centavos, mesmo quando tiverem tamanhos ou alinhamentos diferentes. Não repita a vírgula ao separar visualmente os centavos.
Use fundo de estúdio liso ou gradiente suave na paleta da loja, com bom contraste e sem objetos de apoio.
Antes de alterar as cores do ativo, ajuste posicionamento e fundo para obter contraste.
A descrição é opcional e pode ser adaptada ou omitida, preservando seu significado.
Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
O aviso ‘Imagem meramente ilustrativa’ pode ser aplicado horizontalmente ou rotacionado em 90°, conforme favorecer a composição. Preserve a frase integral, legível, com contraste adequado e dentro da área protegida. Não empilhe as letras.
Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.

[COMPOSIÇÃO PARA INSTAGRAM]
Os 5% superiores e os 20% inferiores são exclusivos para fundo. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas. Textos obrigatórios não devem funcionar como rodapé da imagem.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.930 caracteres, 37 linhas.
- SHA-256: `c8a5899ab0f50cd08e321ec9ba30e28d767097d14de0bbc2fd623a637efa020f`.

Outros prompts v14:

- Pão de Queijo: SHA-256 `a567d25d012737ef3d3af293dc584d0df289ed34ff072135dfc7912ff8e94ef9`.
- Pão Francês: SHA-256 `0682fd7c4d51c48fa5be2d92d97b153852fa0d072e3bde14808f74059c5325f5`.

Todos são reconstruções determinísticas; não há captura literal do provider.

## 4. Checklist

### Comprovado

- Geração e entrega das três campanhas v14 (Bolo, Pão de Queijo, Pão Francês).
- JPEG 1080×1920 e path `product-9-16/.../art-1080x1920.jpg` nas três.
- Miniaturas WebP presentes para as três verticais e para o 1:1.
- Crédito de 1 por campanha, status `delivered` nas quatro operações.
- Copy e custo registrados por campanha.
- Regra monetária validada visualmente no Bolo e no Pão de Queijo (separador único).
- 1:1 do Pão Francês: arte 1024×1024, path `product-1-1/.../art-1024.jpg`, miniatura presente.
- Suíte 1:1 (943 testes) e testes verticais (238) verdes; typecheck, lint, build, OpenSpec e diff check verdes.

### Aceites manuais confirmados (fora de pendências)

Estes itens foram confirmados pelo responsável e **não** constam mais como pendência
manual. Eles não substituem teste automatizado nem integração real.

| Item | Evidência | Natureza |
|---|---|---|
| Bolo Naked Fruit v14 | composição, preço e aviso ilustrativo aprovados; validade na faixa inferior aceita como exceção | aceite manual |
| Pão de Queijo Mineiro 500gr v14 | composição, cenário, separador decimal único e legibilidade aprovados | aceite manual |
| Pão Francês “Fresquinho” v14 | composição aprovada; “garanti” classificado como erro de entrada | aceite manual |
| Pão Francês 1:1 | fluxo quadrado aprovado em evidência manual separada | aceite manual |
| Falha por saldo insuficiente | retorno à tela de dados com campos e formato preservados | aceite manual |

O teste manual de saldo insuficiente **não** aprova concorrência, idempotência nem
integração real de crédito; esses gates continuam pendentes.

### Pendente

- Ciclo de flag OFF: consulta/download/recuperação de campanhas existentes e rejeição de nova submissão antes de reserva/provider.
- Recuperação/resolução de operações existentes (resultado desconhecido, falha confirmada com estorno, reenvio, operação já entregue) até detalhe/listagem.
- Restauração de formulário vertical com flag ON e OFF, sem troca silenciosa para 1:1.
- Verificação manual de detalhe, listagem, dashboard (quando em escopo), download e miniatura na UI.
- Previews de Reels e outras interfaces além de Stories Facebook/Instagram.
- Falha, concorrência e idempotência.

### Ressalva aceita

- **Bolo:** validade na faixa inferior; campanha considerada publicável neste caso. A proteção da validade permanece no prompt; a exceção não é regra geral.
- **Pão Francês:** “garanti” é erro de entrada; a arte não está pronta para publicação com esse erro.
- Produto/complementos avançando nas faixas é permitido quando a identificação permanece.
- A faixa superior é apenas 5%; a região entre 5% e 15% não é protegida.
- O aceite visual é específico das artes apresentadas; não é cumprimento integral das margens.

### Bloqueador

- Nenhum bloqueador técnico local identificado.
- Para conclusão da fase, permanecem bloqueantes por falta de autorização/execução: ciclo de flag OFF e recuperação/resolução de operações.

## 5. Saldos e novas gerações

- Créditos disponíveis: **0**.
- Teto: **US$ 2,20**; gasto **US$ 2,0882**; margem **US$ 0,1118**.
- **Nenhuma nova geração é necessária** para a cobertura visual atual (Estúdio com preço, Ambientado com preço original + promocional e Original com Pão Francês já executados na v14).
- Se surgir necessidade de nova geração, ela depende de crédito e autorização específicos; **não há ampliação automática de teto**.

## 6. Parecer consolidado

- **Aceite visual:** aprovado com ressalvas específicas (Bolo: validade na faixa inferior; Pão Francês: erro de entrada).
- **Aceites manuais:** aprovados e reconciliados (artes v14, 1:1 e falha por saldo insuficiente); não aprovam gates técnicos.
- **Fase F59:** **PENDENTE** — faltam flag OFF real, recuperação/resolução real, restauração com flag OFF, UI manual de detalhe/listagem/download/miniatura, concorrência e idempotência real.
- **Próximo gate recomendado:** executar o procedimento `59-10-FLAG-OFF-PROCEDURE.md` com autorização (flag OFF no homolog atual) e o bloco read-only de detalhe/listagem/download/miniatura; depois avaliar a cobertura real isolada.
- O aceite visual **não** autoriza conclusão da fase, arquivamento, ativação em produção ou publicação.
