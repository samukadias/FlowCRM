import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { limparBanco } from "@/test/db";
import { criarCliente, criarProduto, criarProposta, criarUsuario } from "@/test/factories";
import type { Sessao } from "@/lib/auth-core";

vi.mock("@/lib/auth", async () => {
  const core = await import("@/lib/auth-core");
  return {
    podeAgir: core.podeAgir,
    ehGestor: core.ehGestor,
    podeAtuar: core.podeAtuar,
    obterSessao: vi.fn(),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { obterSessao } = await import("@/lib/auth");
const { criarEsp, designarEsp, alternarEspPronta, adicionarEspItem, removerEspItem } =
  await import("./esp-actions");

function logarComo(sessao: Sessao) {
  vi.mocked(obterSessao).mockResolvedValue(sessao);
}

function sessaoDe(user: { id: string; name: string; area: Sessao["area"]; perfil: Sessao["perfil"] }): Sessao {
  return { id: user.id, name: user.name, area: user.area, perfil: user.perfil };
}

async function propostaComPd(overrides: { stage?: "EM_TRATATIVA" | "AJUSTES" | "EM_VERIFICACAO" } = {}) {
  const comercial = await criarUsuario("COMERCIAL", "GESTOR");
  const cliente = await criarCliente();
  const proposta = await criarProposta({
    clienteId: cliente.id,
    criadoPorId: comercial.id,
    stage: overrides.stage ?? "EM_TRATATIVA",
    tipo: "PROPOSTA_TECNICA",
    codigo: `OPP-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
  });
  await prisma.opportunity.update({
    where: { id: proposta.id },
    data: { numeroContratoTecnico: `PD26${proposta.codigo.slice(-4)}` },
  });
  return proposta;
}

beforeEach(async () => {
  await limparBanco();
});

describe("criarEsp", () => {
  it("gestor de Propostas desmembra o contrato numa ESP com número automático", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const proposta = await propostaComPd();
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("opportunityId", proposta.id);
    fd.set("tipo", "ITOI");
    await criarEsp(fd);

    const esps = await prisma.esp.findMany({ where: { opportunityId: proposta.id } });
    expect(esps).toHaveLength(1);
    expect(esps[0].tipo).toBe("ITOI");
    expect(esps[0].numero).toMatch(/^E\d{7}$/);
    expect(esps[0].pronta).toBe(false);
  });

  it("não permite duas ESPs do mesmo tipo na mesma oportunidade", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const proposta = await propostaComPd();
    logarComo(sessaoDe(gestor));

    for (let i = 0; i < 2; i++) {
      const fd = new FormData();
      fd.set("opportunityId", proposta.id);
      fd.set("tipo", "APP");
      await criarEsp(fd);
    }

    expect(await prisma.esp.count({ where: { opportunityId: proposta.id, tipo: "APP" } })).toBe(1);
  });

  it("analista de Propostas não pode desmembrar (só o gestor)", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("opportunityId", proposta.id);
    fd.set("tipo", "ITOI");
    await criarEsp(fd);

    expect(await prisma.esp.count({ where: { opportunityId: proposta.id } })).toBe(0);
  });

  it("não cria ESP sem número de contrato (proposta ainda não chegou lá)", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "EM_TRATATIVA",
      tipo: "PROPOSTA_TECNICA",
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("opportunityId", proposta.id);
    fd.set("tipo", "ITOI");
    await criarEsp(fd);

    expect(await prisma.esp.count({ where: { opportunityId: proposta.id } })).toBe(0);
  });

  it("não cria ESP fora de Em tratativa/Ajustes", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const proposta = await propostaComPd({ stage: "EM_VERIFICACAO" });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("opportunityId", proposta.id);
    fd.set("tipo", "ITOI");
    await criarEsp(fd);

    expect(await prisma.esp.count({ where: { opportunityId: proposta.id } })).toBe(0);
  });
});

describe("designarEsp", () => {
  it("gestor delega a ESP para um analista de Propostas e ele é notificado", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: { opportunityId: proposta.id, tipo: "ITOI", numero: "E0260001" },
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("id", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("userId", analista.id);
    await designarEsp(fd);

    const atual = await prisma.esp.findUniqueOrThrow({ where: { id: esp.id } });
    expect(atual.responsavelId).toBe(analista.id);
    expect(await prisma.notification.count({ where: { userId: analista.id } })).toBe(1);
  });

  it("rejeita delegar para alguém de outra área", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const analistaErrado = await criarUsuario("DELIVERY", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: { opportunityId: proposta.id, tipo: "ITOI", numero: "E0260002" },
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("id", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("userId", analistaErrado.id);
    await designarEsp(fd);

    const atual = await prisma.esp.findUniqueOrThrow({ where: { id: esp.id } });
    expect(atual.responsavelId).toBeNull();
  });
});

describe("alternarEspPronta", () => {
  it("o analista designado marca a própria ESP como pronta", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260003",
        responsavelId: analista.id,
      },
    });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("id", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("pronta", "1");
    await alternarEspPronta(fd);

    const atual = await prisma.esp.findUniqueOrThrow({ where: { id: esp.id } });
    expect(atual.pronta).toBe(true);
    expect(atual.prontaEm).not.toBeNull();
  });

  it("analista sem ser o responsável não pode marcar a ESP de outro", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const outroAnalista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260004",
        responsavelId: analista.id,
      },
    });
    logarComo(sessaoDe(outroAnalista));

    const fd = new FormData();
    fd.set("id", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("pronta", "1");
    await alternarEspPronta(fd);

    const atual = await prisma.esp.findUniqueOrThrow({ where: { id: esp.id } });
    expect(atual.pronta).toBe(false);
  });
});

describe("adicionarEspItem", () => {
  it("responsável adiciona um item da PO usando o preço padrão do catálogo", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260010",
        responsavelId: analista.id,
      },
    });
    const produto = await criarProduto({ nome: "Armazenamento GB", unidade: "GB", valorUnitarioPadrao: 4.8 });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("espId", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("produtoId", produto.id);
    fd.set("quantidadeMensal", "20");
    fd.set("periodoContratualMeses", "12");
    await adicionarEspItem(fd);

    const itens = await prisma.espItem.findMany({ where: { espId: esp.id } });
    expect(itens).toHaveLength(1);
    expect(Number(itens[0].quantidadeMensal)).toBe(20);
    expect(itens[0].periodoContratualMeses).toBe(12);
    expect(Number(itens[0].valorUnitario)).toBe(4.8);
  });

  it("aceita um valor unitário negociado diferente do padrão do catálogo", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260011",
        responsavelId: analista.id,
      },
    });
    const produto = await criarProduto({ valorUnitarioPadrao: 4.8 });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("espId", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("produtoId", produto.id);
    fd.set("quantidadeMensal", "20");
    fd.set("periodoContratualMeses", "12");
    fd.set("valorUnitario", "3.90");
    await adicionarEspItem(fd);

    const item = await prisma.espItem.findFirstOrThrow({ where: { espId: esp.id } });
    expect(Number(item.valorUnitario)).toBe(3.9);
  });

  it("não adiciona item numa ESP já marcada como pronta", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260012",
        responsavelId: analista.id,
        pronta: true,
      },
    });
    const produto = await criarProduto();
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("espId", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("produtoId", produto.id);
    fd.set("quantidadeMensal", "20");
    fd.set("periodoContratualMeses", "12");
    await adicionarEspItem(fd);

    expect(await prisma.espItem.count({ where: { espId: esp.id } })).toBe(0);
  });

  it("analista que não é o responsável não pode adicionar item", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const outroAnalista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260013",
        responsavelId: analista.id,
      },
    });
    const produto = await criarProduto();
    logarComo(sessaoDe(outroAnalista));

    const fd = new FormData();
    fd.set("espId", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("produtoId", produto.id);
    fd.set("quantidadeMensal", "20");
    fd.set("periodoContratualMeses", "12");
    await adicionarEspItem(fd);

    expect(await prisma.espItem.count({ where: { espId: esp.id } })).toBe(0);
  });

  it("não adiciona item de produto inativo", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260014",
        responsavelId: analista.id,
      },
    });
    const produto = await criarProduto({ ativo: false });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("espId", esp.id);
    fd.set("opportunityId", proposta.id);
    fd.set("produtoId", produto.id);
    fd.set("quantidadeMensal", "20");
    fd.set("periodoContratualMeses", "12");
    await adicionarEspItem(fd);

    expect(await prisma.espItem.count({ where: { espId: esp.id } })).toBe(0);
  });
});

describe("removerEspItem", () => {
  it("responsável remove um item enquanto a ESP está em elaboração", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260015",
        responsavelId: analista.id,
      },
    });
    const produto = await criarProduto();
    const item = await prisma.espItem.create({
      data: { espId: esp.id, produtoId: produto.id, quantidadeMensal: 10, periodoContratualMeses: 6, valorUnitario: 10 },
    });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("espId", esp.id);
    fd.set("opportunityId", proposta.id);
    await removerEspItem(fd);

    expect(await prisma.espItem.count({ where: { espId: esp.id } })).toBe(0);
  });

  it("não remove item de ESP já pronta", async () => {
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await propostaComPd();
    const esp = await prisma.esp.create({
      data: {
        opportunityId: proposta.id,
        tipo: "ITOI",
        numero: "E0260016",
        responsavelId: analista.id,
        pronta: true,
      },
    });
    const produto = await criarProduto();
    const item = await prisma.espItem.create({
      data: { espId: esp.id, produtoId: produto.id, quantidadeMensal: 10, periodoContratualMeses: 6, valorUnitario: 10 },
    });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("espId", esp.id);
    fd.set("opportunityId", proposta.id);
    await removerEspItem(fd);

    expect(await prisma.espItem.count({ where: { espId: esp.id } })).toBe(1);
  });
});
