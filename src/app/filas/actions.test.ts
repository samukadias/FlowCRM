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
const { gerarAtestacao, atualizarMedicao } = await import("./actions");

function logarComo(sessao: Sessao) {
  vi.mocked(obterSessao).mockResolvedValue(sessao);
}

function sessaoDe(user: { id: string; name: string; area: Sessao["area"]; perfil: Sessao["perfil"] }): Sessao {
  return { id: user.id, name: user.name, area: user.area, perfil: user.perfil };
}

/** Contrato de uma proposta técnica com uma ESP pronta contendo um item. */
async function contratoComItem(params: { quantidadeMensal?: number; valorUnitario?: number } = {}) {
  const comercial = await criarUsuario("COMERCIAL", "GESTOR");
  const cliente = await criarCliente();
  const proposta = await criarProposta({
    clienteId: cliente.id,
    criadoPorId: comercial.id,
    stage: "ACEITA",
    tipo: "PROPOSTA_TECNICA",
    valorEstimado: 120_000,
  });
  const esp = await prisma.esp.create({
    data: { opportunityId: proposta.id, tipo: "ITOI", numero: `E026${Math.floor(Math.random() * 9000 + 1000)}`, pronta: true },
  });
  const produto = await criarProduto({
    valorUnitarioPadrao: params.valorUnitario ?? 4.8,
    unidade: "GB",
  });
  const item = await prisma.espItem.create({
    data: {
      espId: esp.id,
      produtoId: produto.id,
      quantidadeMensal: params.quantidadeMensal ?? 20,
      periodoContratualMeses: 12,
      valorUnitario: params.valorUnitario ?? 4.8,
    },
  });
  const contrato = await prisma.contract.create({
    data: {
      opportunityId: proposta.id,
      numero: `CTR-TESTE-${Math.floor(Math.random() * 900000)}`,
      inicioVigencia: new Date(),
      valor: 120_000,
    },
  });
  return { contrato, item, proposta };
}

beforeEach(async () => {
  await limparBanco();
});

describe("gerarAtestacao", () => {
  it("com itens de ESP, o valor nasce da soma quantidade × valor unitário e gera uma medição por item", async () => {
    const gestor = await criarUsuario("FATURAMENTO", "GESTOR");
    const { contrato, item } = await contratoComItem({ quantidadeMensal: 20, valorUnitario: 4.8 });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("contractId", contrato.id);
    await gerarAtestacao(fd);

    const atestacao = await prisma.attestation.findFirstOrThrow({
      where: { contractId: contrato.id },
      include: { medicoes: true },
    });
    expect(Number(atestacao.valor)).toBe(96); // 20 × 4,80
    expect(atestacao.medicoes).toHaveLength(1);
    expect(atestacao.medicoes[0].espItemId).toBe(item.id);
    expect(Number(atestacao.medicoes[0].quantidade)).toBe(20);
  });

  it("sem itens de ESP, mantém o cálculo antigo (valor do contrato ÷ 12)", async () => {
    const gestor = await criarUsuario("FATURAMENTO", "GESTOR");
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ACEITA",
      tipo: "ORCAMENTO_ORIENTATIVO",
    });
    const contrato = await prisma.contract.create({
      data: {
        opportunityId: proposta.id,
        numero: "CTR-TESTE-SEMITEM",
        inicioVigencia: new Date(),
        valor: 120_000,
      },
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("contractId", contrato.id);
    await gerarAtestacao(fd);

    const atestacao = await prisma.attestation.findFirstOrThrow({
      where: { contractId: contrato.id },
      include: { medicoes: true },
    });
    expect(Number(atestacao.valor)).toBe(10_000); // 120.000 / 12
    expect(atestacao.medicoes).toHaveLength(0);
  });

  it("não duplica atestação já existente na competência", async () => {
    const gestor = await criarUsuario("FATURAMENTO", "GESTOR");
    const { contrato } = await contratoComItem();
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("contractId", contrato.id);
    await gerarAtestacao(fd);
    await gerarAtestacao(fd);

    expect(await prisma.attestation.count({ where: { contractId: contrato.id } })).toBe(1);
  });

  it("analista de Faturamento não pode gerar (só o gestor)", async () => {
    const analista = await criarUsuario("FATURAMENTO", "ANALISTA");
    const { contrato } = await contratoComItem();
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("contractId", contrato.id);
    await gerarAtestacao(fd);

    expect(await prisma.attestation.count({ where: { contractId: contrato.id } })).toBe(0);
  });
});

