"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterSessao, type Sessao } from "@/lib/auth";

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
  const { nome, sigla } = normalizar(formData);
  if (!nome || sigla.length < 2) redirect("/clientes/novo?erro=sigla");

  let criado = false;
  try {
    await prisma.cliente.create({ data: { nome, sigla } });
    criado = true;
  } catch {
    // nome ou sigla já cadastrados (violação de unicidade)
  }
  if (!criado) redirect("/clientes/novo?erro=duplicado");

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function atualizarCliente(formData: FormData) {
  if (!podeGerirClientes(await obterSessao())) return;
  const id = String(formData.get("id") ?? "");
  const { nome, sigla } = normalizar(formData);
  if (!id) return;
  if (!nome || sigla.length < 2) redirect(`/clientes/${id}?erro=sigla`);

  let atualizado = false;
  try {
    await prisma.cliente.update({ where: { id }, data: { nome, sigla } });
    atualizado = true;
  } catch {
    // nome ou sigla já usados por outro cliente
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
