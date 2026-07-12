import Link from "next/link";
import { redirect } from "next/navigation";
import type { Area } from "@/generated/prisma/enums";
import { AREA_LABELS } from "@/lib/flow";
import { obterSessao } from "@/lib/auth";
import { registrar } from "./actions";

export const metadata = { title: "Criar conta — PropostaFlow" };

const campo =
  "mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

const MENSAGENS: Record<string, string> = {
  email: "Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.",
  senha: "A senha precisa ter pelo menos 6 caracteres.",
};

export default async function Cadastro({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (await obterSessao()) redirect("/");
  const { erro } = await searchParams;

  const areas = (Object.entries(AREA_LABELS) as [Area, string][]).filter(
    ([a]) => a !== "ADMIN",
  );

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
      <p className="text-xl font-semibold tracking-tight">
        Proposta<span className="text-brand">Flow</span>
      </p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-1 text-sm text-muted">
        Escolha a sua área para entrar na fila certa. Toda conta nova começa
        com o perfil de analista; um administrador pode promover a gestor.
      </p>

      {erro && MENSAGENS[erro] && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
        >
          {MENSAGENS[erro]}
        </p>
      )}

      <form action={registrar} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Nome
          <input
            name="name"
            required
            autoComplete="name"
            placeholder="Ex.: Maria Silva"
            className={campo}
          />
        </label>
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
          Área
          <select name="area" required defaultValue="" className={campo}>
            <option value="" disabled>
              Selecione a sua área
            </option>
            {areas.map(([a, rotulo]) => (
              <option key={a} value={a}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input
            type="password"
            name="senha"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Mínimo de 6 caracteres"
            className={campo}
          />
        </label>
        <button
          type="submit"
          className="mt-2 h-10 w-full rounded-lg bg-brand-strong shadow-sm text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
        >
          Criar conta e entrar
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
