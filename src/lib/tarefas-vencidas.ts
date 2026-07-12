import { prisma } from "./prisma";
import { notificarUsuario } from "./notificar";

function inicioDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Notifica o responsável por tarefas com prazo vencido e ainda não
 * concluídas. Cada tarefa é notificada uma única vez (controlado por
 * `alertaVencidaEm`).
 *
 * Devolve quantas tarefas foram notificadas nesta chamada.
 */
export async function verificarTarefasVencidas(): Promise<number> {
  const hoje = inicioDoDia(new Date());

  const candidatas = await prisma.tarefa.findMany({
    where: {
      concluida: false,
      alertaVencidaEm: null,
      dataLimite: { lt: hoje },
    },
  });

  let notificadas = 0;
  for (const t of candidatas) {
    await notificarUsuario(
      t.responsavelId,
      `Tarefa vencida: ${t.titulo}`,
      t.opportunityId ? `/propostas/${t.opportunityId}` : "/tarefas",
    );
    await prisma.tarefa.update({
      where: { id: t.id },
      data: { alertaVencidaEm: new Date() },
    });
    notificadas++;
  }
  return notificadas;
}
