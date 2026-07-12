// Popula o banco com dados de exemplo para desenvolvimento
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.attestation.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.workflowEvent.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  // Clientes (cadastro mantido pelo admin/gestor de Propostas)
  const clientesSeed: [string, string][] = [
    ["TechNova S.A.", "TECHNOVA"],
    ["Banco Meridional", "BMERID"],
    ["Varejo Max", "VMAX"],
    ["Hospital Vida Plena", "HVP"],
    ["AgroForte Ltda", "AGROFORTE"],
    ["LogisTrans", "LOGIS"],
    ["EducaMais", "EDUCA"],
    ["Construtora Alicerce", "ALICERCE"],
  ];
  const clientePorNome = new Map<string, string>();
  for (const [nome, sigla] of clientesSeed) {
    const c = await prisma.cliente.create({ data: { nome, sigla } });
    clientePorNome.set(nome, c.id);
  }

  // Senha padrão de desenvolvimento para todos os usuários: "propostaflow"
  const passwordHash = await bcrypt.hash("propostaflow", 10);
  // Gestores delegam e veem toda a equipe; analistas veem só o que lhes foi delegado
  const [ana, bruno, carla, diego, elisa] = await Promise.all([
    prisma.user.create({ data: { name: "Ana Souza", email: "ana@empresa.com", area: "COMERCIAL", perfil: "GESTOR", passwordHash } }),
    prisma.user.create({ data: { name: "Bruno Lima", email: "bruno@empresa.com", area: "PROPOSTAS", perfil: "GESTOR", passwordHash } }),
    prisma.user.create({ data: { name: "Carla Mendes", email: "carla@empresa.com", area: "DELIVERY", perfil: "GESTOR", passwordHash } }),
    prisma.user.create({ data: { name: "Diego Rocha", email: "diego@empresa.com", area: "CONTRATOS", perfil: "GESTOR", passwordHash } }),
    prisma.user.create({ data: { name: "Elisa Prado", email: "elisa@empresa.com", area: "FATURAMENTO", perfil: "GESTOR", passwordHash } }),
    prisma.user.create({ data: { name: "Administração", email: "admin@empresa.com", area: "ADMIN", perfil: "GESTOR", passwordHash } }),
    prisma.user.create({ data: { name: "Paulo Reis", email: "paulo@empresa.com", area: "PROPOSTAS", perfil: "ANALISTA", passwordHash } }),
    prisma.user.create({ data: { name: "Renata Dias", email: "renata@empresa.com", area: "FATURAMENTO", perfil: "ANALISTA", passwordHash } }),
  ]);

  type Passo = { para: string; user: string; obs?: string; diasAtras: number };

  // Jornadas de exemplo — cada oportunidade em um ponto diferente do fluxo
  const oportunidades: {
    codigo: string; cliente: string; titulo: string; valor: number; passos: Passo[];
  }[] = [
    {
      codigo: "OPP-2026-0001", cliente: "TechNova S.A.", titulo: "Migração de datacenter para nuvem",
      valor: 850000,
      passos: [
        { para: "ENTRADA", user: ana.id, obs: "Cliente solicitou proposta via RFP", diasAtras: 30 },
        { para: "EM_TRATATIVA", user: bruno.id, diasAtras: 28 },
        { para: "EM_VERIFICACAO", user: bruno.id, obs: "Escopo técnico fechado", diasAtras: 20 },
        { para: "PROPOSTA_PRONTA", user: carla.id, obs: "Validado sem ressalvas", diasAtras: 15 },
        { para: "ENVIADA_CLIENTE", user: ana.id, diasAtras: 12 },
        { para: "ACEITA", user: ana.id, obs: "Contrato assinado", diasAtras: 5 },
      ],
    },
    {
      codigo: "OPP-2026-0002", cliente: "Banco Meridional", titulo: "Sustentação de sistemas legados",
      valor: 1200000,
      passos: [
        { para: "ENTRADA", user: ana.id, diasAtras: 18 },
        { para: "EM_TRATATIVA", user: bruno.id, diasAtras: 16 },
        { para: "EM_VERIFICACAO", user: bruno.id, diasAtras: 8 },
        { para: "AJUSTES", user: carla.id, obs: "Rever dimensionamento da equipe N2", diasAtras: 4 },
        { para: "EM_TRATATIVA", user: bruno.id, obs: "Ajustando conforme apontamentos", diasAtras: 2 },
      ],
    },
    {
      codigo: "OPP-2026-0003", cliente: "Varejo Max", titulo: "Implantação de e-commerce B2B",
      valor: 430000,
      passos: [
        { para: "ENTRADA", user: ana.id, diasAtras: 10 },
        { para: "EM_TRATATIVA", user: bruno.id, diasAtras: 7 },
      ],
    },
    {
      codigo: "OPP-2026-0004", cliente: "Hospital Vida Plena", titulo: "Outsourcing de service desk 24x7",
      valor: 96000,
      passos: [
        { para: "ENTRADA", user: ana.id, obs: "Indicação de parceiro", diasAtras: 3 },
      ],
    },
    {
      codigo: "OPP-2026-0005", cliente: "AgroForte Ltda", titulo: "BI e analytics de safra",
      valor: 275000,
      passos: [
        { para: "ENTRADA", user: ana.id, diasAtras: 45 },
        { para: "EM_TRATATIVA", user: bruno.id, diasAtras: 42 },
        { para: "EM_VERIFICACAO", user: bruno.id, diasAtras: 35 },
        { para: "PROPOSTA_PRONTA", user: carla.id, diasAtras: 30 },
        { para: "ENVIADA_CLIENTE", user: ana.id, diasAtras: 25 },
        { para: "RECUSADA", user: ana.id, obs: "Cliente optou por concorrente", diasAtras: 15 },
      ],
    },
    {
      codigo: "OPP-2026-0006", cliente: "LogisTrans", titulo: "Torre de controle logística",
      valor: 640000,
      passos: [
        { para: "ENTRADA", user: ana.id, diasAtras: 22 },
        { para: "EM_TRATATIVA", user: bruno.id, diasAtras: 20 },
        { para: "EM_VERIFICACAO", user: bruno.id, diasAtras: 12 },
        { para: "PROPOSTA_PRONTA", user: carla.id, obs: "Aprovada com ressalva de prazo", diasAtras: 6 },
      ],
    },
    {
      codigo: "OPP-2026-0007", cliente: "EducaMais", titulo: "Plataforma EAD corporativa",
      valor: 310000,
      passos: [
        { para: "ENTRADA", user: ana.id, diasAtras: 60 },
        { para: "EM_TRATATIVA", user: bruno.id, diasAtras: 58 },
        { para: "EM_VERIFICACAO", user: bruno.id, diasAtras: 50 },
        { para: "PROPOSTA_PRONTA", user: carla.id, diasAtras: 45 },
        { para: "ENVIADA_CLIENTE", user: ana.id, diasAtras: 40 },
        { para: "ACEITA", user: ana.id, diasAtras: 35 },
      ],
    },
    {
      codigo: "OPP-2026-0008", cliente: "Construtora Alicerce", titulo: "ERP de obras",
      valor: 180000,
      passos: [
        { para: "ENTRADA", user: ana.id, diasAtras: 14 },
        { para: "EM_TRATATIVA", user: bruno.id, diasAtras: 11 },
        { para: "EM_VERIFICACAO", user: bruno.id, diasAtras: 5 },
      ],
    },
  ];

  const dias = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  for (const opp of oportunidades) {
    const ultimo = opp.passos[opp.passos.length - 1];
    const created = await prisma.opportunity.create({
      data: {
        codigo: opp.codigo,
        clienteId: clientePorNome.get(opp.cliente)!,
        titulo: opp.titulo,
        valorEstimado: opp.valor,
        stage: ultimo.para as never,
        criadoPorId: ana.id,
        createdAt: dias(opp.passos[0].diasAtras),
      },
    });
    let anterior: string | null = null;
    for (const passo of opp.passos) {
      await prisma.workflowEvent.create({
        data: {
          opportunityId: created.id,
          deStage: anterior as never,
          paraStage: passo.para as never,
          userId: passo.user,
          observacao: passo.obs,
          createdAt: dias(passo.diasAtras),
        },
      });
      anterior = passo.para;
    }
  }

  // Contratos para as oportunidades aceitas
  const aceitas = await prisma.opportunity.findMany({ where: { stage: "ACEITA" } });
  let num = 1;
  for (const opp of aceitas) {
    const contrato = await prisma.contract.create({
      data: {
        opportunityId: opp.id,
        numero: `CTR-2026-${String(num++).padStart(4, "0")}`,
        inicioVigencia: dias(30),
        fimVigencia: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
        valor: opp.valorEstimado ?? 0,
        health: num % 2 === 0 ? "SAUDAVEL" : "ATENCAO",
      },
    });
    await prisma.attestation.createMany({
      data: [
        { contractId: contrato.id, competencia: "2026-05", valor: 70000, status: "FATURADA" },
        { contractId: contrato.id, competencia: "2026-06", valor: 70000, status: "CONFIRMADA_CLIENTE" },
        { contractId: contrato.id, competencia: "2026-07", valor: 70000, status: "PENDENTE" },
      ],
    });
  }

  console.log("Seed concluído:", {
    usuarios: await prisma.user.count(),
    oportunidades: await prisma.opportunity.count(),
    eventos: await prisma.workflowEvent.count(),
    contratos: await prisma.contract.count(),
    atestacoes: await prisma.attestation.count(),
  });
}

main().finally(() => prisma.$disconnect());
