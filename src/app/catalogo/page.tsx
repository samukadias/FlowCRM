import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { brlUnitario } from "@/lib/format";
import { CampoValorDecimal } from "@/components/campo-valor-decimal";
import { criarProduto, atualizarProduto, alternarProdutoAtivo, excluirProduto } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Catálogo — PropostaFlow" };

const campo =
  "h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

const MENSAGENS_ERRO: Record<string, string> = {
  dados_invalidos: "Preencha nome, unidade e um valor unitário válido.",
  duplicado: "Já existe um produto ou serviço com este nome.",
};

function CamposProduto({ nome, unidade, valorUnitarioPadrao, ativo }: { nome?: string; unidade?: string; valorUnitarioPadrao?: number; ativo?: boolean }) {
  return (
    <>
      <label className="min-w-40 flex-1 text-xs font-medium text-muted">
        Nome
        <input
          name="nome"
          required
          defaultValue={nome}
          placeholder="Ex.: Certificado Digital e-CPF"
          className={`${campo} mt-1 w-full`}
        />
      </label>
      <label className="text-xs font-medium text-muted">
        Unidade
        <input
          name="unidade"
          required
          defaultValue={unidade}
          placeholder="Ex.: GB, certificado, licença"
          className={`${campo} mt-1 w-32`}
        />
      </label>
      <label className="text-xs font-medium text-muted">
        Valor unitário
        <CampoValorDecimal name="valorUnitarioPadrao" defaultValue={valorUnitarioPadrao} placeholder="Ex.: 4,80" />
      </label>
      <label className="flex items-center gap-1.5 self-end pb-2 text-xs font-medium text-muted">
        <input type="checkbox" name="ativo" defaultChecked={ativo ?? true} />
        Ativo
      </label>
    </>
  );
}

export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  if (sessao.area !== "ADMIN") redirect("/");
  const { erro } = await searchParams;

  const produtos = await prisma.produtoServico.findMany({
    include: { _count: { select: { itens: true } } },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Catálogo de serviços</h1>
      <p className="mt-1 text-sm text-muted">
        Produtos e serviços de informática com o preço unitário padrão — base para os
        itens da PO (Planilha Orçamentária) que a equipe de Propostas monta em cada ESP.
      </p>

      {erro && MENSAGENS_ERRO[erro] && (
        <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
          {MENSAGENS_ERRO[erro]}
        </p>
      )}

      <form action={criarProduto} className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <CamposProduto />
        <button
          type="submit"
          className="h-9 rounded-lg bg-brand-strong px-4 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-brand"
        >
          Adicionar
        </button>
      </form>

      {produtos.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          Nenhum produto ou serviço cadastrado ainda.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {produtos.map((p) => (
            <li key={p.id} className={`card p-4 ${p.ativo ? "" : "opacity-60"}`}>
              <form action={atualizarProduto} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={p.id} />
                <CamposProduto
                  nome={p.nome}
                  unidade={p.unidade}
                  valorUnitarioPadrao={Number(p.valorUnitarioPadrao)}
                  ativo={p.ativo}
                />
                <button
                  type="submit"
                  className="h-9 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  Salvar
                </button>
              </form>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-faint tabular-nums">
                  {brlUnitario.format(Number(p.valorUnitarioPadrao))} / {p.unidade} ·{" "}
                  {p._count.itens === 1 ? "1 item de ESP" : `${p._count.itens} itens de ESP`}
                </span>
                <form action={alternarProdutoAtivo}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="ativo" value={p.ativo ? "0" : "1"} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                  >
                    {p.ativo ? "Desativar" : "Ativar"}
                  </button>
                </form>
                {p._count.itens === 0 && (
                  <form action={excluirProduto}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      aria-label={`Excluir ${p.nome}`}
                      className="flex items-center gap-1 text-xs font-medium text-faint transition-colors duration-150 hover:text-danger"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
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
