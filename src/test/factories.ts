import { prisma } from "@/lib/prisma";
import type { Area, Perfil, Stage } from "@/generated/prisma/enums";

let contador = 0;
/** Sufixo curto e único por chamada, para não colidir campos @unique entre testes. */
function sufixo() {
  contador += 1;
  return `${Date.now()}-${contador}`;
}

export async function criarUsuario(
  area: Area,
  perfil: Perfil = "GESTOR",
  overrides: { name?: string; ativo?: boolean } = {},
) {
  const id = sufixo();
  return prisma.user.create({
    data: {
      name: overrides.name ?? `${area} ${perfil} ${id}`,
      email: `${area.toLowerCase()}-${perfil.toLowerCase()}-${id}@teste.com`,
      area,
      perfil,
      ativo: overrides.ativo ?? true,
    },
  });
}

export async function criarCliente() {
  const id = sufixo();
  return prisma.cliente.create({
    data: { nome: `Cliente Teste ${id}`, sigla: `CT${id.replace(/[^0-9]/g, "")}` },
  });
}

export async function criarProposta(params: {
  clienteId: string;
  criadoPorId: string;
  stage?: Stage;
  responsavelId?: string | null;
  valorEstimado?: number;
}) {
  const stage = params.stage ?? "ENTRADA";
  return prisma.opportunity.create({
    data: {
      codigo: `OPP-TESTE-${sufixo()}`,
      clienteId: params.clienteId,
      titulo: "Proposta de teste",
      valorEstimado: params.valorEstimado ?? 120_000,
      stage,
      criadoPorId: params.criadoPorId,
      responsavelId: params.responsavelId ?? null,
      eventos: { create: { paraStage: stage, userId: params.criadoPorId } },
    },
    include: { cliente: { select: { nome: true } } },
  });
}

export async function criarRegraAutomacao(params: {
  diasLimite: number;
  stage?: Stage | null;
  ativo?: boolean;
  nome?: string;
}) {
  return prisma.automationRule.create({
    data: {
      nome: params.nome ?? `Regra teste ${sufixo()}`,
      stage: params.stage ?? null,
      diasLimite: params.diasLimite,
      ativo: params.ativo ?? true,
    },
  });
}
