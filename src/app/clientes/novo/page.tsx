import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { criarCliente } from "@/app/clientes/actions";
import { ClienteForm } from "@/components/cliente-form";

export const metadata = { title: "Novo cliente — PropostaFlow" };

export default async function NovoCliente({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await obterSessao();
  const pode =
    sessao != null &&
    (sessao.area === "ADMIN" ||
      (sessao.area === "PROPOSTAS" && sessao.perfil === "GESTOR"));
  if (!pode) redirect("/");
  const { erro } = await searchParams;

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/clientes"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para clientes
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Novo cliente</h1>
      <p className="mt-1 text-sm text-muted">
        O cliente fica disponível na criação de novas propostas.
      </p>
      <ClienteForm action={criarCliente} erro={erro} />
    </div>
  );
}
