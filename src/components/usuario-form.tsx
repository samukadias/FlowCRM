import Link from "next/link";
import type { Area, Perfil } from "@/generated/prisma/enums";
import { AREA_LABELS, PERFIL_LABELS } from "@/lib/flow";

const campo =
  "mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

const MENSAGENS: Record<string, string> = {
  email: "Este e-mail já está em uso por outro usuário.",
  senha: "A senha precisa ter pelo menos 6 caracteres.",
};

export function UsuarioForm({
  action,
  usuario,
  erro,
  proprioPerfil = false,
}: {
  action: (formData: FormData) => Promise<void>;
  usuario?: { id: string; name: string; email: string; area: Area; perfil: Perfil };
  erro?: string;
  proprioPerfil?: boolean;
}) {
  const novo = !usuario;
  return (
    <>
      {erro && MENSAGENS[erro] && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
        >
          {MENSAGENS[erro]}
        </p>
      )}
      <form action={action} className="mt-6 space-y-5">
        {usuario && <input type="hidden" name="id" value={usuario.id} />}
        <label className="block text-sm font-medium">
          Nome
          <input
            name="name"
            required
            defaultValue={usuario?.name}
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
            defaultValue={usuario?.email}
            placeholder="maria@empresa.com"
            className={campo}
          />
        </label>
        <label className="block text-sm font-medium">
          Área
          <select
            name="area"
            required
            defaultValue={usuario?.area ?? "COMERCIAL"}
            disabled={proprioPerfil}
            className={`${campo} disabled:bg-surface disabled:text-muted`}
          >
            {(Object.entries(AREA_LABELS) as [Area, string][]).map(([a, rotulo]) => (
              <option key={a} value={a}>
                {rotulo}
              </option>
            ))}
          </select>
          {proprioPerfil && (
            <>
              <input type="hidden" name="area" value="ADMIN" />
              <span className="mt-1.5 block text-xs font-normal text-muted">
                Você não pode rebaixar a própria área.
              </span>
            </>
          )}
        </label>
        <label className="block text-sm font-medium">
          Perfil
          <select
            name="perfil"
            required
            defaultValue={usuario?.perfil ?? "ANALISTA"}
            className={campo}
          >
            {(Object.entries(PERFIL_LABELS) as [Perfil, string][]).map(([p, rotulo]) => (
              <option key={p} value={p}>
                {rotulo}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs font-normal text-muted">
            Analista trabalha o que lhe foi delegado; gestor delega e vê toda a
            atividade da área.
          </span>
        </label>
        <label className="block text-sm font-medium">
          {novo ? "Senha" : "Nova senha"}
          <input
            type="password"
            name="senha"
            required={novo}
            minLength={novo ? 6 : undefined}
            autoComplete="new-password"
            placeholder={novo ? "Mínimo de 6 caracteres" : "Deixe em branco para manter a atual"}
            className={campo}
          />
        </label>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-brand-strong shadow-sm px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
          >
            {novo ? "Criar usuário" : "Salvar alterações"}
          </button>
          <Link
            href="/usuarios"
            className="h-10 rounded-lg border border-line px-4 text-sm leading-10 font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
