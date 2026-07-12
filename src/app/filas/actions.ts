"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { AttestationStatus, HealthStatus } from "@/generated/prisma/enums";
import { ATESTACAO_ACOES } from "@/lib/flow";
import { ehGestor, obterSessao, podeAtuar } from "@/lib/auth";
import { notificarUsuario } from "@/lib/notificar";

export async function atualizarSaude(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const health = String(formData.get("health") ?? "") as HealthStatus;
  if (!["SAUDAVEL", "ATENCAO", "CRITICO"].includes(health)) return;

  const contrato = await prisma.contract.findUniqueOrThrow({ where: { id } });
  if (!podeAtuar(await obterSessao(), "CONTRATOS", contrato.responsavelId)) return;

  await prisma.contract.update({ where: { id }, data: { health } });
  revalidatePath("/filas", "layout");
}

export async function moverAtestacao(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const para = String(formData.get("para") ?? "") as AttestationStatus;

  const atestacao = await prisma.attestation.findUniqueOrThrow({ where: { id } });
  if (!podeAtuar(await obterSessao(), "FATURAMENTO", atestacao.responsavelId)) return;

  const permitida = ATESTACAO_ACOES[atestacao.status]?.some((a) => a.para === para);
  if (!permitida) return;

  await prisma.attestation.update({ where: { id }, data: { status: para } });
  revalidatePath("/filas", "layout");
}

/** Cria a atestação da competência corrente (valor mensal = valor do contrato ÷ 12). */
export async function gerarAtestacao(formData: FormData) {
  // Gerar é verbo de gestor: a atestação nasce sem responsável, para ser delegada
  if (!ehGestor(await obterSessao(), "FATURAMENTO")) return;
  const contractId = String(formData.get("contractId") ?? "");
  const contrato = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
  const competencia = new Date().toISOString().slice(0, 7);

  await prisma.attestation.upsert({
    where: { contractId_competencia: { contractId, competencia } },
    update: {},
    create: {
      contractId,
      competencia,
      valor: Math.round((Number(contrato.valor) / 12) * 100) / 100,
      status: "PENDENTE",
    },
  });
  revalidatePath("/filas", "layout");
}

/** Gestor de Contratos delega o acompanhamento de um contrato. */
export async function delegarContrato(formData: FormData) {
  const sessao = await obterSessao();
  if (!sessao || !ehGestor(sessao, "CONTRATOS")) return;

  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const contrato = await prisma.contract.findUniqueOrThrow({
    where: { id },
    include: { opportunity: { select: { cliente: true } } },
  });

  if (!userId) {
    await prisma.contract.update({ where: { id }, data: { responsavelId: null } });
  } else {
    const destino = await prisma.user.findUnique({ where: { id: userId } });
    if (!destino || !destino.ativo || destino.area !== "CONTRATOS") return;
    await prisma.contract.update({ where: { id }, data: { responsavelId: userId } });
    if (userId !== sessao.id) {
      await notificarUsuario(
        userId,
        `Contrato ${contrato.numero} · ${contrato.opportunity.cliente.nome} — delegado para você`,
        "/filas/contratos",
      );
    }
  }
  revalidatePath("/filas", "layout");
}

/** Gestor de Faturamento delega uma atestação. */
export async function delegarAtestacao(formData: FormData) {
  const sessao = await obterSessao();
  if (!sessao || !ehGestor(sessao, "FATURAMENTO")) return;

  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const atestacao = await prisma.attestation.findUniqueOrThrow({
    where: { id },
    include: { contract: { include: { opportunity: { select: { cliente: true } } } } },
  });

  if (!userId) {
    await prisma.attestation.update({ where: { id }, data: { responsavelId: null } });
  } else {
    const destino = await prisma.user.findUnique({ where: { id: userId } });
    if (!destino || !destino.ativo || destino.area !== "FATURAMENTO") return;
    await prisma.attestation.update({ where: { id }, data: { responsavelId: userId } });
    if (userId !== sessao.id) {
      await notificarUsuario(
        userId,
        `Atestação ${atestacao.competencia} · ${atestacao.contract.opportunity.cliente.nome} — delegada para você`,
        "/filas/faturamento",
      );
    }
  }
  revalidatePath("/filas", "layout");
}
