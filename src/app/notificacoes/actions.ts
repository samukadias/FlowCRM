"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";

export async function marcarTodasLidas() {
  const sessao = await obterSessao();
  if (!sessao) return;
  await prisma.notification.updateMany({
    where: { userId: sessao.id, lida: false },
    data: { lida: true },
  });
  revalidatePath("/", "layout");
}

/** Marca a notificação como lida e navega para o destino dela. */
export async function abrirNotificacao(formData: FormData) {
  const sessao = await obterSessao();
  if (!sessao) return;
  const id = String(formData.get("id") ?? "");

  const notificacao = await prisma.notification.findUnique({ where: { id } });
  if (!notificacao || notificacao.userId !== sessao.id) return;

  await prisma.notification.update({ where: { id }, data: { lida: true } });
  revalidatePath("/", "layout");
  redirect(notificacao.link);
}
