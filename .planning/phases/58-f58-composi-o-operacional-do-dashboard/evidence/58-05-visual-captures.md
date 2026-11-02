# F58 — Capturas reais após correção visual

**Data:** 2026-11-02  
**Ambiente:** `npm.cmd run build` + `npm.cmd run start` em `http://localhost:3000` (produção local; sem dev overlay)  
**Base:** Supabase homolog local `http://127.0.0.1:57781`  
**Loja usada:** Padaria da Esquina (dados de homolog; e-mail da conta ocultado nas capturas)  
**Commit de código no momento das capturas:** `380832f9` + alterações visuais locais desta revisão  
**Natureza:** evidência visual para revisão; **não é aceite humano** e não comprova produção.

## Capturas

| Viewport | Arquivo | Dimensões |
|---|---|---|
| Desktop | `evidence/58-05-visual-desktop.png` | 1440 × 1200 |
| Mobile | `evidence/58-05-visual-mobile.png` | 390 × 844 (full page) |

## O que foi verificado nas capturas

- Lista compacta de três campanhas, com miniaturas pequenas e linha única por campanha.
- Créditos destacados no topo da lateral, com ícone e valor legível.
- Novidades agrupadas na lateral; atalho fixo “Que tal criar sua próxima campanha?” com ação “Criar campanha”.
- Orientação “Abra uma campanha para visualizar o conteúdo completo e baixá-lo para publicar.” abaixo da lista.
- Mobile: créditos → campanhas → atalho → novidades; sem scroll horizontal; alvos de toque preservados.
- Ausência dos blocos “Taxa de Sucesso”, “Próximo passo”, métricas técnicas e do bloco “Precisa ajustar a identidade da loja?”.
- Shell, sidebar, topbar e identidade preservados.

## Limites

- As capturas usam dados reais do homolog local, não produção.
- A sessão foi criada para a captura e não foi persistida no projeto.
- A comparação com a montagem de referência é visual/humana; nenhuma conclusão de aceite é registrada aqui.
- As mensagens es-419 foram cobertas por testes de catálogo e de página; esta captura é pt-BR.
