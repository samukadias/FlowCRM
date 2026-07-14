"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { obterSessao } from "@/lib/auth";

function ehConflitoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

async function exigirAdmin() {
  const sessao = await obterSessao();
  return sessao?.area === "ADMIN" ? sessao : null;
}

function normalizar(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const unidade = String(formData.get("unidade") ?? "").trim();
  // CampoValorDecimal já envia um decimal puro (ex.: "4.80") no input escondido.
  const valorUnitarioPadrao = Number(String(formData.get("valorUnitarioPadrao") ?? ""));
  return { nome, categoria, unidade, valorUnitarioPadrao, ativo: formData.get("ativo") === "on" };
}

export async function criarProduto(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const dados = normalizar(formData);
  if (!dados.nome || !dados.categoria || !dados.unidade || !Number.isFinite(dados.valorUnitarioPadrao)) {
    redirect("/catalogo?erro=dados_invalidos");
  }

  let criado = false;
  try {
    await prisma.produtoServico.create({ data: dados });
    criado = true;
  } catch (erro) {
    if (!ehConflitoDeUnicidade(erro)) throw erro;
  }
  if (!criado) redirect("/catalogo?erro=duplicado");

  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function atualizarProduto(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const dados = normalizar(formData);
  if (!id || !dados.nome || !dados.categoria || !dados.unidade || !Number.isFinite(dados.valorUnitarioPadrao)) {
    redirect("/catalogo?erro=dados_invalidos");
  }

  let atualizado = false;
  try {
    await prisma.produtoServico.update({ where: { id }, data: dados });
    atualizado = true;
  } catch (erro) {
    if (!ehConflitoDeUnicidade(erro)) throw erro;
  }
  if (!atualizado) redirect("/catalogo?erro=duplicado");

  revalidatePath("/catalogo");
  redirect("/catalogo");
}

/** Desativa um produto sem apagar histórico — itens de ESP já criados continuam válidos. */
export async function alternarProdutoAtivo(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "1";
  if (!id) return;

  await prisma.produtoServico.update({ where: { id }, data: { ativo } });
  revalidatePath("/catalogo");
}

/** Só exclui de fato quando nenhum item de ESP referencia o produto. */
export async function excluirProduto(formData: FormData) {
  if (!(await exigirAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const emUso = await prisma.espItem.count({ where: { produtoId: id } });
  if (emUso > 0) return;

  await prisma.produtoServico.delete({ where: { id } });
  revalidatePath("/catalogo");
}
