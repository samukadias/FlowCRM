import Link from "next/link";

const campo =
  "mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";

const MENSAGENS: Record<string, string> = {
  duplicado: "Já existe um cliente com este nome ou esta sigla.",
  sigla: "Informe o nome e uma sigla com pelo menos 2 letras ou números.",
};

export function ClienteForm({
  action,
  cliente,
  erro,
}: {
  action: (formData: FormData) => Promise<void>;
  cliente?: {
    id: string;
    nome: string;
    sigla: string;
  };
  erro?: string;
}) {
  const novo = !cliente;
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
        {cliente && <input type="hidden" name="id" value={cliente.id} />}
        <label className="block text-sm font-medium">
          Nome
          <input
            name="nome"
            required
            defaultValue={cliente?.nome}
            placeholder="Ex.: TechNova S.A."
            className={campo}
          />
        </label>
        <label className="block text-sm font-medium">
          Sigla
          <input
            name="sigla"
            required
            defaultValue={cliente?.sigla}
            placeholder="Ex.: TECHNOVA"
            className={`${campo} font-mono uppercase`}
          />
          <span className="mt-1.5 block text-xs font-normal text-muted">
            Código curto e único, só letras e números (salvo em maiúsculas).
          </span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-brand-strong shadow-sm px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
          >
            {novo ? "Cadastrar cliente" : "Salvar alterações"}
          </button>
          <Link
            href="/clientes"
            className="h-10 rounded-lg border border-line px-4 text-sm leading-10 font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
