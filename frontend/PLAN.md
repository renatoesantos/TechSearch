# TechSearch Frontend Plan

## Design

### Style options
- **Inteligência de mercado editorial** — 0.07: dashboard escuro, tipografia monoespacial e acentos de preço.
- **Balcão técnico luminoso** — 0.06: superfícies claras, verde-lima de economia e cards de dados.
- **Minimalismo de laboratório** — 0.05: branco/cinza, azul de precisão e visual quase documental.

**Escolha:** Balcão técnico luminoso.

**Design Movement:** e-commerce analytics com a clareza de um terminal financeiro, mas com a energia de uma ferramenta de montagem de PC.

**Core Principles:** contraste alto; densidade informacional controlada; ações de alerta sempre visíveis; mobile-first.

**Color Philosophy:** grafite estrutura a navegação; branco mantém preço e status legíveis; verde-lima é reservado para economia, queda e confirmação; azul identifica ações de navegação.

**Layout Paradigm:** shell lateral no desktop e navegação inferior no mobile; conteúdo em trilhas horizontais e painéis de leitura, evitando um grid de cards genérico como estrutura principal.

**Signature Elements:** marcador vertical verde-lima nos preços; etiquetas de economia com raio pequeno; linhas de gráfico pontilhadas para metas.

**Interaction Philosophy:** cada tela responde à pergunta “qual é a melhor decisão agora?”; busca e preço são primários, configurações ficam secundárias.

**Animation:** transições de 150–220ms; entrada suave de painéis; nenhum movimento essencial para compreender preço ou status.

**Typography System:** Inter para interface e títulos; IBM Plex Mono para valores, datas e IDs técnicos.

**Brand Essence:** TechSearch ajuda montadores brasileiros a comprar hardware no menor preço histórico, sem ruído. Personalidade: preciso, econômico, técnico.

**Brand Voice:** “Compre quando o preço fizer sentido.” / “Seu alvo está definido; nós monitoramos o resto.”

**Wordmark & Logo:** um “T” formado por duas barras de comparação, uma azul e uma verde-lima, acompanhado do wordmark TechSearch.

**Signature Brand Color:** verde-lima `#B7F34A`, reservado para economia e alertas positivos.

## Implementation

- React + Vite + TypeScript.
- Tailwind CSS para tokens de layout e responsividade.
- Recharts para histórico de preços.
- `src/lib/api.ts` com contrato HTTP e fallback demo.
- `src/data/demo.ts` com catálogo, ofertas, histórico, listas e alertas iniciais.
- `localStorage` para manter modo demo entre reloads.
- Shell responsivo: sidebar desktop, bottom nav mobile.

## Frontend serving

O frontend roda em `5173`, com `VITE_API_URL` apontando para a API Express em `http://localhost:3333`. O Vite faz proxy de `/api` e `/health` no desenvolvimento.
