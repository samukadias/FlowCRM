import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { limparBanco } from "@/test/db";
import { criarCliente, criarProposta, criarUsuario } from "@/test/factories";
import { RedirectError } from "@/test/next-mocks";
import type { Sessao } from "@/lib/auth-core";

// Server Actions dependem de APIs exclusivas do runtime do Next.js
// (cookies, redirect, cache) que não existem fora de uma requisição real.
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
const { criarProposta: criarPropostaAction, moverProposta, delegarProposta, registrarNota, registrarEmail } =
  await import("./actions");

function logarComo(sessao: Sessao) {
  vi.mocked(obterSessao).mockResolvedValue(sessao);
}

function sessaoDe(user: { id: string; name: string; area: Sessao["area"]; perfil: Sessao["perfil"] }): Sessao {
  return { id: user.id, name: user.name, area: user.area, perfil: user.perfil };
}

beforeEach(async () => {
  await limparBanco();
  vi.mocked(obterSessao).mockReset();
});

describe("criarProposta", () => {
  it("nega quando quem chama não é do Comercial", async () => {
    const analistaPropostas = await criarUsuario("PROPOSTAS", "GESTOR");
    logarComo(sessaoDe(analistaPropostas));
    const cliente = await criarCliente();

    const fd = new FormData();
    fd.set("clienteId", cliente.id);
    fd.set("titulo", "Tentativa indevida");

    await criarPropostaAction(fd);

    expect(await prisma.opportunity.count()).toBe(0);
  });

  it("comercial cria a proposta na etapa Entrada, com evento inicial e notificação para Propostas", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const gestorPropostas = await criarUsuario("PROPOSTAS", "GESTOR");
    const cliente = await criarCliente();
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("clienteId", cliente.id);
    fd.set("titulo", "Migração para nuvem");
    fd.set("valor", "50000");

    await expect(criarPropostaAction(fd)).rejects.toBeInstanceOf(RedirectError);

    const proposta = await prisma.opportunity.findFirstOrThrow({
      include: { eventos: true },
    });
    expect(proposta.stage).toBe("ENTRADA");
    expect(proposta.clienteId).toBe(cliente.id);
    expect(proposta.criadoPorId).toBe(comercial.id);
    expect(proposta.eventos).toHaveLength(1);
    expect(proposta.eventos[0].paraStage).toBe("ENTRADA");

    const notificacoes = await prisma.notification.findMany({
      where: { userId: gestorPropostas.id },
    });
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0].titulo).toContain(proposta.codigo);
  });

  it("gera códigos sequenciais por ano (OPP-AAAA-NNNN)", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    logarComo(sessaoDe(comercial));

    for (const titulo of ["Primeira", "Segunda"]) {
      const fd = new FormData();
      fd.set("clienteId", cliente.id);
      fd.set("titulo", titulo);
      await expect(criarPropostaAction(fd)).rejects.toBeInstanceOf(RedirectError);
    }

    const propostas = await prisma.opportunity.findMany({ orderBy: { codigo: "asc" } });
    expect(propostas).toHaveLength(2);
    const ano = new Date().getFullYear();
    const [seq1, seq2] = propostas.map((p) => Number(p.codigo.split("-").pop()));
    expect(propostas[0].codigo).toMatch(new RegExp(`^OPP-${ano}-\\d{4}$`));
    expect(seq2).toBe(seq1 + 1);
  });
});

