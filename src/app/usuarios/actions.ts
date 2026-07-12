"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Area, Perfil } from "@/generated/prisma/enums";
import { AREA_LABELS, PERFIL_LABELS } from "@/lib/flow";
import { obterSessao, podeAgir } from "@/lib/auth";

function areaValida(valor: string): valor is Area {
  return valor in AREA_LABELS;
}

function perfilValido(valor: string): valor is Perfil {
  return valor in PERFIL_LABELS;
}

export async function criarUsuario(formData: FormData) {
  if (!podeAgir(await obterSessao(), "ADMIN")) return;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const area = String(formData.get("area") ?? "");
  const perfil = String(formData.get("perfil") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (!name || !email || !areaValida(area) || !perfilValido(perfil)) return;
  if (senha.length < 6) redirect("/usuarios/novo?erro=senha");

  let criado = false;
  try {
    await prisma.user.create({
      data: { name, email, area, perfil, passwordHash: await bcrypt.hash(senha, 10) },
    });
    criado = true;
  } catch {
    // e-mail já cadastrado (violação de unicidade)
  }
  if (!criado) redirect("/usuarios/novo?erro=email");

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function atualizarUsuario(formData: FormData) {
  const sessao = await obterSessao();
  if (!podeAgir(sessao, "ADMIN")) return;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const area = String(formData.get("area") ?? "");
  const perfil = String(formData.get("perfil") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (!id || !name || !email || !areaValida(area) || !perfilValido(perfil)) return;
  if (senha && senha.length < 6) redirect(`/usuarios/${id}?erro=senha`);

  // Quem está logado não pode rebaixar a própria área nem o próprio perfil
  const areaFinal = id === sessao.id ? "ADMIN" : area;
  const perfilFinal = id === sessao.id ? "GESTOR" : perfil;

  let atualizado = false;
  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        area: areaFinal,
        perfil: perfilFinal,
        ...(senha ? { passwordHash: await bcrypt.hash(senha, 10) } : {}),
      },
    });
    atualizado = true;
  } catch {
    // e-mail já usado por outro usuário
  }
  if (!atualizado) redirect(`/usuarios/${id}?erro=email`);

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function alternarAtivo(formData: FormData) {
  const sessao = await obterSessao();
  if (!podeAgir(sessao, "ADMIN")) return;

  const id = String(formData.get("id") ?? "");
  if (!id || id === sessao.id) return; // ninguém desativa a si mesmo

  const usuario = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { ativo: !usuario.ativo } });
  revalidatePath("/usuarios");
}
