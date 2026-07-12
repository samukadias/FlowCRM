import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AREA_LABELS, PERFIL_LABELS } from "@/lib/flow";
import { dataCurta } from "@/lib/format";
import { obterSessao, podeAgir } from "@/lib/auth";
import { alternarAtivo } from "./actions";
import { Pill } from "@/components/pill";

export const dynamic = "force-dynamic";

export const metadata = { title: "Usuários — PropostaFlow" };

export default async function Usuarios() {
  const sessao = await obterSessao();
  if (!podeAgir(sessao, "ADMIN")) redirect("/");

  const usuarios = await prisma.user.findMany({
    orderBy: [{ ativo: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted">
            {usuarios.length} cadastrado{usuarios.length === 1 ? "" : "s"} ·
            desativados não conseguem entrar, mas o histórico deles é preservado.
          </p>
        </div>
        <Link
          href="/usuarios/novo"
          className="flex h-10 shrink-0 items-center rounded-lg bg-brand-strong shadow-sm px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
        >
          Novo usuário
        </Link>
      </div>

      <ul className="mt-6 card divide-y divide-line-soft overflow-hidden">
        {usuarios.map((u) => (
          <li
            key={u.id}
            className={`grid grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_130px_110px_110px_auto] ${
              u.ativo ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {u.name}
                {u.id === sessao.id && (
                  <span className="ml-2 text-xs font-normal text-faint">(você)</span>
                )}
              </p>
              <p className="truncate text-xs text-muted">{u.email}</p>
            </div>
            <span className="text-sm text-muted">
              {AREA_LABELS[u.area]}
              <span className="block text-xs text-faint">{PERFIL_LABELS[u.perfil]}</span>
            </span>
            <div>
              <Pill
                label={u.ativo ? "Ativo" : "Desativado"}
                tone={u.ativo ? "success" : "neutral"}
              />
            </div>
            <span className="text-xs text-faint tabular-nums">
              desde {dataCurta.format(u.createdAt)}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/usuarios/${u.id}`}
                className="h-8 rounded-md border border-line px-3 text-xs leading-8 font-medium text-muted transition-colors duration-150 hover:text-ink"
              >
                Editar
              </Link>
              {u.id !== sessao.id && (
                <form action={alternarAtivo}>
                  <input type="hidden" name="id" value={u.id} />
                  <button
                    type="submit"
                    className={`h-8 rounded-md border border-line px-3 text-xs font-medium transition-colors duration-150 ${
                      u.ativo
                        ? "text-danger hover:bg-danger-soft"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {u.ativo ? "Desativar" : "Reativar"}
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
