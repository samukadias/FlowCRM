import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { ETAPAS_NAO_TERMINAIS, STAGE_META } from "@/lib/flow";
import { criarRegra, atualizarRegra, alternarRegra, excluirRegra } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Automações — PropostaFlow" };

const campo =
  "h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

function CamposRegra({ nome, stage, diasLimite, ativo }: { nome?: string; stage?: string; diasLimite?: number; ativo?: boolean }) {
  return (
    <>
      <label className="min-w-40 flex-1 text-xs font-medium text-muted">
        Nome da regra
        <input
          name="nome"
          required
          defaultValue={nome}
          placeholder="Ex.: Alerta de propostas em verificação"
          className={`${campo} mt-1 w-full`}
        />
      </label>
      <label className="text-xs font-medium text-muted">
        Etapa
        <select name="stage" defaultValue={stage ?? ""} className={`${campo} mt-1`}>
          <option value="">Qualquer etapa</option>
          {ETAPAS_NAO_TERMINAIS.map((s) => (
            <option key={s} value={s}>
              {STAGE_META[s].label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-muted">
        Dias parada
        <input
          type="number"
          name="diasLimite"
          min={1}
          required
          defaultValue={diasLimite}
          className={`${campo} mt-1 w-24`}
        />
      </label>
      <label className="flex items-center gap-1.5 self-end pb-2 text-xs font-medium text-muted">
        <input type="checkbox" name="ativo" defaultChecked={ativo ?? true} />
        Ativa
      </label>
    </>
  );
}

export default async function Automacoes() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  if (sessao.area !== "ADMIN") redirect("/");

  const regras = await prisma.automationRule.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
      <p className="mt-1 text-sm text-muted">
        Regras de alerta de estagnação: quando uma proposta fica parada demais numa
        etapa, o responsável (ou os gestores da fila) é notificado automaticamente
        na checagem horária. A regra de &ldquo;qualquer etapa&rdquo; vale para toda
        etapa sem regra própria.
      </p>

      <form action={criarRegra} className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <CamposRegra />
        <button
          type="submit"
          className="h-9 rounded-lg bg-brand-strong px-4 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-brand"
        >
          Criar regra
        </button>
      </form>

      {regras.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          Nenhuma regra cadastrada — sem regras ativas, o alerta de estagnação não
          verifica nenhuma proposta.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {regras.map((r) => (
            <li key={r.id} className={`card p-4 ${r.ativo ? "" : "opacity-60"}`}>
              <form action={atualizarRegra} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={r.id} />
                <CamposRegra nome={r.nome} stage={r.stage ?? ""} diasLimite={r.diasLimite} ativo={r.ativo} />
                <button
                  type="submit"
                  className="h-9 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  Salvar
                </button>
              </form>
              <div className="mt-2 flex items-center gap-3">
                <form action={alternarRegra}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="ativo" value={r.ativo ? "0" : "1"} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                  >
                    {r.ativo ? "Desativar" : "Ativar"}
                  </button>
                </form>
                <form action={excluirRegra}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    aria-label={`Excluir regra ${r.nome}`}
                    className="flex items-center gap-1 text-xs font-medium text-faint transition-colors duration-150 hover:text-danger"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                    Excluir
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
