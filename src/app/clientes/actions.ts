"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { obterSessao, type Sessao } from "@/lib/auth";

/** true só quando a falha é de fato nome/sigla duplicados (violação de unicidade). */
function ehConflitoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

/** Clientes são mantidos pelo administrador ou pelo gestor de Propostas. */
function podeGerirClientes(sessao: Sessao | null): sessao is Sessao {
  return (
    sessao != null &&
    (sessao.area === "ADMIN" ||
      (sessao.area === "PROPOSTAS" && sessao.perfil === "GESTOR"))
  );
}

function normalizar(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const sigla = String(formData.get("sigla") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return { nome, sigla };
}

export async function criarCliente(formData: FormData) {
  if (!podeGerirClientes(await obterSessao())) return;
  const dados = normalizar(formData);
  if (!dados.nome || dados.sigla.length < 2) redirect("/clientes/novo?erro=sigla");

  let criado = false;
  try {
    await prisma.cliente.create({ data: dados });
    criado = true;
  } catch (erro) {
    if (!ehConflitoDeUnicidade(erro)) throw erro;
  }
  if (!criado) redirect("/clientes/novo?erro=duplicado");

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function atualizarCliente(formData: FormData) {
  if (!podeGerirClientes(await obterSessao())) return;
  const id = String(formData.get("id") ?? "");
  const dados = normalizar(formData);
  if (!id) return;
  if (!dados.nome || dados.sigla.length < 2) redirect(`/clientes/${id}?erro=sigla`);

  let atualizado = false;
  try {
    await prisma.cliente.update({ where: { id }, data: dados });
    atualizado = true;
  } catch (erro) {
    if (!ehConflitoDeUnicidade(erro)) throw erro;
  }
  if (!atualizado) redirect(`/clientes/${id}?erro=duplicado`);

  revalidatePath("/", "layout"); // o nome aparece em propostas, filas e detalhes
  redirect("/clientes");
}

/** Exclui um cliente apenas se ele não tiver propostas. */
export async function excluirCliente(formData: FormData) {
  if (!podeGerirClientes(await obterSessao())) return;
  const id = String(formData.get("id") ?? "");

  const emUso = await prisma.opportunity.count({ where: { clienteId: id } });
  if (emUso > 0) return; // com propostas, o histórico precisa do cliente

  await prisma.cliente.delete({ where: { id } });
  revalidatePath("/clientes");
}

function normalizarContato(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  return { nome, cargo: cargo || null, email: email || null, telefone: telefone || null };
}

/** Adiciona um contato ao cliente. O primeiro cadastrado vira o principal. */
export async function criarContato(formData: FormData) {
  if (!podeGerirClientes(await obterSessao())) return;
  const clienteId = String(formData.get("clienteId") ?? "");
  const dados = normalizarContato(formData);
  if (!clienteId || !dados.nome) return;

  const jaTemPrincipal = await prisma.contact.count({ where: { clienteId, principal: true } });
  await prisma.contact.create({ data: { ...dados, clienteId, principal: jaTemPrincipal === 0 } });

  revalidatePath(`/clientes/${clienteId}`);
}

/** Marca um contato como o principal do cliente — só um por vez. */
export async function definirContatoPrincipal(formData: FormData) {
  if (!podeGerirClientes(await obterSessao())) return;
  const id = String(formData.get("id") ?? "");
  const clienteId = String(formData.get("clienteId") ?? "");
  if (!id || !clienteId) return;

  await prisma.$transaction([
    prisma.contact.updateMany({ where: { clienteId }, data: { principal: false } }),
    prisma.contact.update({ where: { id }, data: { principal: true } }),
  ]);

  revalidatePath(`/clientes/${clienteId}`);
}

export async function excluirContato(formData: FormData) {
  if (!podeGerirClientes(await obterSessao())) return;
  const id = String(formData.get("id") ?? "");
  const clienteId = String(formData.get("clienteId") ?? "");
  if (!id) return;

  await prisma.contact.delete({ where: { id } });
  revalidatePath(`/clientes/${clienteId}`);
}