describe("moverProposta", () => {
  async function cenarioBase() {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    return { comercial, cliente };
  }

  it("ignora transição não prevista na etapa atual", async () => {
    const { comercial, cliente } = await cenarioBase();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    const gestorPropostas = await criarUsuario("PROPOSTAS", "GESTOR");
    logarComo(sessaoDe(gestorPropostas));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "ACEITA"); // não existe transição direta de ENTRADA para ACEITA
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("ENTRADA");
  });

  it("analista que não é o responsável não consegue mover", async () => {
    const { comercial, cliente } = await cenarioBase();
    const responsavel = await criarUsuario("PROPOSTAS", "ANALISTA");
    const outroAnalista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
      responsavelId: responsavel.id,
    });
    logarComo(sessaoDe(outroAnalista));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "EM_TRATATIVA");
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("ENTRADA");
  });

  it("analista responsável consegue mover o próprio item", async () => {
    const { comercial, cliente } = await cenarioBase();
    const responsavel = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
      responsavelId: responsavel.id,
    });
    logarComo(sessaoDe(responsavel));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "EM_TRATATIVA");
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("EM_TRATATIVA");
  });

  it("gestor da área move qualquer item, mesmo delegado a outra pessoa", async () => {
    const { comercial, cliente } = await cenarioBase();
    const analistaDono = await criarUsuario("PROPOSTAS", "ANALISTA");
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
      responsavelId: analistaDono.id,
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "EM_TRATATIVA");
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("EM_TRATATIVA");
  });

  it("mantém o responsável quando a etapa muda mas a área dona continua a mesma", async () => {
    // ENTRADA e EM_TRATATIVA são ambas donas de PROPOSTAS — não deve zerar
    const { comercial, cliente } = await cenarioBase();
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
      responsavelId: analista.id,
    });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "EM_TRATATIVA");
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.responsavelId).toBe(analista.id);
  });

  it("zera o responsável quando a proposta muda de área e avisa os gestores da área nova", async () => {
    const { comercial, cliente } = await cenarioBase();
    const analistaPropostas = await criarUsuario("PROPOSTAS", "ANALISTA");
    const gestorDelivery = await criarUsuario("DELIVERY", "GESTOR");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "EM_TRATATIVA",
      responsavelId: analistaPropostas.id,
    });
    logarComo(sessaoDe(analistaPropostas));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "EM_VERIFICACAO"); // PROPOSTAS → DELIVERY
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("EM_VERIFICACAO");
    expect(atual.responsavelId).toBeNull();

    const notificacoes = await prisma.notification.findMany({
      where: { userId: gestorDelivery.id },
    });
    expect(notificacoes).toHaveLength(1);
  });

  it("aceite gera o contrato automaticamente e notifica Contratos e Faturamento", async () => {
    const { comercial, cliente } = await cenarioBase();
    const gestorContratos = await criarUsuario("CONTRATOS", "GESTOR");
    const gestorFaturamento = await criarUsuario("FATURAMENTO", "GESTOR");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENVIADA_CLIENTE",
      valorEstimado: 240_000,
    });
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "ACEITA");
    await moverProposta(fd);

    const contrato = await prisma.contract.findUniqueOrThrow({
      where: { opportunityId: proposta.id },
    });
    expect(Number(contrato.valor)).toBe(240_000);
    expect(contrato.health).toBe("SAUDAVEL");
    expect(contrato.numero).toMatch(/^CTR-\d{4}-\d{4}$/);

    expect(await prisma.notification.count({ where: { userId: gestorContratos.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: gestorFaturamento.id } })).toBe(1);
  });

  it("recusa não gera contrato", async () => {
    const { comercial, cliente } = await cenarioBase();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENVIADA_CLIENTE",
    });
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "RECUSADA");
    fd.set("motivoPerda", "PRECO");
    await moverProposta(fd);

    expect(await prisma.contract.count()).toBe(0);
  });

  it("recusar sem selecionar motivo é barrado e não muda a etapa", async () => {
    const { comercial, cliente } = await cenarioBase();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENVIADA_CLIENTE",
    });
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "RECUSADA");
    await expect(moverProposta(fd)).rejects.toBeInstanceOf(RedirectError);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("ENVIADA_CLIENTE");
    expect(atual.motivoPerda).toBeNull();
  });

  it("recusa com motivo válido grava o motivo na proposta", async () => {
    const { comercial, cliente } = await cenarioBase();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENVIADA_CLIENTE",
    });
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "RECUSADA");
    fd.set("motivoPerda", "CONCORRENCIA");
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("RECUSADA");
    expect(atual.motivoPerda).toBe("CONCORRENCIA");
  });

  it("cancelamento também exige motivo", async () => {
    const { comercial, cliente } = await cenarioBase();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("para", "CANCELADA");
    fd.set("motivoPerda", "MUDANCA_PRIORIDADE");
    await moverProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.stage).toBe("CANCELADA");
    expect(atual.motivoPerda).toBe("MUDANCA_PRIORIDADE");
  });
});

