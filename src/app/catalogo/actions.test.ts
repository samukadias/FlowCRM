import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { limparBanco } from "@/test/db";
import { criarCliente, criarProduto, criarProposta, criarUsuario } from "@/test/factories";
import { RedirectError } from "@/test/next-mocks";
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
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { obterSessao } = await import("@/lib/auth");
const { criarProduto: criarProdutoAction, atualizarProduto, alternarProdutoAtivo, excluirProduto } =
  await import("./actions");

function logarComo(sessao: Sessao) {
  vi.mocked(obterSessao).mockResolvedValue(sessao);
}

function sessaoDe(user: { id: string; name: string; area: Sessao["area"]; perfil: Sessao["perfil"] }): Sessao {
  return { id: user.id, name: user.name, area: user.area, perfil: user.perfil };
}

beforeEach(async () => {
  await limparBanco();
});

describe("criarProduto", () => {
  it("admin cadastra um produto no catálogo", async () => {
    const admin = await criarUsuario("ADMIN", "GESTOR");
    logarComo(sessaoDe(admin));

    const fd = new FormData();
    fd.set("nome", "Certificado Digital e-CPF");
    fd.set("unidade", "certificado");
    fd.set("valorUnitarioPadrao", "120.00");
    fd.set("ativo", "on");
    await expect(criarProdutoAction(fd)).rejects.toBeInstanceOf(RedirectError);

    const produto = await prisma.produtoServico.findUniqueOrThrow({
      where: { nome: "Certificado Digital e-CPF" },
    });
    expect(produto.unidade).toBe("certificado");
    expect(Number(produto.valorUnitarioPadrao)).toBe(120);
    expect(produto.ativo).toBe(true);
  });

  it("gestor de Propostas não pode cadastrar (só ADMIN)", async () => {
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("nome", "Tentativa indevida");
    fd.set("unidade", "unidade");
    fd.set("valorUnitarioPadrao", "10.00");
    await criarProdutoAction(fd);

    expect(await prisma.produtoServico.count()).toBe(0);
  });

  it("rejeita nome duplicado", async () => {
    const admin = await criarUsuario("ADMIN", "GESTOR");
    await criarProduto({ nome: "Licença Office 365" });
    logarComo(sessaoDe(admin));

    const fd = new FormData();
    fd.set("nome", "Licença Office 365");
    fd.set("unidade", "licença");
    fd.set("valorUnitarioPadrao", "50.00");
    await expect(criarProdutoAction(fd)).rejects.toBeInstanceOf(RedirectError);

    expect(await prisma.produtoServico.count({ where: { nome: "Licença Office 365" } })).toBe(1);
  });
});

describe("atualizarProduto", () => {
  it("admin atualiza o preço padrão", async () => {
    const admin = await criarUsuario("ADMIN", "GESTOR");
    const produto = await criarProduto({ valorUnitarioPadrao: 4.8 });
    logarComo(sessaoDe(admin));

    const fd = new FormData();
    fd.set("id", produto.id);
    fd.set("nome", produto.nome);
    fd.set("unidade", produto.unidade);
    fd.set("valorUnitarioPadrao", "5.50");
    await expect(atualizarProduto(fd)).rejects.toBeInstanceOf(RedirectError);

    const atual = await prisma.produtoServico.findUniqueOrThrow({ where: { id: produto.id } });
    expect(Number(atual.valorUnitarioPadrao)).toBe(5.5);
  });
});

describe("alternarProdutoAtivo", () => {
  it("desativa e reativa um produto sem apagar histórico", async () => {
    const admin = await criarUsuario("ADMIN", "GESTOR");
    const produto = await criarProduto();
    logarComo(sessaoDe(admin));

    const fdOff = new FormData();
    fdOff.set("id", produto.id);
    fdOff.set("ativo", "0");
    await alternarProdutoAtivo(fdOff);
    expect((await prisma.produtoServico.findUniqueOrThrow({ where: { id: produto.id } })).ativo).toBe(false);

    const fdOn = new FormData();
    fdOn.set("id", produto.id);
    fdOn.set("ativo", "1");
    await alternarProdutoAtivo(fdOn);
    expect((await prisma.produtoServico.findUniqueOrThrow({ where: { id: produto.id } })).ativo).toBe(true);
  });
});

describe("excluirProduto", () => {
  it("exclui um produto sem itens de ESP vinculados", async () => {
    const admin = await criarUsuario("ADMIN", "GESTOR");
    const produto = await criarProduto();
    logarComo(sessaoDe(admin));

    const fd = new FormData();
    fd.set("id", produto.id);
    await excluirProduto(fd);

    expect(await prisma.produtoServico.count({ where: { id: produto.id } })).toBe(0);
  });

  it("não exclui produto já usado em algum item de ESP", async () => {
    const admin = await criarUsuario("ADMIN", "GESTOR");
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "EM_TRATATIVA",
      tipo: "PROPOSTA_TECNICA",
    });
    const esp = await prisma.esp.create({
      data: { opportunityId: proposta.id, tipo: "ITOI", numero: "E0260099" },
    });
    const produto = await criarProduto();
    await prisma.espItem.create({
      data: { espId: esp.id, produtoId: produto.id, quantidadeMensal: 1, periodoContratualMeses: 1, valorUnitario: 1 },
    });
    logarComo(sessaoDe(admin));

    const fd = new FormData();
    fd.set("id", produto.id);
    await excluirProduto(fd);

    expect(await prisma.produtoServico.count({ where: { id: produto.id } })).toBe(1);
  });
});
