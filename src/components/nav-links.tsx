"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FileText,
  ListTodo,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icone: LucideIcon;
  ativo: (p: string) => boolean;
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

export function NavLinks({
  admin = false,
  gestor = false,
  clientes = false,
}: {
  admin?: boolean;
  gestor?: boolean;
  clientes?: boolean;
}) {
  const pathname = usePathname();
  const visiveis = [
    ...itens,
    ...(gestor ? [relatorios] : []),
    ...(clientes ? [clientesItem] : []),
    ...(admin ? [usuariosItem] : []),
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
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors duration-150 ${
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
          </Link>
        );
      })}
    </nav>
  );
}
