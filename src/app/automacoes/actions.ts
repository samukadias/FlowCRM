"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Stage } from "@/generated/prisma/enums";
import { obterSessao } from "@/lib/auth";

async function exigirAdmin() {
  const sessao = await obterSessao();
  return sessao?.area === "ADMIN" ? sessao : null;
}

function normalizar(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const stageBruto = String(formData.get("stage") ?? "").trim();
  const diasLimite = Number(formData.get("diasLimite") ?? "");
  return {
    nome,
    stage: (stageBruto || null) as Stage | null,
    diasLimite,
    ativo: formData.get("ativo") === "on",
  };
}

export async function criarRegra(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const dados = normalizar(formData);
  if (!dados.nome || !Number.isInteger(dados.diasLimite) || dados.diasLimite < 1) return;

  await prisma.automationRule.create({ data: dados });

  revalidatePath("/automacoes");
  redirect("/automacoes");
}

export async function atualizarRegra(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const dados = normalizar(formData);
  if (!id || !dados.nome || !Number.isInteger(dados.diasLimite) || dados.diasLimite < 1) return;

  await prisma.automationRule.update({ where: { id }, data: dados });

  revalidatePath("/automacoes");
  redirect("/automacoes");
}

/** Liga/desliga uma regra sem abrir o formulário de edição. */
export async function alternarRegra(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "1";
  if (!id) return;

  await prisma.automationRule.update({ where: { id }, data: { ativo } });
  revalidatePath("/automacoes");
}

export async function excluirRegra(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.automationRule.delete({ where: { id } });
  revalidatePath("/automacoes");
}
