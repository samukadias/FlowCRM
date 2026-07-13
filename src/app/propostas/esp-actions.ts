"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { EspTipo } from "@/generated/prisma/enums";
import type { Sessao } from "@/lib/auth-core";
import { ESP_TIPO_ORDEM } from "@/lib/flow";
import { ehGestor, obterSessao } from "@/lib/auth";
import { notificarUsuario } from "@/lib/notificar";
import { AnexoInvalido, salvarAnexo } from "@/lib/uploads";

/** Responsável pela ESP (ou gestor de Propostas) edita itens e anexo
 * enquanto ela ainda estiver em elaboração — trava assim que marcada pronta. */
function podeEditarEsp(sessao: Sessao, esp: { responsavelId: string | null; pronta: boolean }) {
  if (esp.pronta) return false;
  return ehGestor(sessao, "PROPOSTAS") || (sessao.area === "PROPOSTAS" && sessao.id === esp.responsavelId);
}

/** E + 3 dígitos do ano + 4 dígitos sequenciais — ex.: E0260430. Sequência
 * global por ano (não por oportunidade). */
async function proximoNumeroEsp(): Promise<string> {
  const anoCurto = String(new Date().getFullYear()).slice(-3);
  const prefixo = `E${anoCurto}`;
  const ultimo = await prisma.esp.findFirst({
    where: { numero: { startsWith: prefixo } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const atual = ultimo ? parseInt(ultimo.numero.slice(prefixo.length), 10) : 0;
  return `${prefixo}${String(atual + 1).padStart(4, "0")}`;
}

/** Gestor de Propostas desmembra o contrato (PD) da oportunidade numa ESP do
 * tipo escolhido — no máximo uma de cada tipo, só enquanto a Propostas ainda
 * está trabalhando nela (Em tratativa / Ajustes). */
export async function criarEsp(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as EspTipo;
  if (!opportunityId || !ESP_TIPO_ORDEM.includes(tipo)) return;

  const sessao = await obterSessao();
  if (!ehGestor(sessao, "PROPOSTAS")) return;

  const proposta = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!proposta || !proposta.numeroContratoTecnico) return;
  if (proposta.stage !== "EM_TRATATIVA" && proposta.stage !== "AJUSTES") return;

  const jaExiste = await prisma.esp.findUnique({
    where: { opportunityId_tipo: { opportunityId, tipo } },
  });
  if (jaExiste) return;

  await prisma.esp.create({
    data: { opportunityId, tipo, numero: await proximoNumeroEsp() },
  });

  revalidatePath(`/propostas/${opportunityId}`);
}

/** Gestor de Propostas designa (ou remove) o analista responsável pela ESP. */
export async function designarEsp(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!id || !opportunityId) return;

  const sessao = await obterSessao();
  if (!sessao || !ehGestor(sessao, "PROPOSTAS")) return;

  const esp = await prisma.esp.findUnique({ where: { id } });
  if (!esp || esp.opportunityId !== opportunityId) return;

  if (!userId) {
    await prisma.esp.update({ where: { id }, data: { responsavelId: null } });
  } else {
    const destino = await prisma.user.findUnique({ where: { id: userId } });
    if (!destino || !destino.ativo || destino.area !== "PROPOSTAS") return;
    await prisma.esp.update({ where: { id }, data: { responsavelId: userId } });
    if (userId !== sessao.id) {
      await notificarUsuario(userId, `${esp.numero} — ESP delegada para você`, `/propostas/${opportunityId}`);
    }
  }

  revalidatePath(`/propostas/${opportunityId}`);
}

/** O responsável pela ESP (ou o gestor de Propostas) marca como pronta, ou
 * reabre. Etapas terminais e a checagem de "todas prontas" ficam a cargo de
 * quem move a oportunidade (moverProposta). */
export async function alternarEspPronta(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const pronta = formData.get("pronta") === "1";
  if (!id || !opportunityId) return;

  const sessao = await obterSessao();
  if (!sessao) return;

  const esp = await prisma.esp.findUnique({ where: { id } });
  if (!esp || esp.opportunityId !== opportunityId) return;

  const pode =
    ehGestor(sessao, "PROPOSTAS") ||
    (sessao.area === "PROPOSTAS" && sessao.id === esp.responsavelId);
  if (!pode) return;

  await prisma.esp.update({
    where: { id },
    data: { pronta, prontaEm: pronta ? new Date() : null },
  });

  revalidatePath(`/propostas/${opportunityId}`);
}

/** Adiciona um item da PO (produto do catálogo, quantidade mensal, período
 * contratual e valor unitário) à ESP — só enquanto ela está em elaboração. */
export async function adicionarEspItem(formData: FormData) {
  const espId = String(formData.get("espId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const produtoId = String(formData.get("produtoId") ?? "");
  const quantidadeMensal = Number(String(formData.get("quantidadeMensal") ?? "").replace(",", "."));
  const periodoContratualMeses = parseInt(String(formData.get("periodoContratualMeses") ?? ""), 10);
  // CampoValorDecimal já envia um decimal puro (ex.: "4.80") no input escondido.
  const valorUnitarioBruto = String(formData.get("valorUnitario") ?? "").trim();
  if (!espId || !opportunityId || !produtoId) return;
  if (!Number.isFinite(quantidadeMensal) || quantidadeMensal <= 0) return;
  if (!Number.isInteger(periodoContratualMeses) || periodoContratualMeses <= 0) return;

  const sessao = await obterSessao();
  if (!sessao) return;

  const esp = await prisma.esp.findUnique({ where: { id: espId } });
  if (!esp || esp.opportunityId !== opportunityId || !podeEditarEsp(sessao, esp)) return;

  const produto = await prisma.produtoServico.findUnique({ where: { id: produtoId } });
  if (!produto || !produto.ativo) return;

  const valorUnitario = valorUnitarioBruto ? Number(valorUnitarioBruto) : Number(produto.valorUnitarioPadrao);
  if (!Number.isFinite(valorUnitario) || valorUnitario < 0) return;

  await prisma.espItem.create({
    data: { espId, produtoId, quantidadeMensal, periodoContratualMeses, valorUnitario },
  });

  revalidatePath(`/propostas/${opportunityId}`);
}

export async function removerEspItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const espId = String(formData.get("espId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!id || !espId || !opportunityId) return;

  const sessao = await obterSessao();
  if (!sessao) return;

  const esp = await prisma.esp.findUnique({ where: { id: espId } });
  if (!esp || esp.opportunityId !== opportunityId || !podeEditarEsp(sessao, esp)) return;

  await prisma.espItem.deleteMany({ where: { id, espId } });

  revalidatePath(`/propostas/${opportunityId}`);
}

/** Anexa o relatório de projeto técnico (Word) à ESP — um documento por
 * ESP, substituindo o anterior se houver; só enquanto em elaboração. */
export async function anexarRelatorioEsp(formData: FormData) {
  const espId = String(formData.get("espId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const file = formData.get("file");
  if (!espId || !opportunityId || !(file instanceof File) || file.size === 0) return;

  const sessao = await obterSessao();
  if (!sessao) return;

  const esp = await prisma.esp.findUnique({ where: { id: espId } });
  if (!esp || esp.opportunityId !== opportunityId || !podeEditarEsp(sessao, esp)) return;

  let anexo;
  try {
    anexo = await salvarAnexo(file);
  } catch (e) {
    const codigo = e instanceof AnexoInvalido ? "anexo_invalido" : "anexo_falhou";
    redirect(`/propostas/${opportunityId}?erro=${codigo}`);
  }

  await prisma.esp.update({
    where: { id: espId },
    data: {
      relatorioNome: anexo.fileName,
      relatorioTamanho: anexo.fileSize,
      relatorioUrl: anexo.fileUrl,
    },
  });

  revalidatePath(`/propostas/${opportunityId}`);
}
