import { prisma } from "./prisma";
import type { Area } from "@/generated/prisma/enums";

/**
 * Cria uma notificação para usuários ativos de uma área (menos o autor da ação).
 * Com `apenasGestores`, avisa só quem delega — o padrão para chegada de item na fila.
 */
export async function notificarArea(
  area: Area,
  titulo: string,
  link: string,
  opcoes: { excetoUserId?: string; apenasGestores?: boolean } = {},
) {
  const usuarios = await prisma.user.findMany({
    where: {
      area,
      ativo: true,
      ...(opcoes.apenasGestores ? { perfil: "GESTOR" } : {}),
      ...(opcoes.excetoUserId ? { id: { not: opcoes.excetoUserId } } : {}),
    },
    select: { id: true },
  });
  if (usuarios.length === 0) return;
  await prisma.notification.createMany({
    data: usuarios.map((u) => ({ userId: u.id, titulo, link })),
  });
}

/** Notificação direta para uma pessoa (ex.: item delegado a ela). */
export async function notificarUsuario(userId: string, titulo: string, link: string) {
  await prisma.notification.create({ data: { userId, titulo, link } });
}
