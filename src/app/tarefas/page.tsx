import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { dataCurta } from "@/lib/format";
import { criarTarefa, concluirTarefa, excluirTarefa } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Minhas tarefas — PropostaFlow" };

const campo =
  "h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

function inicioDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type TarefaComRelacoes = Awaited<ReturnType<typeof buscarTarefas>>[number];

async function buscarTarefas(responsavelId: string) {
  return prisma.tarefa.findMany({
    where: { responsavelId },
    include: {
      opportunity: { select: { id: true, codigo: true, titulo: true } },
      criadoPor: { select: { name: true } },
    },
    orderBy: [{ concluida: "asc" }, { dataLimite: "asc" }],
  });
}

function Grupo({
  titulo,
  lista,
  corPrazo,
  sessaoId,
  sessaoArea,
}: {
  titulo: string;
  lista: TarefaComRelacoes[];
  corPrazo?: "danger";
  sessaoId: string;
  sessaoArea: string;
}) {
  if (lista.length === 0) return null;
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="text-sm font-semibold">
        {titulo} <span className="ml-1 font-normal text-faint">{lista.length}</span>
      </h2>
      <ul className="card mt-3 divide-y divide-line-soft overflow-hidden">
        {lista.map((t) => {
          const podeExcluir = sessaoArea === "ADMIN" || sessaoId === t.criadoPorId;
          return (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3">
              <form action={concluirTarefa} className="mt-0.5">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="concluida" value={t.concluida ? "0" : "1"} />
                <button
                  type="submit"
                  aria-label={t.concluida ? "Reabrir tarefa" : "Concluir tarefa"}
                  className={`flex size-5 items-center justify-center rounded-md border transition-colors duration-150 ${
                    t.concluida
                      ? "border-ok bg-ok-soft text-ok"
                      : "border-line text-transparent hover:border-brand hover:text-brand"
                  }`}
                >
                  <Check size={13} strokeWidth={2.5} />
                </button>
              </form>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${t.concluida ? "text-muted line-through" : ""}`}>
                  {t.titulo}
                </p>
                {t.descricao && <p className="mt-0.5 text-xs text-muted">{t.descricao}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-faint">
                  {t.dataLimite && (
                    <span className={corPrazo === "danger" && !t.concluida ? "font-medium text-danger" : ""}>
                      {dataCurta.format(t.dataLimite)}
                    </span>
                  )}
                  {t.opportunity && (
                    <Link
                      href={`/propostas/${t.opportunity.id}`}
                      className="font-mono text-brand hover:underline"
                    >
                      {t.opportunity.codigo}
                    </Link>
                  )}
                  {t.criadoPorId !== sessaoId && <span>de {t.criadoPor.name}</span>}
                </p>
              </div>
              {podeExcluir && (
                <form action={excluirTarefa}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    aria-label="Excluir tarefa"
                    className="rounded-md p-1 text-faint transition-colors duration-150 hover:text-danger"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function Tarefas() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  const [tarefas, usuarios] = await Promise.all([
    buscarTarefas(sessao.id),
    prisma.user.findMany({
      where: { ativo: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const hoje = inicioDoDia(new Date());
  const pendentes = tarefas.filter((t) => !t.concluida);
  const concluidas = tarefas.filter((t) => t.concluida).slice(0, 20);
  const atrasadas = pendentes.filter((t) => t.dataLimite && inicioDoDia(t.dataLimite) < hoje);
  const paraHoje = pendentes.filter(
    (t) => t.dataLimite && inicioDoDia(t.dataLimite).getTime() === hoje.getTime(),
  );
  const proximas = pendentes.filter((t) => !t.dataLimite || inicioDoDia(t.dataLimite) > hoje);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Minhas tarefas</h1>
      <p className="mt-1 text-sm text-muted">
        {pendentes.length === 0
          ? "Nada pendente por aqui."
          : `${pendentes.length} pendente${pendentes.length === 1 ? "" : "s"}`}
      </p>

      <form action={criarTarefa} className="card mt-6 flex flex-wrap items-end gap-2 p-4">
        <label className="min-w-40 flex-1 text-xs font-medium text-muted">
          Nova tarefa
          <input
            name="titulo"
            required
            placeholder="Ex.: Ligar para o cliente"
            className={`${campo} mt-1 w-full`}
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Prazo
          <input type="date" name="dataLimite" className={`${campo} mt-1`} />
        </label>
        <label className="text-xs font-medium text-muted">
          Para
          <select name="responsavelId" defaultValue={sessao.id} className={`${campo} mt-1`}>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === sessao.id ? "Eu" : u.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-brand-strong px-4 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-brand"
        >
          Adicionar
        </button>
      </form>

      <Grupo titulo="Atrasadas" lista={atrasadas} corPrazo="danger" sessaoId={sessao.id} sessaoArea={sessao.area} />
      <Grupo titulo="Para hoje" lista={paraHoje} sessaoId={sessao.id} sessaoArea={sessao.area} />
      <Grupo titulo="Próximas" lista={proximas} sessaoId={sessao.id} sessaoArea={sessao.area} />
      <Grupo
        titulo="Concluídas recentemente"
        lista={concluidas}
        sessaoId={sessao.id}
        sessaoArea={sessao.area}
      />

      {tarefas.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          Nenhuma tarefa ainda. Crie a primeira acima, ou vincule uma a uma proposta na página dela.
        </p>
      )}
    </div>
  );
}
