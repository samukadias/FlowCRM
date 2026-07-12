import { prisma } from "./prisma";
import { ETAPAS_NAO_TERMINAIS, FILA_DONA, STAGE_META } from "./flow";
import { notificarArea, notificarUsuario } from "./notificar";

/**
 * Notifica sobre propostas paradas há mais dias do que a regra de automação
 * ativa permite (gerida pelo ADMIN em /automacoes): o responsável, se
 * houver, senão os gestores da área dona da fila atual. Cada proposta é
 * notificada uma única vez por etapa (controlado por `alertaEstagnacaoEm`,
 * que zera a cada mudança de etapa).
 *
 * Para cada proposta, vale a regra específica da etapa atual; na ausência
 * dela, a regra coringa (`stage: null`). Sem nenhuma regra ativa aplicável,
 * a proposta não é verificada.
 *
 * Devolve quantas propostas foram notificadas nesta chamada.
 */
export async function verificarEstagnacao(): Promise<number> {
  const regras = await prisma.automationRule.findMany({ where: { ativo: true } });
  if (regras.length === 0) return 0;

  const candidatas = await prisma.opportunity.findMany({
    where: { alertaEstagnacaoEm: null, stage: { in: ETAPAS_NAO_TERMINAIS } },
    include: {
      cliente: { select: { nome: true } },
      eventos: {
        where: { eventType: "STAGE_CHANGE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let notificadas = 0;
  for (const p of candidatas) {
    const regra = regras.find((r) => r.stage === p.stage) ?? regras.find((r) => r.stage === null);
    if (!regra) continue; // nenhuma regra ativa cobre esta etapa

    const limite = new Date(Date.now() - regra.diasLimite * 86_400_000);
    const desde = p.eventos[0]?.createdAt ?? p.updatedAt;
    if (desde > limite) continue; // ainda dentro do prazo

    const titulo = `${p.codigo} · ${p.cliente.nome} — parada há mais de ${regra.diasLimite} dias em ${STAGE_META[p.stage].label.toLowerCase()}`;
    const link = `/propostas/${p.id}`;

    if (p.responsavelId) {
      await notificarUsuario(p.responsavelId, titulo, link);
    } else {
      const dona = FILA_DONA[p.stage];
      if (dona) await notificarArea(dona, titulo, link, { apenasGestores: true });
    }

    await prisma.opportunity.update({
      where: { id: p.id },
      data: { alertaEstagnacaoEm: new Date() },
    });
    notificadas++;
  }
  return notificadas;
}
