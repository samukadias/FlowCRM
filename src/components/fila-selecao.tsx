"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Area, Stage } from "@/generated/prisma/enums";
import { TRANSITIONS } from "@/lib/flow";
import { tempoRelativo } from "@/lib/format";
import { FlowTrack } from "@/components/flow-track";

export type ItemFila = {
  id: string;
  codigo: string;
  titulo: string;
  clienteNome: string;
  stage: Stage;
  responsavelId: string | null;
  responsavelNome: string | null;
  desde: string;
  dias: number;
  podeMover: boolean;
};

type Equipe = { id: string; name: string }[];

const btnPrimario =
  "h-8 rounded-md bg-brand-strong px-3 text-xs font-medium text-white transition-colors duration-150 hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50";
const btnDestrutivo =
  "h-8 rounded-md border border-line px-3 text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger-soft";
const btnNeutro =
  "h-8 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const seletor =
  "h-8 max-w-40 rounded-md border border-line bg-canvas px-2 text-xs outline-none focus:border-brand";

function Responsavel({ nome }: { nome: string | null }) {
  return nome ? (
    <p className="mt-1 text-xs text-muted">
      responsável: <span className="text-ink">{nome}</span>
    </p>
  ) : (
    <p className="mt-1 text-xs font-medium text-warn">sem responsável</p>
  );
}

export function FilaSelecao({
  area,
  gestor,
  equipe,
  itens,
  mover,
  delegar,
  moverEmMassa,
  delegarEmMassa,
}: {
  area: Area;
  gestor: boolean;
  equipe: Equipe;
  itens: ItemFila[];
  mover: (formData: FormData) => Promise<void>;
  delegar: (formData: FormData) => Promise<void>;
  moverEmMassa: (formData: FormData) => Promise<void>;
  delegarEmMassa: (formData: FormData) => Promise<void>;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pendente, iniciarTransicao] = useTransition();

  const acionaveis = useMemo(() => itens.filter((i) => i.podeMover || gestor), [itens, gestor]);
  const todosSelecionados = acionaveis.length > 0 && acionaveis.every((i) => selecionados.has(i.id));

  const opcoesMover = (TRANSITIONS[itens[0]?.stage] ?? []).filter(
    (t) => t.area === area && t.para !== "RECUSADA" && t.para !== "CANCELADA",
  );

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(acionaveis.map((i) => i.id)));
  }

  function disparar(action: (formData: FormData) => Promise<void>, extra: Record<string, string>) {
    const fd = new FormData();
    for (const id of selecionados) fd.append("ids", id);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    iniciarTransicao(async () => {
      await action(fd);
      setSelecionados(new Set());
    });
  }

  return (
    <div>
      {acionaveis.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 px-1">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={alternarTodos}
              aria-label="Selecionar todas"
            />
            {selecionados.size > 0
              ? `${selecionados.size} selecionada${selecionados.size === 1 ? "" : "s"}`
              : "Selecionar todas"}
          </label>
          {selecionados.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {opcoesMover.map((t) => (
                <button
                  key={t.para}
                  type="button"
                  disabled={pendente}
                  onClick={() => disparar(moverEmMassa, { para: t.para })}
                  className={btnPrimario}
                >
                  {t.rotulo} ({selecionados.size})
                </button>
              ))}
              {gestor && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const userId = new FormData(e.currentTarget).get("userId");
                    disparar(delegarEmMassa, { userId: String(userId ?? "") });
                  }}
                  className="flex items-center gap-1.5"
                >
                  <select
                    name="userId"
                    defaultValue=""
                    aria-label="Delegar selecionadas para"
                    className={seletor}
                  >
                    <option value="">— sem responsável</option>
                    {equipe.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={pendente} className={btnNeutro}>
                    Delegar selecionadas
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <ul className="mt-2 card divide-y divide-line-soft overflow-hidden">
        {itens.map((p) => {
          const acionavel = p.podeMover || gestor;
          const temRecusaOuCancelamento = (TRANSITIONS[p.stage] ?? []).some(
            (t) => t.area === area && (t.para === "RECUSADA" || t.para === "CANCELADA"),
          );
          return (
            <li
              key={p.id}
              className="grid grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-3.5 md:grid-cols-[20px_minmax(0,1fr)_170px_85px_auto]"
            >
              <div className="max-md:hidden">
                {acionavel && (
                  <input
                    type="checkbox"
                    checked={selecionados.has(p.id)}
                    onChange={() => alternar(p.id)}
                    aria-label={`Selecionar ${p.codigo}`}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <Link href={`/propostas/${p.id}`} className="font-mono text-xs text-brand hover:underline">
                    {p.codigo}
                  </Link>
                  <span className="truncate text-xs text-muted">{p.clienteNome}</span>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium">{p.titulo}</p>
                <Responsavel nome={p.responsavelNome} />
              </div>
              <div className="max-md:hidden">
                <FlowTrack stage={p.stage} />
              </div>
              <p className={`text-xs tabular-nums ${p.dias > 10 ? "font-medium text-warn" : "text-muted"}`}>
                {tempoRelativo(new Date(p.desde))}
              </p>
              <div className="flex flex-col items-start gap-2">
                {p.podeMover ? (
                  <form action={mover} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    {(TRANSITIONS[p.stage] ?? [])
                      .filter((t) => t.area === area && t.para !== "RECUSADA" && t.para !== "CANCELADA")
                      .map((t) => (
                        <button
                          key={t.para}
                          type="submit"
                          name="para"
                          value={t.para}
                          className={t.destrutiva ? btnDestrutivo : btnPrimario}
                        >
                          {t.rotulo}
                        </button>
                      ))}
                    {temRecusaOuCancelamento && (
                      <Link href={`/propostas/${p.id}`} className={`${btnNeutro} leading-8`}>
                        Recusar/cancelar…
                      </Link>
                    )}
                  </form>
                ) : null}
                {gestor && (
                  <form action={delegar} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={p.id} />
                    <select
                      key={p.responsavelId ?? "nenhum"}
                      name="userId"
                      defaultValue={p.responsavelId ?? ""}
                      aria-label="Delegar para"
                      className={seletor}
                    >
                      <option value="">— sem responsável</option>
                      {equipe.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={btnNeutro}>
                      Delegar
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
