"use server";

import { prisma } from "./prisma";
import { obterSessao } from "./auth";
import { filtroPropostasVisiveis } from "./visibilidade";
import { AREA_LABELS, STAGE_META } from "./flow";

export type ResultadoBusca = {
  propostas: { id: string; codigo: string; titulo: string; clienteNome: string; stageLabel: string }[];
  clientes: { id: string; nome: string; sigla: string }[];
  pessoas: { id: string; nome: string; areaLabel: string }[];
};

const VAZIO: ResultadoBusca = { propostas: [], clientes: [], pessoas: [] };

/** Busca global (paleta de comando): propostas, clientes e pessoas, respeitando
 * a mesma visibilidade por papel/área já aplicada na tela principal. */
export async function buscarGlobal(queryBruta: string): Promise<ResultadoBusca> {
  const sessao = await obterSessao();
  const termo = queryBruta.trim();
  if (!sessao || termo.length < 2) return VAZIO;

  const contains = { contains: termo, mode: "insensitive" as const };

  const [propostas, clientes, pessoas] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        AND: [
          filtroPropostasVisiveis(sessao),
          {
            OR: [
              { codigo: contains },
              { titulo: contains },
              { cliente: { nome: contains } },
              { cliente: { sigla: contains } },
            ],
          },
        ],
      },
      select: { id: true, codigo: true, titulo: true, stage: true, cliente: { select: { nome: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.cliente.findMany({
      where: { OR: [{ nome: contains }, { sigla: contains }] },
      select: { id: true, nome: true, sigla: true },
      orderBy: { nome: "asc" },
      take: 5,
    }),
    prisma.user.findMany({
      where: { ativo: true, name: contains },
      select: { id: true, name: true, area: true },
      orderBy: { name: "asc" },
      take: 5,
    }),
  ]);

  return {
    propostas: propostas.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      titulo: p.titulo,
      clienteNome: p.cliente.nome,
      stageLabel: STAGE_META[p.stage].label,
    })),
    clientes,
    pessoas: pessoas.map((p) => ({
      id: p.id,
      nome: p.name,
      areaLabel: AREA_LABELS[p.area],
    })),
  };
}
