# Evidência visual — quick 261106-qxn

**Data:** 2026-11-06
**Ambiente:** build local de produção (`next start` em `127.0.0.1:3000`), Supabase local (`127.0.0.1:57781`)
**Conta:** loja existente “Padaria da Esquina” (`is_test_store = true`)
**Dados:** campanhas existentes; nenhuma geração foi confirmada ou disparada
**Produção:** intocada

---

## 1. Capturas

| Arquivo | Tela | Viewport |
|---|---|---|
| `desktop-formulario.png` | `/campanhas/nova` — edição normal | 1440 × 900 |
| `desktop-1280-formulario.png` | `/campanhas/nova` — duas colunas | 1280 × 900 |
| `desktop-1024-formulario.png` | `/campanhas/nova` — empilhado com sidebar | 1024 × 900 |
| `mobile-formulario.png` | `/campanhas/nova` — edição normal | 390 × 844 |
| `mobile-375-formulario.png` | `/campanhas/nova` — edição normal | 375 × 844 |
| `mobile-320-formulario.png` | `/campanhas/nova` — edição normal | 320 × 844 |
| `desktop-revisao.png` | revisão do brief — vertical | 1440 × 900 |
| `desktop-1280-revisao.png` | revisão do brief — vertical | 1280 × 900 |
| `mobile-revisao.png` | revisão do brief — vertical | 390 × 844 |
| `mobile375-revisao.png` | revisão do brief — vertical | 375 × 844 |
| `mobile320-revisao.png` | revisão do brief — vertical | 320 × 844 |
| `desktop-listagem.png` | `/campanhas` | 1440 × 900 |
| `mobile-listagem.png` | `/campanhas` | 390 × 844 |
| `desktop-dashboard.png` | `/dashboard` | 1440 × 900 |
| `mobile-dashboard.png` | `/dashboard` | 390 × 844 |

Os PNGs são capturas de página inteira via Chrome DevTools Protocol, sem dependência nova.

---

## 2. Medições do cabeçalho

O grid é decidido pelo espaço real do container, não por um breakpoint de viewport.

| Viewport | Largura do `<main>` | Largura do cabeçalho | Colunas computadas | Overflow horizontal |
|---|---:|---:|---|---|
| 1440 px | 1216 px | 992 px | `484px 484px` | Não |
| 1280 px | 1056 px | 976 px | `476px 476px` | Não |
| 1024 px | 800 px | 720 px | `720px` (empilhado) | Não |
| 900 px | 676 px | 596 px | `596px` (empilhado) | Não |
| 375 px | — | 311 px | `311px` (empilhado) | Não |
| 320 px | — | 256 px | `256px` (empilhado) | Não |

**Decisão documentada:** o mínimo de 30rem (480 px) deixava 1280 px sempre empilhado
(976 px < 2 × 480 px + 24 px de gap). O limiar foi reduzido para **29rem (464 px)**
depois da medição real. Com isso, 1280 px e 1440 px exibem duas colunas; 1024 px
e abaixo empilham. O seletor mantém 476 px em 1280 px e 484 px em 1440 px, sem
compressão do label longo.

---

## 3. Observações visuais

- **Edição normal:** título/subtítulo e seletor no mesmo cabeçalho; em 1440/1280,
  título à esquerda e seletor na metade direita; em 1024/900, empilhado com seletor
  em largura total antes dos campos.
- **Rótulo visível:** “Formato da campanha” aparece no seletor; opções e textos
  permanecem os atuais.
- **Revisão:** título/subtítulo preservados; seletor ausente; “Formato” mostra
  “Quadrado 1:1”; “Direção de fundo” aparece imediatamente depois, com “Estúdio”.
- **Listagem:** rótulos “9:16 vertical” e “1:1 quadrado” aparecem junto à data,
  fora da miniatura, em cards existentes.
- **Dashboard:** rótulo “9:16 vertical” aparece junto à data, fora da miniatura.
- **Sem overflow horizontal** em 1440, 1280, 1024, 900, 390 e 320 px.
- Nenhuma geração foi confirmada; nenhuma chamada paga foi feita.

### 3.1 Acabamento do card Oferta — coluna de rótulos em 128 px

- A coluna dos rótulos passou de `w-28` (112 px) para `w-32` (128 px) uniformemente
  em todas as linhas do card Oferta; o `gap` e o alinhamento dos valores foram
  mantidos.
- “Direção de fundo” mede **128 px de largura e 20 px de altura (1 linha)** em
  1440 px e 1280 px. O mesmo ocorre em 390/375/320 px.
- Os valores ganharam `min-w-0 break-words`; não há `nowrap`, truncamento ou
  redução de fonte. O valor vertical quebra naturalmente:
  “Vertical 9:16 1080 × 1920 px”.
- Em 320 px, o card Oferta tem 256 px de largura; o valor do formato quebra em
  linhas e não há overflow horizontal.
- Medições em `review-polish-results.json`.

---

## 4. Limitações

- A captura usa o Chrome headless local; não substitui leitor de tela real.
- As capturas mobile usam DPR 1; a leitura em DPR 2/3 não foi recapturada.
- A navegação por teclado foi validada por testes de estrutura/foco e inspeção
  manual básica, não por um leitor de tela real.
- A conta local foi autenticada por link de recuperação de uso único do Supabase
  local; nenhuma senha, token ou cookie foi registrado neste documento.
