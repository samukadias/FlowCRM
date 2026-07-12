import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ATESTACAO_META,
  FILA_DONA,
  HEALTH_META,
  STAGE_META,
  TONE_COLOR,
  TRANSITIONS,
} from "@/lib/flow";
import { delegarProposta, moverProposta } from "@/app/propostas/actions";
import { brl, dataCurta, tempoRelativo } from "@/lib/format";
import { FlowTrack } from "@/components/flow-track";
import { StageBadge } from "@/components/stage-badge";
import { Pill } from "@/components/pill";
import { ProposalTimeline, type TimelineItem } from "@/components/proposal-timeline";
import { ehGestor, obterSessao, podeAtuar } from "@/lib/auth";
import { filtroPropostasVisiveis } from "@/lib/visibilidade";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DetalheProposta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  // A mesma regra de visibilidade da busca vale para o acesso direto por URL
  const p = await prisma.opportunity.findFirst({
    where: { AND: [{ id }, filtroPropostasVisiveis(sessao)] },
    include: {
      criadoPor: true,
      cliente: { select: { nome: true } },
      responsavel: { select: { name: true } },
      eventos: { orderBy: { createdAt: "desc" }, include: { user: true } },
      contrato: { include: { atestacoes: { orderBy: { competencia: "asc" } } } },
    },
  });
  if (!p) notFound();

  const meta = STAGE_META[p.stage];
  const desde = p.eventos[0]?.createdAt ?? p.updatedAt;
  const acoes = (TRANSITIONS[p.stage] ?? []).filter((t) =>
    podeAtuar(sessao, t.area, p.responsavelId),
  );
  // Gestor da área dona da fila atual pode delegar daqui mesmo
  const filaDona = FILA_DONA[p.stage];
  const podeDelegar = filaDona != null && ehGestor(sessao, filaDona);
  const equipe = podeDelegar
    ? await prisma.user.findMany({
      where: { area: filaDona, ativo: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    : [];

  const timelineItems: TimelineItem[] = p.eventos.map((e): TimelineItem => {
    if (e.eventType === "EMAIL" || e.eventType === "NOTE") {
      return {
        kind: "communication",
        id: e.id,
        type: e.eventType === "EMAIL" ? "email" : "note",
        from: e.user.name,
        subject: e.subject ?? "(sem assunto)",
        content: e.content ?? "",
        timestamp: e.createdAt,
      };
    }
    if (e.eventType === "ATTACHMENT") {
      return {
        kind: "attachment",
        id: e.id,
        name: e.fileName ?? "Arquivo",
        size: e.fileSize ?? 0,
        uploadedBy: e.user.name,
        timestamp: e.createdAt,
        url: e.fileUrl ?? undefined,
      };
    }
    const eMeta = e.paraStage ? STAGE_META[e.paraStage] : null;
    return {
      kind: "event",
      id: e.id,
      stage:
        e.deStage == null
          ? "Entrada registrada"
          : `Movida para ${eMeta?.label.toLowerCase() ?? "—"}`,
      tone: eMeta?.tone ?? "neutral",
      user: e.user.name,
      timestamp: e.createdAt,
      observation: e.observacao ?? undefined,
    };
  });

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para propostas
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-faint">{p.codigo}</span>
            <StageBadge stage={p.stage} />
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-balance">
            {p.titulo}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {p.cliente.nome} · registrada em {dataCurta.format(p.createdAt)} por{" "}
            {p.criadoPor.name}
          </p>
        </div>
        <div className="text-right max-sm:text-left">
          <p className="text-xs text-muted">Valor estimado</p>
          <p className="text-xl font-semibold tracking-tight tabular-nums">
            {p.valorEstimado != null ? brl.format(Number(p.valorEstimado)) : "—"}
          </p>
        </div>
      </div>

      <section className="card mt-8 px-6 pt-7 pb-5">
        <FlowTrack stage={p.stage} size="lg" />
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm text-muted">
            <span className="font-medium" style={{ color: TONE_COLOR[meta.tone] }}>
              {meta.label}
            </span>
            {!meta.terminal && <> · aguardando ação de <strong className="font-medium text-ink">{meta.quem}</strong></>}
            {" · "}nesta etapa {tempoRelativo(desde)}
            {!meta.terminal &&
              (p.responsavel ? (
                <> · responsável: <strong className="font-medium text-ink">{p.responsavel.name}</strong></>
              ) : (
                <> · <span className="font-medium text-warn">sem responsável</span></>
              ))}
          </p>
          {acoes.length > 0 && (
            <form action={moverProposta} className="mt-4 flex flex-wrap items-center gap-2.5">
              <input type="hidden" name="id" value={p.id} />
              <input
                name="observacao"
                placeholder="Observação (opcional)"
                aria-label="Observação da movimentação"
                className="h-9 min-w-52 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
              {acoes.map((t) =>
                t.destrutiva ? (
                  <button
                    key={t.para}
                    type="submit"
                    name="para"
                    value={t.para}
                    className="h-9 rounded-lg border border-line px-3.5 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
                  >
                    {t.rotulo}
                  </button>
                ) : (
                  <button
                    key={t.para}
                    type="submit"
                    name="para"
                    value={t.para}
                    className="h-9 rounded-lg bg-brand-strong px-3.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
                  >
                    {t.rotulo}
                  </button>
                ),
              )}
            </form>
          )}
          {podeDelegar && (
            <form action={delegarProposta} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <label className="text-xs text-muted" htmlFor="delegar-select">
                Delegar para
              </label>
              <select
                id="delegar-select"
                name="userId"
                defaultValue={p.responsavelId ?? ""}
                className="h-8 max-w-48 rounded-md border border-line bg-canvas px-2 text-xs outline-none focus:border-brand"
              >
                <option value="">— sem responsável</option>
                {equipe.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-8 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
              >
                Delegar
              </button>
            </form>
          )}
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="text-sm font-semibold">Histórico</h2>
          <div className="mt-4">
            <ProposalTimeline items={timelineItems} />
          </div>
        </section>

        <aside>
          <h2 className="text-sm font-semibold">Contrato</h2>
          {p.contrato ? (
            <div className="card mt-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm">{p.contrato.numero}</span>
                <Pill {...HEALTH_META[p.contrato.health]} />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Vigência</dt>
                  <dd className="tabular-nums">
                    {dataCurta.format(p.contrato.inicioVigencia)}
                    {p.contrato.fimVigencia && (
                      <> – {dataCurta.format(p.contrato.fimVigencia)}</>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Valor</dt>
                  <dd className="font-medium tabular-nums">
                    {brl.format(Number(p.contrato.valor))}
                  </dd>
                </div>
              </dl>

              {p.contrato.atestacoes.length > 0 && (
                <>
                  <h3 className="mt-6 text-xs font-semibold text-muted">
                    Atestações
                  </h3>
                  <ul className="mt-2 divide-y divide-line">
                    {p.contrato.atestacoes.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm tabular-nums">{a.competencia}</p>
                          <p className="text-xs text-muted tabular-nums">
                            {brl.format(Number(a.valor))}
                          </p>
                        </div>
                        <Pill {...ATESTACAO_META[a.status]} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">
              O contrato é criado quando o cliente aceita a proposta. Esta
              proposta ainda não chegou lá.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
