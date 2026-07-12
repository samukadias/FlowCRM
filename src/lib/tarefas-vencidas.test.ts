import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { limparBanco } from "@/test/db";
import { criarUsuario } from "@/test/factories";
import { verificarTarefasVencidas } from "./tarefas-vencidas";

const DIA_MS = 86_400_000;

beforeEach(async () => {
  await limparBanco();
});

describe("verificarTarefasVencidas", () => {
  it("notifica o responsável por uma tarefa com prazo vencido", async () => {
    const usuario = await criarUsuario("COMERCIAL", "ANALISTA");
    const tarefa = await prisma.tarefa.create({
      data: {
        titulo: "Ligar para o cliente",
        dataLimite: new Date(Date.now() - 2 * DIA_MS),
        responsavelId: usuario.id,
        criadoPorId: usuario.id,
      },
    });

    const notificadas = await verificarTarefasVencidas();

    expect(notificadas).toBe(1);
    const notificacoes = await prisma.notification.findMany({ where: { userId: usuario.id } });
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0].titulo).toContain(tarefa.titulo);
    expect(notificacoes[0].link).toBe("/tarefas");
  });

  it("aponta para a proposta quando a tarefa está vinculada a uma", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const cliente = await prisma.cliente.create({
      data: { nome: "Cliente Teste Vencida", sigla: "CTV1" },
    });
    const proposta = await prisma.opportunity.create({
      data: {
        codigo: "OPP-TESTE-VENCIDA-1",
        clienteId: cliente.id,
        titulo: "Proposta",
        criadoPorId: gestor.id,
      },
    });
    const tarefa = await prisma.tarefa.create({
      data: {
        titulo: "Revisar escopo",
        dataLimite: new Date(Date.now() - DIA_MS),
        responsavelId: gestor.id,
        criadoPorId: gestor.id,
        opportunityId: proposta.id,
      },
    });

    await verificarTarefasVencidas();

    const notificacoes = await prisma.notification.findMany({ where: { userId: gestor.id } });
    expect(notificacoes[0].link).toBe(`/propostas/${proposta.id}`);
    expect(notificacoes[0].titulo).toContain(tarefa.titulo);
  });

  it("não notifica tarefa sem prazo", async () => {
    const usuario = await criarUsuario("COMERCIAL", "ANALISTA");
    await prisma.tarefa.create({
      data: { titulo: "Tarefa sem prazo", responsavelId: usuario.id, criadoPorId: usuario.id },
    });

    const notificadas = await verificarTarefasVencidas();

    expect(notificadas).toBe(0);
  });

  it("não notifica tarefa dentro do prazo", async () => {
    const usuario = await criarUsuario("COMERCIAL", "ANALISTA");
    await prisma.tarefa.create({
      data: {
        titulo: "Tarefa futura",
        dataLimite: new Date(Date.now() + DIA_MS),
        responsavelId: usuario.id,
        criadoPorId: usuario.id,
      },
    });

    const notificadas = await verificarTarefasVencidas();

    expect(notificadas).toBe(0);
  });

  it("não notifica tarefa já concluída", async () => {
    const usuario = await criarUsuario("COMERCIAL", "ANALISTA");
    await prisma.tarefa.create({
      data: {
        titulo: "Tarefa concluída",
        dataLimite: new Date(Date.now() - DIA_MS),
        concluida: true,
        concluidaEm: new Date(),
        responsavelId: usuario.id,
        criadoPorId: usuario.id,
      },
    });

    const notificadas = await verificarTarefasVencidas();

    expect(notificadas).toBe(0);
  });

  it("não notifica de novo a mesma tarefa", async () => {
    const usuario = await criarUsuario("COMERCIAL", "ANALISTA");
    await prisma.tarefa.create({
      data: {
        titulo: "Ligar para o cliente",
        dataLimite: new Date(Date.now() - DIA_MS),
        responsavelId: usuario.id,
        criadoPorId: usuario.id,
      },
    });

    await verificarTarefasVencidas();
    const segundaChamada = await verificarTarefasVencidas();

    expect(segundaChamada).toBe(0);
    expect(await prisma.notification.count({ where: { userId: usuario.id } })).toBe(1);
  });
});
