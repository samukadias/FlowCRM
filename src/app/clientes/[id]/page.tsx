import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import {
  atualizarCliente,
  criarContato,
  definirContatoPrincipal,
  excluirContato,
} from "@/app/clientes/actions";
import { ClienteForm } from "@/components/cliente-form";
import { ProposalTimeline, type TimelineItem } from "@/components/proposal-timeline";
import { STAGE_META, TONE_COLOR } from "@/lib/flow";
import { brl, dataCurta } from "@/lib/format";

export const metadata = { title: "Editar cliente — PropostaFlow" };

const campo =
  "h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

export default async function EditarCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await obterSessao();
  const pode =
    sessao != null &&
    (sessao.area === "ADMIN" ||
      (sessao.area === "PROPOSTAS" && sessao.perfil === "GESTOR"));
  if (!pode) redirect("/");
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { contatos: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }] } },
  });
  if (!cliente) notFound();

  const [propostas, eventos] = await Promise.all([
    prisma.opportunity.findMany({
      where: { clienteId: id },
      select: { id: true, codigo: true, titulo: true, stage: true, valorEstimado: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.workflowEvent.findMany({
      where: { opportunity: { clienteId: id } },
      include: { user: { select: { name: true } }, opportunity: { select: { codigo: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const valorTotal = propostas.reduce((s, p) => s + Number(p.valorEstimado ?? 0), 0);

  const timelineItems: TimelineItem[] = eventos.map((e): TimelineItem => {
    const prefixo = `${e.opportunity.codigo} · `;
    if (e.eventType === "EMAIL" || e.eventType === "NOTE") {
      return {
        kind: "communication",
        id: e.id,
        type: e.eventType === "EMAIL" ? "email" : "note",
        from: e.user.name,
        subject: prefixo + (e.subject ?? (e.eventType === "NOTE" ? "Nota interna" : "(sem assunto)")),
        content: e.content ?? "",
        timestamp: e.createdAt,
      };
    }
    if (e.eventType === "ATTACHMENT") {
      return {
        kind: "attachment",
        id: e.id,
        name: prefixo + (e.fileName ?? "Arquivo"),
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
      stage: prefixo + (e.deStage == null ? "Entrada registrada" : `Movida para ${eMeta?.label.toLowerCase() ?? "—"}`),
      tone: eMeta?.tone ?? "neutral",
      user: e.user.name,
      timestamp: e.createdAt,
      observation: e.observacao ?? undefined,
    };
  });

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/clientes"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para clientes
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Editar cliente</h1>
      <p className="mt-1 text-sm text-muted">
        Alterar o nome atualiza todas as propostas deste cliente.
      </p>
      <ClienteForm action={atualizarCliente} cliente={cliente} erro={erro} />

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="text-sm font-semibold">Contatos</h2>
        <p className="mt-0.5 text-xs text-muted">
          Interlocutores deste cliente — o principal aparece em destaque.
        </p>

        {cliente.contatos.length > 0 && (
          <ul className="card mt-4 divide-y divide-line-soft overflow-hidden">
            {cliente.contatos.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {c.nome}
                    {c.principal && (
                      <Star size={13} strokeWidth={2} className="fill-warn text-warn" aria-label="Contato principal" />
                    )}
                  </p>
                  {c.cargo && <p className="text-xs text-muted">{c.cargo}</p>}
                  {(c.email || c.telefone) && (
                    <p className="mt-0.5 text-xs text-faint">
                      {[c.email, c.telefone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!c.principal && (
                    <form action={definirContatoPrincipal}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="clienteId" value={cliente.id} />
                      <button
                        type="submit"
                        className="rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                      >
                        Tornar principal
                      </button>
                    </form>
                  )}
                  <form action={excluirContato}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="clienteId" value={cliente.id} />
                    <button
                      type="submit"
                      aria-label={`Excluir contato ${c.nome}`}
                      className="rounded-md p-1.5 text-faint transition-colors duration-150 hover:text-danger"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={criarContato} className="card mt-4 flex flex-wrap items-end gap-2 p-4">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <label className="min-w-32 flex-1 text-xs font-medium text-muted">
            Nome
            <input name="nome" required placeholder="Ex.: Marina Alves" className={`${campo} mt-1 w-full`} />
          </label>
          <label className="min-w-28 flex-1 text-xs font-medium text-muted">
            Cargo
            <input name="cargo" placeholder="Ex.: Financeiro" className={`${campo} mt-1 w-full`} />
          </label>
          <label className="min-w-40 flex-1 text-xs font-medium text-muted">
            E-mail
            <input type="email" name="email" placeholder="marina@cliente.com" className={`${campo} mt-1 w-full`} />
          </label>
          <label className="min-w-32 flex-1 text-xs font-medium text-muted">
            Telefone
            <input name="telefone" placeholder="(11) 99999-0000" className={`${campo} mt-1 w-full`} />
          </label>
          <button
            type="submit"
            className="h-9 rounded-lg bg-brand-strong px-4 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-brand"
          >
            Adicionar
          </button>
        </form>
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="text-sm font-semibold">
          Propostas <span className="font-normal text-faint">{propostas.length}</span>
        </h2>
        {propostas.length > 0 ? (
          <>
            <p className="mt-0.5 text-xs text-muted">{brl.format(valorTotal)} no total</p>
            <ul className="card mt-4 divide-y divide-line-soft overflow-hidden">
              {propostas.map((p) => {
                const meta = STAGE_META[p.stage];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/propostas/${p.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xs text-faint">{p.codigo}</span>
                          <span
                            className="text-xs font-medium"
                            style={{ color: TONE_COLOR[meta.tone] }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium">{p.titulo}</p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {p.valorEstimado != null ? brl.format(Number(p.valorEstimado)) : "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">Nenhuma proposta registrada para este cliente ainda.</p>
        )}
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="text-sm font-semibold">Atividade recente</h2>
        <p className="mt-0.5 text-xs text-muted">
          Consolidado de todas as propostas deste cliente — até as 40 últimas movimentações.
        </p>
        <div className="mt-4">
          <ProposalTimeline
            items={timelineItems}
            emptyMessage="Nenhuma atividade registrada ainda para as propostas deste cliente."
          />
        </div>
      </div>

      <p className="mt-8 text-xs text-faint">Cliente desde {dataCurta.format(cliente.createdAt)}.</p>
    </div>
  );
}
