"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CheckSquare,
  FileText,
  ListTodo,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icone: LucideIcon;
  ativo: (p: string) => boolean;
  contador?: number;
};

const itens: Item[] = [
  {
    href: "/",
    label: "Propostas",
    icone: FileText,
    ativo: (p) => p === "/" || p.startsWith("/propostas"),
  },
  {
    href: "/filas",
    label: "Filas",
    icone: ListTodo,
    ativo: (p) => p.startsWith("/filas"),
  },
];

const relatorios: Item = {
  href: "/relatorios",
  label: "Relatórios",
  icone: BarChart3,
  ativo: (p) => p.startsWith("/relatorios"),
};

const clientesItem: Item = {
  href: "/clientes",
  label: "Clientes",
  icone: Building2,
  ativo: (p) => p.startsWith("/clientes"),
};

const usuariosItem: Item = {
  href: "/usuarios",
  label: "Usuários",
  icone: UsersRound,
  ativo: (p) => p.startsWith("/usuarios"),
};

const automacoesItem: Item = {
  href: "/automacoes",
  label: "Automações",
  icone: Zap,
  ativo: (p) => p.startsWith("/automacoes"),
};

const tarefasItem: Item = {
  href: "/tarefas",
  label: "Tarefas",
  icone: CheckSquare,
  ativo: (p) => p.startsWith("/tarefas"),
};

export function NavLinks({
  admin = false,
  gestor = false,
  clientes = false,
  tarefasPendentes = 0,
}: {
  admin?: boolean;
  gestor?: boolean;
  clientes?: boolean;
  tarefasPendentes?: number;
}) {
  const pathname = usePathname();
  const visiveis = [
    ...itens,
    { ...tarefasItem, contador: tarefasPendentes },
    ...(gestor ? [relatorios] : []),
    ...(clientes ? [clientesItem] : []),
    ...(admin ? [usuariosItem, automacoesItem] : []),
  ];
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto text-sm whitespace-nowrap">
      {visiveis.map((item) => {
        const Icone = item.icone;
        const ativo = item.ativo(pathname);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors duration-150 ${
              ativo
                ? "bg-surface-2 font-medium text-ink"
                : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            <Icone
              size={15}
              strokeWidth={1.75}
              className={ativo ? "text-brand" : "text-faint"}
              aria-hidden
            />
            <span className="max-sm:sr-only">{item.label}</span>
            {!!item.contador && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-[10px] font-semibold text-white max-sm:absolute max-sm:top-0.5 max-sm:right-0.5 max-sm:ring-2 max-sm:ring-card">
                {item.contador > 9 ? "9+" : item.contador}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
