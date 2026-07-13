import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { NavLinks } from "@/components/nav-links";
import { CommandPalette } from "@/components/command-palette";
import { obterSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AREA_LABELS } from "@/lib/flow";
import { sair } from "@/app/login/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PropostaFlow",
  description:
    "Acompanhe cada proposta comercial da entrada ao faturamento e veja onde ela está no fluxo.",
};

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessao = await obterSessao();
  const gestor = sessao ? sessao.perfil === "GESTOR" || sessao.area === "ADMIN" : false;
  const naoLidas = sessao
    ? await prisma.notification.count({ where: { userId: sessao.id, lida: false } })
    : 0;
  const tarefasPendentes = sessao
    ? await prisma.tarefa.count({ where: { responsavelId: sessao.id, concluida: false } })
    : 0;

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6 sm:gap-6">
            <Link href={!sessao || gestor ? "/" : "/filas"} className="flex shrink-0 items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-lg bg-brand-strong font-mono text-[13px] font-bold text-white"
              >
                P
              </span>
              <span className="flex items-baseline text-[15px] font-semibold tracking-tight max-sm:hidden">
                Proposta<span className="text-brand">Flow</span>
              </span>
            </Link>
            {sessao && (
              <>
                <NavLinks
                  admin={sessao.area === "ADMIN"}
                  gestor={gestor}
                  clientes={
                    sessao.area === "ADMIN" ||
                    (sessao.area === "PROPOSTAS" && sessao.perfil === "GESTOR")
                  }
                  tarefasPendentes={tarefasPendentes}
                />
                <div className="ml-auto flex items-center gap-2">
                  <CommandPalette />
                  <Link
                    href="/notificacoes"
                    aria-label={`Notificações${naoLidas > 0 ? ` (${naoLidas} não lidas)` : ""}`}
                    className="relative rounded-lg p-2 text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
                  >
                    <Bell size={17} strokeWidth={1.75} aria-hidden />
                    {naoLidas > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-[10px] font-semibold text-white ring-2 ring-card">
                        {naoLidas > 9 ? "9+" : naoLidas}
                      </span>
                    )}
                  </Link>
                  <div className="flex items-center gap-2.5 border-l border-line pl-3 sm:pl-4">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong"
                    >
                      {iniciais(sessao.name)}
                    </span>
                    <div className="leading-tight max-md:hidden">
                      <p className="text-[13px] font-medium">{sessao.name}</p>
                      <p className="text-[11px] text-muted">
                        {AREA_LABELS[sessao.area]}
                      </p>
                    </div>
                    <form action={sair}>
                      <button
                        type="submit"
                        title="Sair"
                        className="flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
                      >
                        <LogOut size={15} strokeWidth={1.75} aria-hidden />
                        <span className="max-sm:sr-only">Sair</span>
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
