"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Area } from "@/generated/prisma/enums";
import { AREA_LABELS } from "@/lib/flow";
import { criarSessao } from "@/lib/auth";

export async function registrar(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const area = String(formData.get("area") ?? "");
  const senha = String(formData.get("senha") ?? "");

  // ADMIN nunca é opção de autocadastro
  const areaValida = (a: string): a is Area => a in AREA_LABELS && a !== "ADMIN";
  if (!name || !email || !areaValida(area)) return;
  if (senha.length < 6) redirect("/cadastro?erro=senha");

  let usuario = null;
  try {
    usuario = await prisma.user.create({
      data: {
        name,
        email,
        area,
        // Todo autocadastro nasce analista; só o administrador promove a gestor
        perfil: "ANALISTA",
        passwordHash: await bcrypt.hash(senha, 10),
      },
    });
  } catch {
    // e-mail já cadastrado (violação de unicidade)
  }
  if (!usuario) redirect("/cadastro?erro=email");

  await criarSessao({
    id: usuario.id,
    name: usuario.name,
    area: usuario.area,
    perfil: usuario.perfil,
  });
  redirect("/");
}
