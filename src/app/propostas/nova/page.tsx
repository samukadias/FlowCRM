import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { criarProposta } from "@/app/propostas/actions";
import { obterSessao, podeAgir } from "@/lib/auth";

export const metadata = { title: "Nova proposta — PropostaFlow" };

const campo =
  "mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

export default async function NovaProposta() {
  // Registrar entrada é um verbo do Comercial (ou ADMIN)
  if (!podeAgir(await obterSessao(), "COMERCIAL")) redirect("/");

  const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para propostas
      </Link>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Nova proposta</h1>
      <p className="mt-1 text-sm text-muted">
        Registre a oportunidade recebida pelo Comercial. Ela entra no fluxo na
        etapa <strong className="font-medium text-ink">Entrada</strong>.
      </p>

      <form action={criarProposta} className="mt-8 space-y-5">
        <label className="block text-sm font-medium">
          Cliente
          <select name="clienteId" required defaultValue="" className={`${campo} h-10`}>
            <option value="" disabled>
              {clientes.length > 0
                ? "Selecione o cliente"
                : "Nenhum cliente cadastrado"}
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sigla} — {c.nome}
              </option>
            ))}
          </select>
          {clientes.length === 0 && (
            <span className="mt-1.5 block text-xs font-normal text-muted">
              Peça ao administrador ou ao gestor de Propostas para cadastrar o
              cliente no menu Clientes.
            </span>
          )}
        </label>
        <label className="block text-sm font-medium">
          Título
          <input
            name="titulo"
            required
            placeholder="Ex.: Migração de datacenter para nuvem"
            className={`${campo} h-10`}
          />
        </label>
        <label className="block text-sm font-medium">
          Valor estimado (R$)
          <input
            name="valor"
            inputMode="decimal"
            placeholder="Ex.: 850000"
            className={`${campo} h-10`}
          />
        </label>
        <label className="block text-sm font-medium">
          Descrição
          <textarea
            name="descricao"
            rows={4}
            placeholder="Contexto da oportunidade, escopo solicitado, origem do contato…"
            className={`${campo} py-2`}
          />
        </label>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-brand-strong shadow-sm px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
          >
            Registrar proposta
          </button>
          <Link
            href="/"
            className="h-10 rounded-lg border border-line px-4 text-sm font-medium leading-10 text-muted transition-colors duration-150 hover:text-ink"
          >
            Descartar
          </Link>
        </div>
      </form>
    </div>
  );
}
