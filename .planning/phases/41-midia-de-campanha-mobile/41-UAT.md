# Phase 41: Mídia de Campanha Mobile — UAT Local

**Contexto:** UAT local pós-implementação da F41 (form multi-imagem com câmera/HEIC/EXIF, transporte `productImages[]`, persistência dos inputs no storage — D5 nos dois fluxos, provider N `input_image`, prompts 1+N, validação primary-only, revisor com primary).
**Pré-requisito:** rodar o app local (`npm run dev`) e abrir `http://localhost:3000/campanhas/nova` com uma loja de teste.
**Obrigatório:** cenário 3 (câmera no **celular real**) — a fase não fecha sem ele (D4).

---

## Checklist

### Cenário 1 — Legado 1 imagem (D2/D5 — comportamento idêntico ao pós-F40)

- [ ] Gerar campanha com 1 imagem (galeria) → **comportamento idêntico ao pós-F40** (mesma UX/payload/geração/revisão/exportação).
- [ ] Snapshot (`input_snapshot`) preserva o shape sem base64 e **ganha `storagePath` aditivo para a primary persistida** (`{storeId}/{campaignId}/inputs/{imageId}.jpg`). `storagePath` ausente só em compatibilidade/legado histórico (campanhas pré-F41 ou caminhos excepcionais sem upload).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 2 — Primary + 2 auxiliares (galeria) (D2/D3/D6)

- [ ] Gerar com primary + 2 auxiliares (galeria) → preview grid com 3 itens, primary destacada ("Principal").
- [ ] `media.images[]` com 3 itens (roles/source/mimeType corretos — primary + 2 reference).
- [ ] Arte gerada usa a **primary como herói visual** e as auxiliares como contexto (D6).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 3 — Câmera no celular real (OBRIGATÓRIO — D4)

- [ ] Acessar o form no **celular real** (iOS e Android).
- [ ] Tirar foto **vertical e horizontal** pela câmera (`capture="environment"`) → imagem **não sai rotacionada** (orientação EXIF respeitada via `createImageBitmap from-image`).
- [ ] Foto **HEIC (iOS)** decodifica e vira JPEG na compressão (sem lib) → arte correta.
- [ ] Falha de decode HEIC → mensagem PT-BR clara ("Não foi possível processar a imagem HEIC. Use JPG ou PNG.").
- Resultado: [PASS / FAIL] — Observação:

### Cenário 4 — Remover/adicionar auxiliares e regenerar (D3)

- [ ] Remover um auxiliar do grid → preview atualiza.
- [ ] Remover a primary com auxiliares presentes → o próximo vira "Principal" (promoção).
- [ ] Adicionar até o teto (4 imagens) → controles desabilitam ("Máximo de 4 imagens").
- [ ] Regenerar → payload consistente com o grid.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 5 — Sem primary válida → erro claro (D2)

- [ ] Remover a única imagem e tentar gerar → erro claro **"Imagem do produto é obrigatória"** (400 na rota — regra de exclusividade, não Zod).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 6 — Campanha antiga (pré-F41) (D5)

- [ ] Abrir uma campanha criada **antes da F41** → continua exibindo/baixando normalmente (sem migração destrutiva, sem `storagePath` retroativo).
- Resultado: [PASS / FAIL] — Observação:

---

## Verificação no snapshot (opcional, admin/DB)

- `input_snapshot` da campanha multi com `media.images[]` contendo N itens (roles/source/mimeType), cada um com `storagePath` `{storeId}/{campaignId}/inputs/{imageId}.jpg` e **sem dataUrl**.
- Bucket `campaign-images`: objetos em `{storeId}/{campaignId}/inputs/` (JPEG via transcode).

---

## Instruções de preenchimento

1. Preencha cada cenário com **PASS** ou **FAIL**.
2. Em caso de **FAIL**, registre a observação e o passo a passo de repro (URL, campos preenchidos, dispositivo iOS/Android, orientação da foto).
3. Ao final, descreva quaisquer divergências de UX/comportamento observadas.

## Resumo do executor

| Cenário | Status | Observação |
|---------|--------|------------|
| 1 — Legado 1 imagem | PENDING | |
| 2 — Primary + 2 auxiliares | PENDING | |
| 3 — Câmera celular real (iOS/Android, HEIC/EXIF) | PENDING | OBRIGATÓRIO |
| 4 — Remover/adicionar e regenerar | PENDING | |
| 5 — Sem primary → 400 | PENDING | |
| 6 — Campanha antiga pré-F41 | PENDING | |
