import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { limparBanco } from "@/test/db";
import { criarCliente, criarProposta, criarUsuario } from "@/test/factories";
import { verificarEstagnacao, DIAS_LIMITE_ESTAGNACAO } from "./estagnacao";

const DIA_MS = 86_400_000;

/** Empurra o evento de mudança de etapa da proposta para o passado. */
async function envelhecerProposta(opportunityId: string, dias: number) {
  await prisma.workflowEvent.updateMany({
    where: { opportunityId, eventType: "STAGE_CHANGE" },
    data: { createdAt: new Date(Date.now() - dias * DIA_MS) },
  });
}

beforeEach(async () => {
  await limparBanco();
});

describe("verificarEstagnacao", () => {
  it("notifica o responsável quando a proposta está parada há mais do que o limite", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: gestor.id,
      stage: "EM_TRATATIVA",
      responsavelId: analista.id,
    });
    await envelhecerProposta(proposta.id, DIAS_LIMITE_ESTAGNACAO + 1);

    const notificadas = await verificarEstagnacao();

    expect(notificadas).toBe(1);
    const notificacoes = await prisma.notification.findMany({ where: { userId: analista.id } });
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0].titulo).toContain(proposta.codigo);
    expect(notificacoes[0].link).toBe(`/propostas/${proposta.id}`);
  });

  it("sem responsável, notifica os gestores da área dona da fila", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const outroGestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const analistaOutraArea = await criarUsuario("DELIVERY", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: gestor.id,
      stage: "EM_TRATATIVA", // fila é de PROPOSTAS
    });
    await envelhecerProposta(proposta.id, DIAS_LIMITE_ESTAGNACAO + 1);

    await verificarEstagnacao();

    expect(await prisma.notification.count({ where: { userId: gestor.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: outroGestor.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: analistaOutraArea.id } })).toBe(0);
  });

  it("não notifica proposta ainda dentro do prazo", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: gestor.id,
      stage: "EM_TRATATIVA",
    });
    await envelhecerProposta(proposta.id, DIAS_LIMITE_ESTAGNACAO - 1);

    const notificadas = await verificarEstagnacao();

    expect(notificadas).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("não notifica de novo a mesma proposta na mesma etapa", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: gestor.id,
      stage: "EM_TRATATIVA",
      responsavelId: analista.id,
    });
    await envelhecerProposta(proposta.id, DIAS_LIMITE_ESTAGNACAO + 1);

    await verificarEstagnacao();
    const segundaChamada = await verificarEstagnacao();

    expect(segundaChamada).toBe(0);
    expect(await prisma.notification.count({ where: { userId: analista.id } })).toBe(1);
  });

  it("nunca notifica sobre propostas em etapa terminal", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: gestor.id,
      stage: "ACEITA",
    });
    await envelhecerProposta(proposta.id, 60);

    const notificadas = await verificarEstagnacao();

    expect(notificadas).toBe(0);
  });
});
