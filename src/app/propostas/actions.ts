"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Stage } from "@/generated/prisma/enums";
import { FILA_DONA, FILA_TITULOS, TRANSITIONS } from "@/lib/flow";
import { ehGestor, obterSessao, podeAgir, podeAtuar } from "@/lib/auth";
import { notificarArea, notificarUsuario } from "@/lib/notificar";

/** Gera o próximo código sequencial do ano, ex.: OPP-2026-0009. */
async function proximoCodigo(prefixo: "OPP" | "CTR"): Promise<string> {
  const ano = new Date().getFullYear();
  const inicio = `${prefixo}-${ano}-`;
  const ultimo =
    prefixo === "OPP"
      ? (
          await prisma.opportunity.findFirst({
            where: { codigo: { startsWith: inicio } },
            orderBy: { codigo: "desc" },
            select: { codigo: true },
          })
        )?.codigo
      : (
          await prisma.contract.findFirst({
            where: { numero: { startsWith: inicio } },
            orderBy: { numero: "desc" },
            select: { numero: true },
          })
        )?.numero;
  const atual = ultimo ? parseInt(ultimo.slice(inicio.length), 10) : 0;
  return `${inicio}${String(atual + 1).padStart(4, "0")}`;
}

export async function criarProposta(formData: FormData) {
  const clienteId = String(formData.get("clienteId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorBruto = String(formData.get("valor") ?? "").trim();
  if (!clienteId || !titulo) return;

  const valor = valorBruto ? Number(valorBruto.replace(/\./g, "").replace(",", ".")) : null;

  // A entrada é um verbo do Comercial (ADMIN também pode).
  const sessao = await obterSessao();
  if (!podeAgir(sessao, "COMERCIAL")) return;
  const autor = sessao;

  // O cliente precisa existir no cadastro (mantido pelo admin/gestor de Propostas)
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return;

  const proposta = await prisma.opportunity.create({
    data: {
      codigo: await proximoCodigo("OPP"),
      clienteId,
      titulo,
      descricao: descricao || null,
      valorEstimado: valor != null && Number.isFinite(valor) ? valor : null,
      stage: "ENTRADA",
      criadoPorId: autor.id,
      eventos: {
        create: {
          paraStage: "ENTRADA",
          userId: autor.id,
          observacao: descricao || null,
        },
      },
    },
  });

  await notificarArea(
    "PROPOSTAS",
    `${proposta.codigo} · ${cliente.nome} — nova proposta aguardando tratativa`,
    `/propostas/${proposta.id}`,
    { excetoUserId: autor.id, apenasGestores: true },
  );

  revalidatePath("/");
  redirect(`/propostas/${proposta.id}`);
}

export async function moverProposta(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const para = String(formData.get("para") ?? "") as Stage;
  const observacao = String(formData.get("observacao") ?? "").trim();

  const proposta = await prisma.opportunity.findUniqueOrThrow({
    where: { id },
    include: { cliente: { select: { nome: true } } },
  });
  const transicao = TRANSITIONS[proposta.stage]?.find((t) => t.para === para);
  if (!transicao) return; // transição não permitida a partir da etapa atual

  // Gestor da área executora atua em qualquer item; analista, só no que é dele.
  const ator = await obterSessao();
  if (!ator || !podeAtuar(ator, transicao.area, proposta.responsavelId)) return;

  // Ao mudar de área, o responsável zera até o gestor da nova fila delegar
  const donoNovo = FILA_DONA[para];
  const mudouDeMaos = donoNovo !== FILA_DONA[proposta.stage];

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id },
      data: { stage: para, ...(mudouDeMaos ? { responsavelId: null } : {}) },
    });
    await tx.workflowEvent.create({
      data: {
        opportunityId: id,
        deStage: proposta.stage,
        paraStage: para,
        userId: ator.id,
        observacao: observacao || null,
      },
    });
  });

  // Avisa os gestores da área que passa a ser dona da fila (para delegarem)
  if (donoNovo && mudouDeMaos) {
    await notificarArea(
      donoNovo,
      `${proposta.codigo} · ${proposta.cliente.nome} — ${FILA_TITULOS[para]?.toLowerCase()}`,
      `/propostas/${id}`,
      { excetoUserId: ator.id, apenasGestores: true },
    );
  }

  // Aceite gera o contrato automaticamente (vigência inicial de 12 meses).
  if (para === "ACEITA") {
    const existente = await prisma.contract.findUnique({ where: { opportunityId: id } });
    if (!existente) {
      const inicio = new Date();
      const fim = new Date(inicio);
      fim.setFullYear(fim.getFullYear() + 1);
      const contrato = await prisma.contract.create({
        data: {
          opportunityId: id,
          numero: await proximoCodigo("CTR"),
          inicioVigencia: inicio,
          fimVigencia: fim,
          valor: proposta.valorEstimado ?? 0,
        },
      });
      await Promise.all([
        notificarArea(
          "CONTRATOS",
          `Contrato ${contrato.numero} criado — ${proposta.cliente.nome} (${proposta.codigo})`,
          `/propostas/${id}`,
          { excetoUserId: ator.id, apenasGestores: true },
        ),
        notificarArea(
          "FATURAMENTO",
          `Contrato ${contrato.numero} ativo — gerar atestações de ${proposta.cliente.nome}`,
          `/filas/faturamento`,
          { excetoUserId: ator.id, apenasGestores: true },
        ),
      ]);
    }
  }

  revalidatePath("/");
  revalidatePath(`/propostas/${id}`);
  revalidatePath("/filas", "layout");
}

/** Gestor da área dona da fila delega a proposta a alguém da equipe. */
export async function delegarProposta(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");

  const proposta = await prisma.opportunity.findUniqueOrThrow({
    where: { id },
    include: { cliente: { select: { nome: true } } },
  });
  const dona = FILA_DONA[proposta.stage];
  if (!dona) return; // etapa terminal não tem fila

  const sessao = await obterSessao();
  if (!sessao || !ehGestor(sessao, dona)) return;

  if (!userId) {
    // Remover atribuição
    await prisma.opportunity.update({ where: { id }, data: { responsavelId: null } });
  } else {
    const destino = await prisma.user.findUnique({ where: { id: userId } });
    if (!destino || !destino.ativo || destino.area !== dona) return;
    await prisma.opportunity.update({ where: { id }, data: { responsavelId: userId } });
    if (userId !== sessao.id) {
      await notificarUsuario(
        userId,
        `${proposta.codigo} · ${proposta.cliente.nome} — delegada para você`,
        `/propostas/${id}`,
      );
    }
  }

  revalidatePath(`/propostas/${id}`);
  revalidatePath("/filas", "layout");
}
