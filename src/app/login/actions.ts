"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { criarSessao, encerrarSessao } from "@/lib/auth";

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  const usuario = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;
  const valida =
    usuario != null &&
    usuario.ativo &&
    usuario.passwordHash !== "" &&
    (await bcrypt.compare(senha, usuario.passwordHash));

  if (!usuario || !valida) redirect("/login?erro=1");

  await criarSessao({
    id: usuario.id,
    name: usuario.name,
    area: usuario.area,
    perfil: usuario.perfil,
  });
  redirect("/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
