"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { MotivoPerda, Stage } from "@/generated/prisma/enums";
import { FILA_DONA, FILA_TITULOS, MOTIVO_PERDA_LABELS, TRANSITIONS } from "@/lib/flow";
import { ehGestor, obterSessao, podeAgir, podeAtuar } from "@/lib/auth";
import { notificarArea, notificarUsuario } from "@/lib/notificar";
import { filtroPropostasVisiveis } from "@/lib/visibilidade";
import { AnexoInvalido, salvarAnexo } from "@/lib/uploads";

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
  const motivoPerda = (String(formData.get("motivoPerda") ?? "") || null) as MotivoPerda | null;

  const proposta = await prisma.opportunity.findUniqueOrThrow({
    where: { id },
    include: { cliente: { select: { nome: true } } },
  });
  const transicao = TRANSITIONS[proposta.stage]?.find((t) => t.para === para);
  if (!transicao) return; // transição não permitida a partir da etapa atual

  // Gestor da área executora atua em qualquer item; analista, só no que é dele.
  const ator = await obterSessao();
  if (!ator || !podeAtuar(ator, transicao.area, proposta.responsavelId)) return;

  // Recusa/cancelamento exigem um motivo — alimenta o relatório de perdas
  const precisaMotivo = para === "RECUSADA" || para === "CANCELADA";
  if (precisaMotivo && (!motivoPerda || !(motivoPerda in MOTIVO_PERDA_LABELS))) {
    redirect(`/propostas/${id}?erro=motivo_obrigatorio`);
  }

  // Ao mudar de área, o responsável zera até o gestor da nova fila delegar
  const donoNovo = FILA_DONA[para];
  const mudouDeMaos = donoNovo !== FILA_DONA[proposta.stage];

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id },
      data: {
        stage: para,
        ...(mudouDeMaos ? { responsavelId: null } : {}),
        ...(precisaMotivo ? { motivoPerda } : {}),
        // Toda mudança de etapa reinicia a contagem de estagnação
        alertaEstagnacaoEm: null,
      },
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

  // Esta ação também é usada nos botões rápidos da fila (que devem
  // permanecer na lista). Só a página da proposta pede a URL limpa —
  // sem isso, um ?erro= de uma tentativa anterior (ex.: motivo_obrigatorio)
  // continuaria na barra de endereço e o banner ficaria exibido após um sucesso.
  if (formData.get("voltarLimpo")) redirect(`/propostas/${id}`);
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

/** Confere sessão + visibilidade da proposta; devolve a sessão ou redireciona. */
async function exigirVisibilidade(id: string) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  const visivel = await prisma.opportunity.findFirst({
    where: { AND: [{ id }, filtroPropostasVisiveis(sessao)] },
    select: { id: true },
  });
  if (!visivel) redirect("/");
  return sessao;
}

/** Registra uma anotação interna na timeline da proposta. */
export async function registrarNota(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!id || !content) return;

  const sessao = await exigirVisibilidade(id);
  await prisma.workflowEvent.create({
    data: { opportunityId: id, userId: sessao.id, eventType: "NOTE", content },
  });

  revalidatePath(`/propostas/${id}`);
  redirect(`/propostas/${id}`);
}

/** Registra a troca de um e-mail com o cliente na timeline da proposta. */
export async function registrarEmail(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!id || !subject || !content) return;

  const sessao = await exigirVisibilidade(id);
  await prisma.workflowEvent.create({
    data: { opportunityId: id, userId: sessao.id, eventType: "EMAIL", subject, content },
  });

  revalidatePath(`/propostas/${id}`);
  redirect(`/propostas/${id}`);
}

/** Anexa um arquivo à proposta (PDF, Office, imagem, CSV, TXT ou ZIP; até 15 MB). */
export async function anexarArquivo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!id || !(file instanceof File) || file.size === 0) return;

  const sessao = await exigirVisibilidade(id);

  let anexo;
  try {
    anexo = await salvarAnexo(file);
  } catch (e) {
    const codigo = e instanceof AnexoInvalido ? "anexo_invalido" : "anexo_falhou";
    redirect(`/propostas/${id}?erro=${codigo}`);
  }

  await prisma.workflowEvent.create({
    data: {
      opportunityId: id,
      userId: sessao.id,
      eventType: "ATTACHMENT",
      fileName: anexo.fileName,
      fileSize: anexo.fileSize,
      fileUrl: anexo.fileUrl,
    },
  });

  revalidatePath(`/propostas/${id}`);
  redirect(`/propostas/${id}`);
}
