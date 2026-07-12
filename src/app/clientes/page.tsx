import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { dataCurta } from "@/lib/format";
import { excluirCliente } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clientes — PropostaFlow" };

export default async function Clientes() {
  const sessao = await obterSessao();
  const pode =
    sessao != null &&
    (sessao.area === "ADMIN" ||
      (sessao.area === "PROPOSTAS" && sessao.perfil === "GESTOR"));
  if (!pode) redirect("/");

  const clientes = await prisma.cliente.findMany({
    include: { _count: { select: { propostas: true } } },
    orderBy: { nome: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted">
            {clientes.length} cadastrado{clientes.length === 1 ? "" : "s"} ·
            usados na criação de novas propostas.
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="flex h-10 shrink-0 items-center rounded-lg bg-brand-strong shadow-sm px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
        >
          Novo cliente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          Nenhum cliente ainda. Cadastre o primeiro para o Comercial poder
          registrar propostas.
        </p>
      ) : (
        <ul className="mt-6 card divide-y divide-line-soft overflow-hidden">
          {clientes.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-3.5 md:grid-cols-[130px_minmax(0,1fr)_140px_120px_auto]"
            >
              <span className="font-mono text-xs font-medium">{c.sigla}</span>
              <p className="truncate text-sm font-medium">{c.nome}</p>
              <span className="text-xs text-muted tabular-nums">
                {c._count.propostas === 1
                  ? "1 proposta"
                  : `${c._count.propostas} propostas`}
              </span>
              <span className="text-xs text-faint tabular-nums">
                desde {dataCurta.format(c.createdAt)}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/clientes/${c.id}`}
                  className="h-8 rounded-md border border-line px-3 text-xs leading-8 font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  Editar
                </Link>
                {c._count.propostas === 0 && (
                  <form action={excluirCliente}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="h-8 rounded-md border border-line px-3 text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
                    >
                      Excluir
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