describe("atualizarMedicao", () => {
  it("responsável ajusta a quantidade consumida e o valor da atestação é recalculado", async () => {
    const gestor = await criarUsuario("FATURAMENTO", "GESTOR");
    const analista = await criarUsuario("FATURAMENTO", "ANALISTA");
    const { contrato } = await contratoComItem({ quantidadeMensal: 20, valorUnitario: 4.8 });
    logarComo(sessaoDe(gestor));
    const fdGerar = new FormData();
    fdGerar.set("contractId", contrato.id);
    await gerarAtestacao(fdGerar);

    const atestacao = await prisma.attestation.findFirstOrThrow({
      where: { contractId: contrato.id },
      include: { medicoes: true },
    });
    await prisma.attestation.update({ where: { id: atestacao.id }, data: { responsavelId: analista.id } });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("id", atestacao.medicoes[0].id);
    fd.set("attestationId", atestacao.id);
    fd.set("quantidade", "25"); // consumiu mais que o contratado
    await atualizarMedicao(fd);

    const medicaoAtual = await prisma.medicao.findUniqueOrThrow({ where: { id: atestacao.medicoes[0].id } });
    expect(Number(medicaoAtual.quantidade)).toBe(25);
    const atestacaoAtual = await prisma.attestation.findUniqueOrThrow({ where: { id: atestacao.id } });
    expect(Number(atestacaoAtual.valor)).toBe(120); // 25 × 4,80
  });

  it("não permite ajustar depois de faturada", async () => {
    const gestor = await criarUsuario("FATURAMENTO", "GESTOR");
    const { contrato } = await contratoComItem();
    logarComo(sessaoDe(gestor));
    const fdGerar = new FormData();
    fdGerar.set("contractId", contrato.id);
    await gerarAtestacao(fdGerar);

    const atestacao = await prisma.attestation.findFirstOrThrow({
      where: { contractId: contrato.id },
      include: { medicoes: true },
    });
    await prisma.attestation.update({ where: { id: atestacao.id }, data: { status: "FATURADA" } });

    const fd = new FormData();
    fd.set("id", atestacao.medicoes[0].id);
    fd.set("attestationId", atestacao.id);
    fd.set("quantidade", "99");
    await atualizarMedicao(fd);

    const medicaoAtual = await prisma.medicao.findUniqueOrThrow({ where: { id: atestacao.medicoes[0].id } });
    expect(Number(medicaoAtual.quantidade)).not.toBe(99);
  });

  it("analista que não é o responsável não pode ajustar", async () => {
    const gestor = await criarUsuario("FATURAMENTO", "GESTOR");
    const outroAnalista = await criarUsuario("FATURAMENTO", "ANALISTA");
    const { contrato } = await contratoComItem();
    logarComo(sessaoDe(gestor));
    const fdGerar = new FormData();
    fdGerar.set("contractId", contrato.id);
    await gerarAtestacao(fdGerar);

    const atestacao = await prisma.attestation.findFirstOrThrow({
      where: { contractId: contrato.id },
      include: { medicoes: true },
    });
    logarComo(sessaoDe(outroAnalista));

    const fd = new FormData();
    fd.set("id", atestacao.medicoes[0].id);
    fd.set("attestationId", atestacao.id);
    fd.set("quantidade", "99");
    await atualizarMedicao(fd);

    const medicaoAtual = await prisma.medicao.findUniqueOrThrow({ where: { id: atestacao.medicoes[0].id } });
    expect(Number(medicaoAtual.quantidade)).not.toBe(99);
  });
});
