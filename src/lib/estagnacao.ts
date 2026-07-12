import { prisma } from "./prisma";
import { FILA_DONA, STAGE_META, STAGE_ORDER } from "./flow";
import { notificarArea, notificarUsuario } from "./notificar";

/** Mesmo limiar já usado na UI para destacar em âmbar "há quantos dias". */
export const DIAS_LIMITE_ESTAGNACAO = 10;

const ETAPAS_NAO_TERMINAIS = STAGE_ORDER.filter((s) => !STAGE_META[s].terminal);

/**
 * Notifica sobre propostas paradas há mais de DIAS_LIMITE_ESTAGNACAO dias na
 * mesma etapa: o responsável, se houver, senão os gestores da área dona da
 * fila atual. Cada proposta é notificada uma única vez por etapa (controlado
 * por `alertaEstagnacaoEm`, que zera a cada mudança de etapa).
 *
 * Devolve quantas propostas foram notificadas nesta chamada.
 */
export async function verificarEstagnacao(): Promise<number> {
  const limite = new Date(Date.now() - DIAS_LIMITE_ESTAGNACAO * 86_400_000);

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
    const desde = p.eventos[0]?.createdAt ?? p.updatedAt;
    if (desde > limite) continue; // ainda dentro do prazo

    const titulo = `${p.codigo} · ${p.cliente.nome} — parada há mais de ${DIAS_LIMITE_ESTAGNACAO} dias em ${STAGE_META[p.stage].label.toLowerCase()}`;
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
