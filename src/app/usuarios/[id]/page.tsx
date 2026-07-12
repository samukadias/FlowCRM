import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterSessao, podeAgir } from "@/lib/auth";
import { atualizarUsuario } from "@/app/usuarios/actions";
import { UsuarioForm } from "@/components/usuario-form";

export const metadata = { title: "Editar usuário — PropostaFlow" };

export default async function EditarUsuario({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await obterSessao();
  if (!podeAgir(sessao, "ADMIN")) redirect("/");
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);

  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/usuarios"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para usuários
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        Editar usuário
      </h1>
      <p className="mt-1 text-sm text-muted">
        {usuario.name} · {usuario.email}
        {!usuario.ativo && " · desativado"}
      </p>
      <UsuarioForm
        action={atualizarUsuario}
        usuario={usuario}
        erro={erro}
        proprioPerfil={usuario.id === sessao.id}
      />
    </div>
  );
}
