import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { entrar } from "./actions";

export const metadata = { title: "Entrar — PropostaFlow" };

const campo =
  "mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (await obterSessao()) redirect("/");
  const { erro } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
      <p className="text-xl font-semibold tracking-tight">
        Proposta<span className="text-brand">Flow</span>
      </p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-muted">
        Acompanhe suas propostas da entrada ao faturamento.
      </p>

      {erro && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
        >
          E-mail ou senha incorretos. Confira e tente de novo.
        </p>
      )}

      <form action={entrar} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          E-mail
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="voce@empresa.com"
            className={campo}
          />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input
            type="password"
            name="senha"
            required
            autoComplete="current-password"
            className={campo}
          />
        </label>
        <button
          type="submit"
          className="mt-2 h-10 w-full rounded-lg bg-brand-strong shadow-sm text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
        >
          Entrar
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Primeira vez por aqui?{" "}
        <Link href="/cadastro" className="font-medium text-brand hover:underline">
          Criar conta
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-line px-4 py-3.5 text-xs text-muted">
        <p className="font-medium text-ink">Ambiente de desenvolvimento</p>
        <p className="mt-1">
          Senha <code className="font-mono">propostaflow</code> para todos:
          ana@ (Comercial), bruno@ (Propostas), carla@ (Delivery), diego@
          (Contratos), elisa@ (Faturamento) e admin@empresa.com.
        </p>
      </div>
    </div>
  );
}
