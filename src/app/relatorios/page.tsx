import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { MotivoPerda, Stage } from "@/generated/prisma/enums";
import { MOTIVO_PERDA_LABELS, STAGE_META } from "@/lib/flow";
import { brl, brlCompacto } from "@/lib/format";
import { obterSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Relatórios — PropostaFlow" };

/** Etapas do caminho feliz, na ordem do funil. */
const FUNIL: Stage[] = [
  "ENTRADA",
  "EM_TRATATIVA",
  "EM_VERIFICACAO",
  "PROPOSTA_PRONTA",
  "ENVIADA_CLIENTE",
  "ACEITA",
];

/** Períodos disponíveis: filtram propostas pela data de entrada. */
const PERIODOS: { slug: string; rotulo: string; inicio: () => Date | null }[] = [
  { slug: "tudo", rotulo: "Tudo", inicio: () => null },
  {
    slug: "mes",
    rotulo: "Este mês",
    inicio: () => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    },
  },
  {
    slug: "30d",
    rotulo: "Últimos 30 dias",
    inicio: () => new Date(Date.now() - 30 * 86_400_000),
  },
  {
    slug: "90d",
    rotulo: "Últimos 90 dias",
    inicio: () => new Date(Date.now() - 90 * 86_400_000),
  },
  {
    slug: "ano",
    rotulo: "Este ano",
    inicio: () => new Date(new Date().getFullYear(), 0, 1),
  },
];

