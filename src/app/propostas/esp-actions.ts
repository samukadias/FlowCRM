"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { EspTipo } from "@/generated/prisma/enums";
import { ESP_TIPO_ORDEM } from "@/lib/flow";
import { ehGestor, obterSessao } from "@/lib/auth";
import { notificarUsuario } from "@/lib/notificar";

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
