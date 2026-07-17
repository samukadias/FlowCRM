"use client";

import { useEffect, useRef, useState } from "react";

export type ProdutoOpcao = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
};

function semAcentos(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Busca com autocomplete sobre o catálogo — substitui o <select> que ficou
 * inviável com centenas de produtos. Emite o id escolhido num input escondido;
 * sem seleção, o campo fica vazio e a action ignora o envio. */
export function SeletorProduto({ name, opcoes }: { name: string; opcoes: ProdutoOpcao[] }) {
  const [texto, setTexto] = useState("");
  const [selecionado, setSelecionado] = useState<ProdutoOpcao | null>(null);
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(ev: MouseEvent) {
      if (raiz.current && !raiz.current.contains(ev.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const filtro = semAcentos(texto.trim());
  const resultados = (
    filtro
      ? opcoes.filter((o) => semAcentos(`${o.categoria} ${o.nome}`).includes(filtro))
      : opcoes
  ).slice(0, 30);

  return (
    <div ref={raiz} className="relative mt-1">
      <input
        type="text"
        required
        value={selecionado ? selecionado.nome : texto}
        onChange={(e) => {
          setSelecionado(null);
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAberto(false);
        }}
        placeholder="Buscar no catálogo…"
        aria-label="Buscar produto ou serviço no catálogo"
        className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
      <input type="hidden" name={name} value={selecionado?.id ?? ""} />
      {aberto && !selecionado && (
        <ul className="card absolute z-20 mt-1 max-h-64 w-full min-w-72 overflow-y-auto shadow-lg">
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted">Nenhum produto encontrado.</li>
          ) : (
            resultados.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelecionado(o);
                    setAberto(false);
                  }}
                  className="w-full px-3 py-2 text-left transition-colors duration-100 hover:bg-surface"
                >
                  <span className="block text-xs text-ink">
                    {o.nome} <span className="text-faint">({o.unidade})</span>
                  </span>
                  <span className="mt-0.5 block text-[10px] text-faint">{o.categoria}</span>
                </button>
              </li>
            ))
          )}
          {!filtro && opcoes.length > 30 && (
            <li className="border-t border-line-soft px-3 py-1.5 text-[10px] text-faint">
              Mostrando 30 de {opcoes.length} — digite para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
