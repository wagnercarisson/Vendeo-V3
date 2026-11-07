# 59-10 — Geração manual acompanhada (prompt editorial v5)

## Status

**PREPARADO PARA A GERAÇÃO MANUAL.** A flag `product_9_16_enabled` foi
temporariamente ligada para este teste. Nenhuma chamada paga foi executada,
nenhum push/deploy. Desativar a flag imediatamente após a geração.

## Objetivo

Reavaliar visualmente, em UMA única geração acompanhada:

- fidelidade do ativo da loja;
- posicionamento nas áreas reservadas;
- hierarquia de preço;
- legibilidade e integridade dos textos;
- ausência de identidade inventada e de instruções duplicadas.

Versões esperadas na evidência:

- compositor: `f59-vertical-9-16-composer-v5`;
- formato: `f59-9-16-v3`;
- safe area: `safe-area-9-16-v1`.

## Caso de teste

- Loja: **Padaria da Esquina** (conta de homologação com crédito).
- Produto: **Bolo Naked Fruit**.
- Descrição: “Massa de pão de ló / Recheio e cobertura de frutas”.
- Intenção: **Oferta**.
- Fundo: **Estúdio**.
- Preço de venda: **R$ 69,90**; sem preço original.
- Selo: **Imperdível**; validade: **enquanto durarem os estoques**.
- Aviso obrigatório: **Imagem meramente ilustrativa**.
- Anexos: **1 produto + 1 ativo da loja**.

Prompt determinístico de referência (1.600 caracteres, 29 linhas):

`sha256 = 304242a4ea752774f544d9c6cdc8149f0034699e1361989910249cda93c5ed90`

Se o briefing/ativo forem diferentes, o hash muda; não trate a divergência como
falha sem antes conferir os dados congelados.

## Pré-condições

1. Confirmar que `product_9_16_enabled` está ON (já está ligada para este
   teste) e que a geração será única.
2. Confirmar saldo de crédito e ausência de operação em andamento.
3. Confirmar que o ativo da loja selecionado é o arquivo aprovado (hash do
   conteúdo igual ao `frozenContentReferences`).
4. Confirmar que a numeração dos anexos no prompt corresponde ao adapter real:
   produto primeiro, referências adicionais e ativo por último.
5. Nenhuma alteração em banco/migrations nesta etapa.

> **Seletor de formato:** ele permanece visível para lojas elegíveis. Com a flag
> ON, os dois rádios ficam habilitados. Após o teste, desligar a flag
> imediatamente.

## Execução (somente após autorização)

1. Confirmar a flag `product_9_16_enabled` ON no painel administrativo.
2. Executar UMA única geração do caso acima.
3. **Não repetir** a submissão em caso de falha; registrar e parar.
4. Desativar a flag imediatamente após o término (sucesso ou falha).
5. Não executar a matriz restante nem geração 1:1 nesta etapa.

## Evidências a capturar

- `campaignId`, `operationId`, tentativa e custo interno;
- prompt congelado/reconstruído e `policy_versions`;
- hashes dos anexos enviados (produto e ativo);
- arte JPEG 1080 × 1920 e path vertical;
- sobreposição da área segura (topo 14%, base 35%, laterais 6%, retângulo
  inferior direito 30% × 40%);
- telemetria `format=9:16` e `requestedSize=1152x2048`;
- decisão PASS/FAIL por critério.

## Critérios de aceite

- [ ] Ativo da loja reconhecível, sem recriação/descaracterização.
- [ ] Produto preservado (aparência e embalagem).
- [ ] Nome, preço, selo, validade e aviso integralmente legíveis e dentro da
      área protegida.
- [ ] Nenhum texto essencial nas faixas reservadas.
- [ ] Preço de venda em destaque; sem preço original inventado.
- [ ] Nenhuma identidade, texto ou informação comercial inventada.
- [ ] Fundo preenche todo o canvas, sem faixas vazias ou guias.
- [ ] Versões da evidência iguais às esperadas acima.

## Condições de parada

- Falha de fidelidade do ativo, violação de área segura, texto corrompido ou
  informação inventada ⇒ **FAIL**, flag OFF e nenhuma nova submissão.
- Qualquer erro de provider/crédito/telemetria ⇒ registrar e parar; não repetir
  sem nova autorização.
- Custo acima do orçamento aprovado ⇒ parar.

## Limitações

- Esta preparação não valida a resposta visual do modelo; apenas congela o
  procedimento e o prompt esperado.
- O prompt bruto do provider continua não persistido; a conferência é feita a
  partir da evidência congelada e da reconstrução determinística.
