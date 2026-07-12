# Design

Sistema visual do PropostaFlow. Registro: **product** (a interface serve a tarefa).

## Tema

Claro, app-shell premium: **página em neutro frio** (`--canvas`, tipo
slate-50) com **superfícies brancas elevadas em cards** (`--card` + sombra
sutil). Sóbrio: a confiança de um documento bem diagramado, não a energia de
um dashboard de startup. Cor é informação (estado do fluxo, saúde do
contrato), nunca decoração.

## Cores (OKLCH, definidas em `src/app/globals.css`)

| Token | Valor | Uso |
|---|---|---|
| `--canvas` | L 0.981, matiz 240 | Fundo da página (neutro frio) |
| `--card` | `oklch(1 0 0)` | Cards, listas, header (superfície elevada) |
| `--surface` / `--surface-2` | L 0.972 / 0.952 | Hover de linhas, faixas de cabeçalho de tabela, nav ativa |
| `--ink` | L 0.21, matiz 240 | Texto principal |
| `--muted` / `--faint` | L 0.45 / 0.60 | Texto secundário / terciário |
| `--line` / `--line-soft` | L 0.915 / 0.945 | Bordas de card / divisores de linha |
| `--brand` | `oklch(0.49 0.13 238)` | Indigo-cobalto: progresso no fluxo, foco, nav ativa |
| `--brand-strong` | L 0.40 | Botões primários e chips ativos (texto branco) |
| `--ok` / `--warn` / `--danger` | matizes 155 / 70 / 25 | Estados: aceita/saudável, ajustes/atenção, recusada/crítico |
| `*-soft` | L ~0.96 | Fundos de badges (texto na cor do tom + ring interno 1px a 18%) |

Regra: tom escuro (L ≤ 0.52) sobre fundo soft (L ≥ 0.95) nos badges;
branco sobre `--brand-strong` em elementos preenchidos.

## Utilitários e padrões de componente

- `card` — superfície padrão: `--card` + borda `--line` + rounded-xl +
  `--shadow-card` (sombra dupla bem leve). Listas usam
  `card divide-y divide-line-soft overflow-hidden`.
- `th-label` — cabeçalho de coluna: 11px, caixa alta, tracking 0.06em,
  cor `--faint`, sobre faixa `--surface`.
- **Ícones**: lucide-react, 15–17px, stroke 1.75; na nav (cinza, brand quando
  ativa), no input de busca e nos CTAs (`Plus`, `LogOut`, `Bell`).
- **Foco**: `:focus-visible` global com outline 2px `--brand`; inputs usam
  ring própria (`focus:ring-2 ring-brand/25`).
- **Header**: sticky, `--card` com blur, marca "P" em quadrado brand,
  avatar com iniciais em `--brand-soft`. Mobile: nav vira ícones-only e o
  wordmark some (fica só o "P").

## Tipografia

Geist Sans (UI inteira) + Geist Mono (códigos: OPP-…, CTR-…, competências).
Escala contida de produto: h1 `text-2xl font-semibold tracking-tight`;
corpo `text-sm`; metadados `text-xs`. Números em `tabular-nums`.

## Componentes

- **FlowTrack** (`src/components/flow-track.tsx`) — a régua dos 6 marcos do
  fluxo. `sm` nas listas (só pontos), `lg` no detalhe (com rótulos). O passo
  atual pulsa (`.flow-current`, desativado em `prefers-reduced-motion`).
  Recusada/cancelada: trilha cinza, marco final na cor do estado.
- **StageBadge / Pill** — pílula com fundo soft + texto no tom do estado,
  sempre com rótulo em texto (nunca só cor).
- **Linhas de resultado** — grid `[info | régua+status | valor]`, divisores
  `--line`, hover `--surface`, transição 150 ms.
- **Timeline** (detalhe) — pontos coloridos pelo tom da etapa de destino,
  linha vertical `--line`, observações em bloco `--surface`.
- **Gráficos** (relatórios) — barras horizontais de um matiz só (`--brand`),
  ≤ 24px de espessura, ponta arredondada 4px e base reta, valor rotulado na
  ponta em token de texto (nunca na cor da série); stat tiles com rótulo
  `text-xs muted` + valor `text-2xl semibold`. Sem legendas para série única,
  sem dois eixos, sem paleta categórica.

## Motion

150–250 ms, easing suave, só para estado (hover, foco, pulso do passo atual).
Sem coreografia de carregamento de página.

## Layout

Contêiner `max-w-6xl`, topo fixo com blur leve, conteúdo em `px-6 py-10`.
Mobile: linhas empilham (grid → 1 coluna), nav do topo rola horizontalmente.
