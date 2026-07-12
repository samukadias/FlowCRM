"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Search, UserRound } from "lucide-react";
import { buscarGlobal, type ResultadoBusca } from "@/lib/busca-global";

type Item = { tipo: "proposta" | "cliente" | "pessoa"; id: string; href: string; titulo: string; subtitulo: string };

const VAZIO: ResultadoBusca = { propostas: [], clientes: [], pessoas: [] };

function montarItens(r: ResultadoBusca): Item[] {
  return [
    ...r.propostas.map((p) => ({
      tipo: "proposta" as const,
      id: p.id,
      href: `/propostas/${p.id}`,
      titulo: `${p.codigo} · ${p.titulo}`,
      subtitulo: `${p.clienteNome} · ${p.stageLabel}`,
    })),
    ...r.clientes.map((c) => ({
      tipo: "cliente" as const,
      id: c.id,
      href: `/clientes/${c.id}`,
      titulo: c.nome,
      subtitulo: c.sigla,
    })),
    ...r.pessoas.map((p) => ({
      tipo: "pessoa" as const,
      id: p.id,
      href: `/?responsavel=${p.id}`,
      titulo: p.nome,
      subtitulo: `Propostas de ${p.areaLabel}`,
    })),
  ];
}

const ICONE = { proposta: FileText, cliente: Building2, pessoa: UserRound };

export function CommandPalette() {
  const [aberto, setAberto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultado, setResultado] = useState<ResultadoBusca>(VAZIO);
  const [ativo, setAtivo] = useState(0);
  const [, iniciarBusca] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const itens = useMemo(
    () => (query.trim().length < 2 ? [] : montarItens(resultado)),
    [resultado, query],
  );

  function abrirBusca() {
    setQuery("");
    setResultado(VAZIO);
    setAtivo(0);
    setAberto(true);
  }

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (aberto) {
          setAberto(false);
        } else {
          abrirBusca();
        }
      } else if (e.key === "Escape") {
        setAberto(false);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  useEffect(() => {
    if (aberto) requestAnimationFrame(() => inputRef.current?.focus());
  }, [aberto]);

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2) return;
    const timer = setTimeout(() => {
      iniciarBusca(async () => {
        const r = await buscarGlobal(termo);
        setResultado(r);
        setAtivo(0);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function navegar(item: Item) {
    setAberto(false);
    router.push(item.href);
  }

  function aoTeclarNaLista(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && itens[ativo]) {
      e.preventDefault();
      navegar(itens[ativo]);
    }
  }

  const grupos: { rotulo: string; tipo: Item["tipo"] }[] = [
    { rotulo: "Propostas", tipo: "proposta" },
    { rotulo: "Clientes", tipo: "cliente" },
    { rotulo: "Pessoas", tipo: "pessoa" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={abrirBusca}
        aria-label="Busca global"
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-xs text-muted shadow-sm transition-colors duration-150 hover:border-faint hover:text-ink"
      >
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <span className="max-sm:hidden">Buscar</span>
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint max-sm:hidden">
          ⌘K
        </kbd>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[1px]"
          onClick={() => setAberto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="card w-full max-w-lg overflow-hidden shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search size={16} strokeWidth={1.75} className="text-faint" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={aoTeclarNaLista}
                placeholder="Buscar propostas, clientes ou pessoas…"
                aria-label="Busca global"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Digite ao menos 2 letras para buscar.
                </p>
              ) : itens.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Nada encontrado para &ldquo;{query.trim()}&rdquo;.
                </p>
              ) : (
                grupos.map((g) => {
                  const doGrupo = itens.filter((i) => i.tipo === g.tipo);
                  if (doGrupo.length === 0) return null;
                  const Icone = ICONE[g.tipo];
                  return (
                    <div key={g.tipo} className="mb-1 last:mb-0">
                      <p className="th-label px-3 pt-2 pb-1">{g.rotulo}</p>
                      {doGrupo.map((item) => {
                        const indice = itens.indexOf(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navegar(item)}
                            onMouseEnter={() => setAtivo(indice)}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 ${
                              indice === ativo ? "bg-surface-2" : "hover:bg-surface"
                            }`}
                          >
                            <Icone size={15} strokeWidth={1.75} className="shrink-0 text-faint" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{item.titulo}</span>
                              <span className="block truncate text-xs text-muted">{item.subtitulo}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
