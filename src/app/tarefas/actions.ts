"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { filtroPropostasVisiveis } from "@/lib/visibilidade";
import { notificarUsuario } from "@/lib/notificar";

/** `<input type="date">` manda "AAAA-MM-DD" — interpreta como meia-noite local,
 * não UTC, senão a data exibida fica um dia atrás em fusos negativos. */
function dataLocal(aaaaMmDd: string): Date {
  const [ano, mes, dia] = aaaaMmDd.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Cria uma tarefa — avulsa ou ligada a uma proposta (opportunityId opcional). */
export async function criarTarefa(formData: FormData) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const dataLimiteBruta = String(formData.get("dataLimite") ?? "").trim();
  const responsavelId = String(formData.get("responsavelId") ?? "").trim() || sessao.id;
  const opportunityId = String(formData.get("opportunityId") ?? "").trim() || null;
  if (!titulo) return;

  // Se ligada a uma proposta, só pode criar quem já enxerga essa proposta
  if (opportunityId) {
    const visivel = await prisma.opportunity.findFirst({
      where: { AND: [{ id: opportunityId }, filtroPropostasVisiveis(sessao)] },
      select: { id: true },
    });
    if (!visivel) return;
  }

  const responsavel = await prisma.user.findUnique({ where: { id: responsavelId } });
  if (!responsavel || !responsavel.ativo) return;

  await prisma.tarefa.create({
    data: {
      titulo,
      descricao: descricao || null,
      dataLimite: dataLimiteBruta ? dataLocal(dataLimiteBruta) : null,
      responsavelId,
      criadoPorId: sessao.id,
      opportunityId,
    },
  });

  if (responsavelId !== sessao.id) {
    await notificarUsuario(
      responsavelId,
      `Nova tarefa: ${titulo}`,
      opportunityId ? `/propostas/${opportunityId}` : "/tarefas",
    );
  }

  revalidatePath("/tarefas");
  if (opportunityId) revalidatePath(`/propostas/${opportunityId}`);
  if (formData.get("voltarParaProposta")) redirect(`/propostas/${opportunityId}`);
}

/** Marca (ou desmarca) uma tarefa como concluída. Responsável, criador ou ADMIN. */
export async function concluirTarefa(formData: FormData) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const concluida = formData.get("concluida") === "1";

  const tarefa = await prisma.tarefa.findUniqueOrThrow({ where: { id } });
  const pode =
    sessao.area === "ADMIN" || sessao.id === tarefa.responsavelId || sessao.id === tarefa.criadoPorId;
  if (!pode) return;

  await prisma.tarefa.update({
    where: { id },
    data: { concluida, concluidaEm: concluida ? new Date() : null },
  });

  revalidatePath("/tarefas");
  if (tarefa.opportunityId) revalidatePath(`/propostas/${tarefa.opportunityId}`);
}

/** Exclui uma tarefa criada por engano. Só o criador ou ADMIN. */
export async function excluirTarefa(formData: FormData) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const tarefa = await prisma.tarefa.findUniqueOrThrow({ where: { id } });
  if (sessao.area !== "ADMIN" && sessao.id !== tarefa.criadoPorId) return;

  await prisma.tarefa.delete({ where: { id } });

  revalidatePath("/tarefas");
  if (tarefa.opportunityId) revalidatePath(`/propostas/${tarefa.opportunityId}`);
}
