import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { atualizarCliente } from "@/app/clientes/actions";
import { ClienteForm } from "@/components/cliente-form";

export const metadata = { title: "Editar cliente — PropostaFlow" };

export default async function EditarCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await obterSessao();
  const pode =
    sessao != null &&
    (sessao.area === "ADMIN" ||
      (sessao.area === "PROPOSTAS" && sessao.perfil === "GESTOR"));
  if (!pode) redirect("/");
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);

  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/clientes"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para clientes
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Editar cliente</h1>
      <p className="mt-1 text-sm text-muted">
        Alterar o nome atualiza todas as propostas deste cliente.
      </p>
      <ClienteForm action={atualizarCliente} cliente={cliente} erro={erro} />
    </div>
  );
}
