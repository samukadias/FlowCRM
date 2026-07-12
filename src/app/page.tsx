import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { Stage } from "@/generated/prisma/enums";
import { STAGE_META, STAGE_ORDER, TONE_COLOR } from "@/lib/flow";
import { brl, tempoRelativo } from "@/lib/format";
import { FlowTrack } from "@/components/flow-track";
import { redirect } from "next/navigation";
import { obterSessao, podeAgir } from "@/lib/auth";
import { filtroPropostasVisiveis } from "@/lib/visibilidade";

export const dynamic = "force-dynamic";

function urlBusca(q: string | undefined, etapa: string | undefined) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (etapa) params.set("etapa", etapa);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function BuscaPropostas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etapa?: string }>;
}) {
  const { q, etapa } = await searchParams;
  const etapaValida = etapa && etapa in STAGE_META ? (etapa as Stage) : undefined;
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  const podeCriar = podeAgir(sessao, "COMERCIAL");
  const visiveis = filtroPropostasVisiveis(sessao);
  const analista = sessao.area !== "ADMIN" && sessao.perfil === "ANALISTA";

  const filtroTexto = q?.trim()
    ? {
        OR: [
          { codigo: { contains: q.trim(), mode: "insensitive" as const } },
          { cliente: { nome: { contains: q.trim(), mode: "insensitive" as const } } },
          { cliente: { sigla: { contains: q.trim(), mode: "insensitive" as const } } },
          { titulo: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};

  const [propostas, porEtapa] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        AND: [visiveis, filtroTexto, etapaValida ? { stage: etapaValida } : {}],
      },
      include: {
        cliente: { select: { nome: true } },
        eventos: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.opportunity.groupBy({
      by: ["stage"],
      where: { AND: [visiveis, filtroTexto] },
      _count: true,
    }),
  ]);

  const contagem = new Map(porEtapa.map((g) => [g.stage, g._count]));
  const total = porEtapa.reduce((s, g) => s + g._count, 0);
  const emAndamento = propostas.filter((p) => !STAGE_META[p.stage].terminal);
  const valorAndamento = emAndamento.reduce(
    (s, p) => s + Number(p.valorEstimado ?? 0),
    0,
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Propostas</h1>
          <p className="mt-1 text-sm text-muted">
            {total === 1 ? "1 proposta" : `${total} propostas`}
            {emAndamento.length > 0 && (
              <> · {brl.format(valorAndamento)} em andamento</>
            )}
            {analista && (
              <span className="text-faint"> · com o seu envolvimento</span>
            )}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {podeCriar && (
            <Link
              href="/propostas/nova"
              className="order-2 flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand-strong px-4 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-brand sm:order-1"
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nova proposta
            </Link>
          )}
        <form action="/" className="relative order-1 w-full max-w-sm flex-1 sm:order-2">
          {etapaValida && <input type="hidden" name="etapa" value={etapaValida} />}
          <Search
            size={15}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por código, cliente ou título"
            aria-label="Buscar propostas"
            className="h-10 w-full rounded-lg border border-line bg-card pr-3 pl-9 text-sm shadow-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
        </form>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        <Link
          href={urlBusca(q, undefined)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
            !etapaValida
              ? "border-brand-strong bg-brand-strong text-white shadow-sm"
              : "border-line bg-card text-muted shadow-sm hover:border-faint hover:text-ink"
          }`}
        >
          Todas
        </Link>
        {STAGE_ORDER.filter((s) => (contagem.get(s) ?? 0) > 0).map((s) => (
          <Link
            key={s}
            href={urlBusca(q, s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
              etapaValida === s
                ? "border-brand-strong bg-brand-strong text-white shadow-sm"
                : "border-line bg-card text-muted shadow-sm hover:border-faint hover:text-ink"
            }`}
          >
            {STAGE_META[s].label}
            <span className={etapaValida === s ? "opacity-70" : "text-faint"}>
              {" "}
              {contagem.get(s)}
            </span>
          </Link>
        ))}
      </div>

      {propostas.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-sm font-medium">
            {analista && !q?.trim() && !etapaValida
              ? "Você ainda não está envolvido em nenhuma proposta."
              : "Nenhuma proposta encontrada."}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {analista && !q?.trim() && !etapaValida
              ? "Quando o gestor da sua área delegar uma proposta a você (ou você participar de uma movimentação), ela aparece nesta lista."
              : "Busque pelo código (ex.: OPP-2026-0001), pelo nome do cliente ou por uma palavra do título. Você também pode limpar os filtros de etapa."}
          </p>
        </div>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <div className="hidden items-center gap-x-8 border-b border-line bg-surface px-5 py-2.5 md:grid md:grid-cols-[minmax(0,1fr)_250px_110px]">
            <span className="th-label">Proposta</span>
            <span className="th-label">Situação no fluxo</span>
            <span className="th-label text-right">Valor</span>
          </div>
        <ul className="divide-y divide-line-soft">
          {propostas.map((p) => {
            const meta = STAGE_META[p.stage];
            const desde = p.eventos[0]?.createdAt ?? p.updatedAt;
            return (
              <li key={p.id}>
                <Link
                  href={`/propostas/${p.id}`}
                  className="grid grid-cols-1 items-center gap-x-8 gap-y-4 px-5 py-4 transition-colors duration-150 hover:bg-surface md:grid-cols-[minmax(0,1fr)_250px_110px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs text-faint">{p.codigo}</span>
                      <span className="truncate text-xs text-muted">{p.cliente.nome}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium">{p.titulo}</p>
                  </div>
                  <div>
                    <FlowTrack stage={p.stage} />
                    <p className="mt-1.5 text-xs text-muted">
                      <span
                        className="font-medium"
                        style={{ color: TONE_COLOR[meta.tone] }}
                      >
                        {meta.label}
                      </span>
                      {!meta.terminal && <> · com {meta.quem}</>}
                      {" · "}
                      {tempoRelativo(desde)}
                    </p>
                  </div>
                  <p className="text-right text-sm font-medium tabular-nums max-md:text-left">
                    {p.valorEstimado != null
                      ? brl.format(Number(p.valorEstimado))
                      : "—"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
        </div>
      )}
    </div>
  );
}