/** Etapas em que medimos permanência (todas as não terminais). */
const ETAPAS_TEMPO: Stage[] = [
  "ENTRADA",
  "EM_TRATATIVA",
  "EM_VERIFICACAO",
  "AJUSTES",
  "PROPOSTA_PRONTA",
  "ENVIADA_CLIENTE",
];

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function Barras({ dados }: { dados: { rotulo: string; valor: number; texto: string }[] }) {
  const max = Math.max(...dados.map((d) => d.valor), 1);
  return (
    <ul className="mt-4 space-y-2.5">
      {dados.map((d) => (
        <li
          key={d.rotulo}
          className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[150px_1fr]"
        >
          <span className="truncate text-sm text-muted">{d.rotulo}</span>
          <div className="flex items-center gap-2.5 border-l border-line pl-px">
            <div
              className="h-5 rounded-r bg-brand"
              style={{ width: `${(d.valor / max) * 100}%`, minWidth: d.valor > 0 ? 3 : 0 }}
            />
            <span className="text-xs font-medium whitespace-nowrap tabular-nums">
              {d.texto}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function Relatorios({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  // Relatórios são visão gerencial: apenas gestores (ADMIN conta como gestor)
  const sessao = await obterSessao();
  if (!sessao || (sessao.perfil !== "GESTOR" && sessao.area !== "ADMIN")) {
    redirect("/");
  }

  const { periodo } = await searchParams;
  const escolhido = PERIODOS.find((p) => p.slug === periodo) ?? PERIODOS[0];
  const inicio = escolhido.inicio();

  // O recorte é a coorte de entrada: propostas registradas no período
  const filtroProposta = inicio ? { createdAt: { gte: inicio } } : {};
  const [opps, eventos, contratos, atestacoes] = await Promise.all([
    prisma.opportunity.findMany({
      where: filtroProposta,
      select: { id: true, stage: true, valorEstimado: true, motivoPerda: true },
    }),
    prisma.workflowEvent.findMany({
      where: inicio ? { opportunity: filtroProposta } : {},
      select: { opportunityId: true, deStage: true, paraStage: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contract.findMany({
      where: inicio ? { opportunity: filtroProposta } : {},
      select: { valor: true },
    }),
    prisma.attestation.findMany({
      where: inicio ? { contract: { opportunity: filtroProposta } } : {},
      select: { status: true, valor: true },
    }),
  ]);

  // KPIs
  const aceitas = opps.filter((o) => o.stage === "ACEITA").length;
  const recusadas = opps.filter((o) => o.stage === "RECUSADA").length;
  const canceladas = opps.filter((o) => o.stage === "CANCELADA").length;
  const decididas = aceitas + recusadas;
  const taxaAceite = decididas > 0 ? Math.round((aceitas / decididas) * 100) : null;

  // Motivos de perda: recusa (cliente disse não) + cancelamento (decidimos não seguir)
  const perdidas = recusadas + canceladas;
  const porMotivo = (Object.keys(MOTIVO_PERDA_LABELS) as MotivoPerda[])
    .map((motivo) => ({
      motivo,
      qtd: opps.filter((o) => o.motivoPerda === motivo).length,
    }))
    .filter((m) => m.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);

  const emAndamento = opps.filter((o) => !STAGE_META[o.stage].terminal);
  const valorAndamento = emAndamento.reduce((s, o) => s + Number(o.valorEstimado ?? 0), 0);
  const valorPonderado = emAndamento.reduce(
    (s, o) => s + (Number(o.valorEstimado ?? 0) * STAGE_META[o.stage].probabilidade) / 100,
    0,
  );
  const ponderadoPorEtapa = FUNIL.filter((e) => !STAGE_META[e].terminal).map((etapa) => ({
    etapa,
    valor: emAndamento
      .filter((o) => o.stage === etapa)
      .reduce((s, o) => s + (Number(o.valorEstimado ?? 0) * STAGE_META[etapa].probabilidade) / 100, 0),
  }));
  const valorContratado = contratos.reduce((s, c) => s + Number(c.valor), 0);
  const faturado = atestacoes
    .filter((a) => a.status === "FATURADA")
    .reduce((s, a) => s + Number(a.valor), 0);
  const aFaturar = atestacoes
    .filter((a) => ["PENDENTE", "CONFIRMADA_CLIENTE", "ATESTADA"].includes(a.status))
    .reduce((s, a) => s + Number(a.valor), 0);

  // Funil: quantas propostas já alcançaram cada etapa do caminho feliz
  const alcance = FUNIL.map((etapa) => {
    const ids = new Set(
      eventos.filter((e) => e.paraStage === etapa).map((e) => e.opportunityId),
    );
    return { etapa, qtd: ids.size };
  });
  const base = alcance[0]?.qtd ?? 0;

  // Tempo médio de permanência por etapa (intervalos já encerrados)
  const somas = new Map<Stage, { ms: number; n: number }>();
  const porProposta = new Map<string, typeof eventos>();
  for (const e of eventos) {
    const lista = porProposta.get(e.opportunityId) ?? [];
    lista.push(e);
    porProposta.set(e.opportunityId, lista);
  }
  for (const lista of porProposta.values()) {
    for (let i = 1; i < lista.length; i++) {
      const etapa = lista[i - 1].paraStage;
      if (!etapa) continue;
      const ms = lista[i].createdAt.getTime() - lista[i - 1].createdAt.getTime();
      const atual = somas.get(etapa) ?? { ms: 0, n: 0 };
      somas.set(etapa, { ms: atual.ms + ms, n: atual.n + 1 });
    }
  }
  const tempos = ETAPAS_TEMPO.map((etapa) => {
    const s = somas.get(etapa);
    const dias = s && s.n > 0 ? s.ms / s.n / 86_400_000 : 0;
    return { etapa, dias, n: s?.n ?? 0 };
  }).filter((t) => t.n > 0);

  const fmtDias = (d: number) =>
    d < 0.5
      ? "menos de 1 dia"
      : `${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${d < 1.05 ? "dia" : "dias"}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
      <p className="mt-1 text-sm text-muted">
        {inicio
          ? `${opps.length} proposta${opps.length === 1 ? "" : "s"} registrada${opps.length === 1 ? "" : "s"} no período: funil, tempos e valores referem-se a esse recorte.`
          : "Visão geral do funil, dos tempos e dos valores, com base em toda a história registrada no fluxo."}
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {PERIODOS.map((p) => (
          <Link
            key={p.slug}
            href={p.slug === "tudo" ? "/relatorios" : `/relatorios?periodo=${p.slug}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
              p.slug === escolhido.slug
                ? "border-brand-strong bg-brand-strong text-white shadow-sm"
                : "border-line bg-card text-muted shadow-sm hover:border-faint hover:text-ink"
            }`}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Taxa de aceite"
          value={taxaAceite != null ? `${taxaAceite}%` : "—"}
          detail={
            decididas > 0
              ? `${aceitas} aceita${aceitas === 1 ? "" : "s"} de ${decididas} decididas`
              : "nenhuma proposta decidida ainda"
          }
        />
        <StatTile
          label="Em andamento"
          value={brlCompacto.format(valorAndamento)}
          detail={`${emAndamento.length} proposta${emAndamento.length === 1 ? "" : "s"} no funil`}
        />
        <StatTile
          label="Pipeline ponderado"
          value={brlCompacto.format(valorPonderado)}
          detail="valor × probabilidade por etapa"
        />
        <StatTile
          label="Contratado"
          value={brlCompacto.format(valorContratado)}
          detail={
            contratos.length === 1
              ? "1 contrato ativo"
              : `${contratos.length} contratos ativos`
          }
        />
        <StatTile
          label="Faturado"
          value={faturado === 0 ? "R$ 0" : brlCompacto.format(faturado)}
          detail={`${brlCompacto.format(aFaturar)} em atestações abertas`}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-sm font-semibold">Funil de propostas</h2>
          <p className="mt-0.5 text-xs text-muted">
            Quantas propostas já alcançaram cada etapa do caminho
          </p>
          <Barras
            dados={alcance.map((a) => ({
              rotulo: STAGE_META[a.etapa].label,
              valor: a.qtd,
              texto:
                base > 0 && a.etapa !== "ENTRADA"
                  ? `${a.qtd} · ${Math.round((a.qtd / base) * 100)}%`
                  : `${a.qtd}`,
            }))}
          />
        </section>

        <section className="card p-6">
          <h2 className="text-sm font-semibold">Tempo médio por etapa</h2>
          <p className="mt-0.5 text-xs text-muted">
            Permanência média até a proposta seguir adiante
          </p>
          {tempos.length > 0 ? (
            <Barras
              dados={tempos.map((t) => ({
                rotulo: STAGE_META[t.etapa].label,
                valor: t.dias,
                texto: fmtDias(t.dias),
              }))}
            />
          ) : (
            <p className="mt-4 text-sm text-muted">
              Ainda não há movimentações suficientes para medir.
            </p>
          )}
        </section>
      </div>

      <section className="card mt-10 p-6">
        <h2 className="text-sm font-semibold">Pipeline ponderado por etapa</h2>
        <p className="mt-0.5 text-xs text-muted">
          Valor estimado de cada etapa, ajustado pela probabilidade padrão de fechamento
        </p>
        {valorPonderado > 0 ? (
          <Barras
            dados={ponderadoPorEtapa
              .filter((p) => p.valor > 0)
              .map((p) => ({
                rotulo: `${STAGE_META[p.etapa].label} (${STAGE_META[p.etapa].probabilidade}%)`,
                valor: p.valor,
                texto: brlCompacto.format(p.valor),
              }))}
          />
        ) : (
          <p className="mt-4 text-sm text-muted">Nenhuma proposta em andamento no período.</p>
        )}
      </section>

      <section className="card mt-10 p-6">
        <h2 className="text-sm font-semibold">Motivos de perda</h2>
        <p className="mt-0.5 text-xs text-muted">
          {perdidas > 0
            ? `${perdidas} proposta${perdidas === 1 ? "" : "s"} recusada${perdidas === 1 ? "" : "s"} ou cancelada${perdidas === 1 ? "" : "s"} no período`
            : "Nenhuma proposta recusada ou cancelada no período"}
        </p>
        {porMotivo.length > 0 ? (
          <Barras
            dados={porMotivo.map((m) => ({
              rotulo: MOTIVO_PERDA_LABELS[m.motivo],
              valor: m.qtd,
              texto: `${m.qtd} · ${Math.round((m.qtd / perdidas) * 100)}%`,
            }))}
          />
        ) : (
          <p className="mt-4 text-sm text-muted">
            {perdidas > 0
              ? "As perdas registradas antes do motivo passar a ser obrigatório não têm essa informação."
              : "Nada a mostrar por aqui — bom sinal."}
          </p>
        )}
      </section>

      <p className="mt-6 text-xs text-faint">
        Valores em andamento: {brl.format(valorAndamento)} · ponderado:{" "}
        {brl.format(valorPonderado)} · contratado: {brl.format(valorContratado)} · faturado:{" "}
        {brl.format(faturado)}.
      </p>
    </div>
  );
}
