import { prisma } from "@/lib/prisma";

/** Esvazia todas as tabelas de domínio, respeitando as FKs. Chamado antes
 * de cada teste de integração para isolar um teste do outro. */
export async function limparBanco() {
  await prisma.notification.deleteMany();
  await prisma.attestation.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.workflowEvent.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
}
