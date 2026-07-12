import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao, podeAgir } from "@/lib/auth";
import { criarUsuario } from "@/app/usuarios/actions";
import { UsuarioForm } from "@/components/usuario-form";

export const metadata = { title: "Novo usuário — PropostaFlow" };

export default async function NovoUsuario({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (!podeAgir(await obterSessao(), "ADMIN")) redirect("/");
  const { erro } = await searchParams;

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/usuarios"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para usuários
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Novo usuário</h1>
      <p className="mt-1 text-sm text-muted">
        A área define quais ações do fluxo a pessoa pode executar.
      </p>
      <UsuarioForm action={criarUsuario} erro={erro} />
    </div>
  );
}
