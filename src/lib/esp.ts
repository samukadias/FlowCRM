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
