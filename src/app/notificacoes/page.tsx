import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { tempoRelativo } from "@/lib/format";
import { abrirNotificacao, marcarTodasLidas } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notificações — PropostaFlow" };

export default async function Notificacoes() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  const notificacoes = await prisma.notification.findMany({
    where: { userId: sessao.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
          <p className="mt-1 text-sm text-muted">
            {naoLidas > 0
              ? `${naoLidas} não lida${naoLidas === 1 ? "" : "s"}`
              : "Tudo em dia."}
          </p>
        </div>
        {naoLidas > 0 && (
          <form action={marcarTodasLidas}>
            <button
              type="submit"
              className="h-9 rounded-lg border border-line px-3.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink"
            >
              Marcar todas como lidas
            </button>
          </form>
        )}
      </div>

      {notificacoes.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          Nada por aqui ainda. Você será avisado quando uma proposta entrar na
          fila da sua área.
        </p>
      ) : (
        <ul className="mt-6 card divide-y divide-line-soft overflow-hidden">
          {notificacoes.map((n) =>
            n.lida ? (
              <li key={n.id}>
                <Link
                  href={n.link}
                  className="flex items-baseline justify-between gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-surface"
                >
                  <span className="min-w-0 truncate text-sm text-muted">
                    {n.titulo}
                  </span>
                  <span className="shrink-0 text-xs text-faint tabular-nums">
                    {tempoRelativo(n.createdAt)}
                  </span>
                </Link>
              </li>
            ) : (
              <li key={n.id}>
                <form action={abrirNotificacao}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="flex w-full items-baseline justify-between gap-4 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface"
                  >
                    <span className="flex min-w-0 items-baseline gap-2.5">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 self-center rounded-full bg-brand"
                      />
                      <span className="truncate text-sm font-medium">{n.titulo}</span>
                    </span>
                    <span className="shrink-0 text-xs text-faint tabular-nums">
                      {tempoRelativo(n.createdAt)}
                    </span>
                  </button>
                </form>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
