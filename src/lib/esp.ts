import { prisma } from "./prisma";

/** Todas as ESPs da oportunidade estão prontas? Propostas do tipo Proposta
 * Técnica sem ESP nenhuma (ainda não desmembrada) contam como pendente —
 * Orçamento Orientativo não tem ESP e por isso nunca é bloqueado por esta regra. */
export async function espsPendentes(opportunityId: string, tipo: string | null): Promise<boolean> {
  if (tipo !== "PROPOSTA_TECNICA") return false;
  const esps = await prisma.esp.findMany({ where: { opportunityId } });
  return esps.length === 0 || esps.some((e) => !e.pronta);
}

/** Zera o status de todas as ESPs da oportunidade — chamado quando o
 * Delivery devolve a proposta para ajustes. */
export async function resetarEspsPendentes(opportunityId: string) {
  await prisma.esp.updateMany({
    where: { opportunityId },
    data: { pronta: false, prontaEm: null },
  });
}

/** Todos os itens da PO da oportunidade, juntando as ESPs — é a base do
 * valor mensal recorrente e do que o Faturamento mede a cada competência. */
export async function itensDaOportunidade(opportunityId: string) {
  return prisma.espItem.findMany({
    where: { esp: { opportunityId } },
    include: { produto: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Soma quantidadeMensal × valorUnitario dos itens — o valor mensal
 * planejado/contratado, usado como ponto de partida da medição do Faturamento. */
export function valorMensalPlanejado(
  itens: { quantidadeMensal: unknown; valorUnitario: unknown }[],
): number {
  return itens.reduce((s, i) => s + Number(i.quantidadeMensal) * Number(i.valorUnitario), 0);
}