describe("delegarProposta", () => {
  it("analista não pode delegar (só gestor da área dona da fila)", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const destino = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    logarComo(sessaoDe(analista));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("userId", destino.id);
    await delegarProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.responsavelId).toBeNull();
  });

  it("rejeita delegar para usuário de outra área", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const usuarioErrado = await criarUsuario("DELIVERY", "ANALISTA");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("userId", usuarioErrado.id);
    await delegarProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.responsavelId).toBeNull();
  });

  it("rejeita delegar para usuário desativado", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const desativado = await criarUsuario("PROPOSTAS", "ANALISTA", { ativo: false });
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("userId", desativado.id);
    await delegarProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.responsavelId).toBeNull();
  });

  it("gestor delega com sucesso e o analista recebe notificação", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const gestor = await criarUsuario("PROPOSTAS", "GESTOR");
    const analista = await criarUsuario("PROPOSTAS", "ANALISTA");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    logarComo(sessaoDe(gestor));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("userId", analista.id);
    await delegarProposta(fd);

    const atual = await prisma.opportunity.findUniqueOrThrow({ where: { id: proposta.id } });
    expect(atual.responsavelId).toBe(analista.id);

    const notificacoes = await prisma.notification.findMany({
      where: { userId: analista.id },
    });
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0].titulo).toContain("delegada para você");
  });
});

describe("registrarNota / registrarEmail — exigem visibilidade sobre a proposta", () => {
  it("usuário sem nenhum envolvimento na proposta é barrado (redireciona)", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const analistaSemAcesso = await criarUsuario("FATURAMENTO", "ANALISTA");
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    logarComo(sessaoDe(analistaSemAcesso));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("content", "Nota que não deveria ser criada");
    await expect(registrarNota(fd)).rejects.toBeInstanceOf(RedirectError);

    expect(await prisma.workflowEvent.count({ where: { eventType: "NOTE" } })).toBe(0);
  });

  it("quem criou a proposta pode registrar nota, mesmo fora da área dona da fila atual", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "EM_VERIFICACAO", // agora é fila do Delivery, mas o Comercial criou
    });
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("content", "Cliente perguntou sobre o prazo");
    await expect(registrarNota(fd)).rejects.toBeInstanceOf(RedirectError);

    const evento = await prisma.workflowEvent.findFirstOrThrow({
      where: { eventType: "NOTE" },
    });
    expect(evento.content).toBe("Cliente perguntou sobre o prazo");
    expect(evento.userId).toBe(comercial.id);
  });

  it("registra e-mail com assunto e conteúdo", async () => {
    const comercial = await criarUsuario("COMERCIAL", "GESTOR");
    const cliente = await criarCliente();
    const proposta = await criarProposta({
      clienteId: cliente.id,
      criadoPorId: comercial.id,
      stage: "ENTRADA",
    });
    logarComo(sessaoDe(comercial));

    const fd = new FormData();
    fd.set("id", proposta.id);
    fd.set("subject", "Envio da proposta");
    fd.set("content", "Segue em anexo.");
    await expect(registrarEmail(fd)).rejects.toBeInstanceOf(RedirectError);

    const evento = await prisma.workflowEvent.findFirstOrThrow({
      where: { eventType: "EMAIL" },
    });
    expect(evento.subject).toBe("Envio da proposta");
    expect(evento.content).toBe("Segue em anexo.");
  });
});
