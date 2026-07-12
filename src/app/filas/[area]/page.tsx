import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Area, Stage } from "@/generated/prisma/enums";
import {
  AREA_LABELS,
  AREA_SLUGS,
  ATESTACAO_ACOES,
  ATESTACAO_META,
  FILA_TITULOS,
  HEALTH_META,
  QUEUES,
  STAGE_META,
} from "@/lib/flow";
import { brl, dataCurta } from "@/lib/format";
import {
  delegarProposta,
  delegarPropostasEmMassa,
  moverProposta,
  moverPropostasEmMassa,
} from "@/app/propostas/actions";
import { FilaSelecao, type ItemFila } from "@/components/fila-selecao";
import {
  atualizarSaude,
  delegarAtestacao,
  delegarContrato,
  gerarAtestacao,
  moverAtestacao,
} from "@/app/filas/actions";
import { Pill } from "@/components/pill";
import { ehGestor, obterSessao, podeAtuar, type Sessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Filas de trabalho — PropostaFlow" };

const btnPrimario =
  "h-8 rounded-md bg-brand-strong px-3 text-xs font-medium text-white transition-colors duration-150 hover:bg-brand";
const btnDestrutivo =
  "h-8 rounded-md border border-line px-3 text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger-soft";
const btnNeutro =
  "h-8 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink";
const seletor =
  "h-8 max-w-40 rounded-md border border-line bg-canvas px-2 text-xs outline-none focus:border-brand";

type Equipe = { id: string; name: string }[];

function FilaVazia({ mensagem }: { mensagem: string }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">
      {mensagem}
    </p>
  );
}

function Secao({
  titulo,
  qtd,
  valor,
  children,
}: {
  titulo: string;
  qtd: number;
  /** Soma de valor da seção, já formatada — omitir quando não fizer sentido. */
  valor?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-6">
      <h2 className="text-sm font-semibold">
        {titulo} <span className="ml-1 font-normal text-faint">{qtd}</span>
        {valor != null && valor > 0 && (
          <span className="ml-2 font-normal text-muted tabular-nums">
            · {brl.format(valor)}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Responsavel({ nome }: { nome: string | null }) {
  return nome ? (
    <p className="mt-1 text-xs text-muted">
      responsável: <span className="text-ink">{nome}</span>
    </p>
  ) : (
    <p className="mt-1 text-xs font-medium text-warn">sem responsável</p>
  );
}

/** Seletor de delegação: só o gestor da área vê. */
function Delegar({
  action,
  itemId,
  equipe,
  atualId,
}: {
  action: (formData: FormData) => Promise<void>;
  itemId: string;
  equipe: Equipe;
  atualId: string | null;
}) {
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={itemId} />
      <select
        name="userId"
        defaultValue={atualId ?? ""}
        aria-label="Delegar para"
        className={seletor}
      >
        <option value="">— sem responsável</option>
        {equipe.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <button type="submit" className={btnNeutro}>
        Delegar
      </button>
    </form>
  );
}

async function equipeDaArea(area: Area): Promise<Equipe> {
  return prisma.user.findMany({
    where: { area, ativo: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/* ─── Filas de propostas (Comercial, Propostas, Delivery) ─────────── */

async function FilaPropostas({ area, sessao }: { area: Area; sessao: Sessao | null }) {
  const gestor = ehGestor(sessao, area);
  // Analista da própria área vê apenas o que foi delegado a ele
  const soMinhas = !gestor && sessao?.area === area;
  const etapas = QUEUES[area] ?? [];

  const [propostas, equipe] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        stage: { in: etapas },
        ...(soMinhas ? { responsavelId: sessao!.id } : {}),
      },
      include: {
        cliente: { select: { nome: true } },
        // Só mudança de etapa conta para "há quantos dias" — uma nota ou
        // e-mail registrado não deve resetar o tempo na etapa atual.
        eventos: {
          where: { eventType: "STAGE_CHANGE" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        responsavel: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    gestor ? equipeDaArea(area) : Promise.resolve([] as Equipe),
  ]);

  if (propostas.length === 0) {
    return (
      <FilaVazia
        mensagem={
          soMinhas
            ? "Nenhuma proposta delegada a você no momento."
            : `Fila vazia — nenhuma proposta aguardando ação de ${AREA_LABELS[area]}.`
        }
      />
    );
  }

  return (
    <>
      {etapas.map((etapa) => {
        const daEtapa = propostas.filter((p) => p.stage === etapa);
        if (daEtapa.length === 0) return null;
        return (
          <Secao
            key={etapa}
            titulo={FILA_TITULOS[etapa] ?? STAGE_META[etapa].label}
            qtd={daEtapa.length}
            valor={daEtapa.reduce((s, p) => s + Number(p.valorEstimado ?? 0), 0)}
          >
            <FilaSelecao
              area={area}
              gestor={gestor}
              equipe={equipe}
              mover={moverProposta}
              delegar={delegarProposta}
              moverEmMassa={moverPropostasEmMassa}
              delegarEmMassa={delegarPropostasEmMassa}
              itens={daEtapa.map((p): ItemFila => {
                const desde = p.eventos[0]?.createdAt ?? p.updatedAt;
                return {
                  id: p.id,
                  codigo: p.codigo,
                  titulo: p.titulo,
                  clienteNome: p.cliente.nome,
                  stage: p.stage,
                  responsavelId: p.responsavelId,
                  responsavelNome: p.responsavel?.name ?? null,
                  desde: desde.toISOString(),
                  dias: Math.floor((Date.now() - desde.getTime()) / 86_400_000),
                  podeMover: podeAtuar(sessao, area, p.responsavelId),
                };
              })}
            />
          </Secao>
        );
      })}
    </>
  );
}

/* ─── Fila de contratos: saúde ────────────────────────────────────── */

async function FilaContratos({ sessao }: { sessao: Sessao | null }) {
  const gestor = ehGestor(sessao, "CONTRATOS");
  const soMeus = !gestor && sessao?.area === "CONTRATOS";

  const [contratos, equipe] = await Promise.all([
    prisma.contract.findMany({
      where: soMeus ? { responsavelId: sessao!.id } : {},
      include: {
        opportunity: { include: { cliente: { select: { nome: true } } } },
        responsavel: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    gestor ? equipeDaArea("CONTRATOS") : Promise.resolve([] as Equipe),
  ]);

  if (contratos.length === 0) {
    return (
      <FilaVazia
        mensagem={
          soMeus
            ? "Nenhum contrato delegado a você no momento."
            : "Nenhum contrato ativo. Contratos surgem quando uma proposta é aceita."
        }
      />
    );
  }

  return (
    <Secao
      titulo="Contratos ativos — atualize a saúde de cada um"
      qtd={contratos.length}
      valor={contratos.reduce((s, c) => s + Number(c.valor), 0)}
    >
      <ul className="mt-3 card divide-y divide-line-soft overflow-hidden">
        {contratos.map((c) => {
          const podeMexer = podeAtuar(sessao, "CONTRATOS", c.responsavelId);
          return (
            <li
              key={c.id}
              className="grid grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_150px_110px_auto]"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <Link
                    href={`/propostas/${c.opportunityId}`}
                    className="font-mono text-xs text-brand hover:underline"
                  >
                    {c.numero}
                  </Link>
                  <span className="truncate text-xs text-muted">
                    {c.opportunity.cliente.nome}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium">{c.opportunity.titulo}</p>
                <Responsavel nome={c.responsavel?.name ?? null} />
              </div>
              <p className="text-xs text-muted tabular-nums">
                até {c.fimVigencia ? dataCurta.format(c.fimVigencia) : "indefinido"}
              </p>
              <p className="text-sm font-medium tabular-nums">{brl.format(Number(c.valor))}</p>
              <div className="flex flex-col items-start gap-2">
                <form action={atualizarSaude} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <Pill {...HEALTH_META[c.health]} />
                  {podeMexer &&
                    (Object.keys(HEALTH_META) as (keyof typeof HEALTH_META)[])
                      .filter((h) => h !== c.health)
                      .map((h) => (
                        <button
                          key={h}
                          type="submit"
                          name="health"
                          value={h}
                          className={btnNeutro}
                          title={`Marcar como ${HEALTH_META[h].label.toLowerCase()}`}
                        >
                          {HEALTH_META[h].label}
                        </button>
                      ))}
                </form>
                {gestor && (
                  <Delegar
                    action={delegarContrato}
                    itemId={c.id}
                    equipe={equipe}
                    atualId={c.responsavelId}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

/* ─── Fila de faturamento: atestações ─────────────────────────────── */

async function FilaFaturamento({ sessao }: { sessao: Sessao | null }) {
  const gestor = ehGestor(sessao, "FATURAMENTO");
  const soMinhas = !gestor && sessao?.area === "FATURAMENTO";
  const competencia = new Date().toISOString().slice(0, 7);

  const [contratos, atestacoes, equipe] = await Promise.all([
    prisma.contract.findMany({
      include: {
        opportunity: { include: { cliente: { select: { nome: true } } } },
        atestacoes: true,
      },
    }),
    prisma.attestation.findMany({
      where: {
        status: { not: "FATURADA" },
        ...(soMinhas ? { responsavelId: sessao!.id } : {}),
      },
      include: {
        contract: {
          include: { opportunity: { include: { cliente: { select: { nome: true } } } } },
        },
        responsavel: { select: { name: true } },
      },
      orderBy: { competencia: "asc" },
    }),
    gestor ? equipeDaArea("FATURAMENTO") : Promise.resolve([] as Equipe),
  ]);

  const semCompetencia = gestor
    ? contratos.filter((c) => !c.atestacoes.some((a) => a.competencia === competencia))
    : [];

  const grupos: { status: keyof typeof ATESTACAO_ACOES; titulo: string }[] = [
    { status: "PENDENTE", titulo: "Aguardando confirmação do cliente" },
    { status: "CONFIRMADA_CLIENTE", titulo: "Confirmadas — efetuar atestação" },
    { status: "ATESTADA", titulo: "Atestadas — faturar" },
    { status: "CONTESTADA", titulo: "Contestadas pelo cliente" },
  ];

  const vazio = semCompetencia.length === 0 && atestacoes.length === 0;

  return (
    <>
      {vazio && (
        <FilaVazia
          mensagem={
            soMinhas
              ? "Nenhuma atestação delegada a você no momento."
              : "Nada a fazer: todas as atestações estão faturadas e a competência atual está coberta."
          }
        />
      )}

      {semCompetencia.length > 0 && (
        <Secao
          titulo={`Sem atestação na competência ${competencia}`}
          qtd={semCompetencia.length}
          valor={semCompetencia.reduce((s, c) => s + Number(c.valor) / 12, 0)}
        >
          <ul className="mt-3 card divide-y divide-line-soft overflow-hidden">
            {semCompetencia.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_110px_auto]"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <Link
                      href={`/propostas/${c.opportunityId}`}
                      className="font-mono text-xs text-brand hover:underline"
                    >
                      {c.numero}
                    </Link>
                    <span className="truncate text-xs text-muted">
                      {c.opportunity.cliente.nome}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {c.opportunity.titulo}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {brl.format(Number(c.valor) / 12)}
                  <span className="block text-xs font-normal text-muted">por mês</span>
                </p>
                <form action={gerarAtestacao}>
                  <input type="hidden" name="contractId" value={c.id} />
                  <button type="submit" className={btnPrimario}>
                    Gerar atestação de {competencia}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {grupos.map(({ status, titulo }) => {
        const doGrupo = atestacoes.filter((a) => a.status === status);
        if (doGrupo.length === 0) return null;
        return (
          <Secao
            key={status}
            titulo={titulo}
            qtd={doGrupo.length}
            valor={doGrupo.reduce((s, a) => s + Number(a.valor), 0)}
          >
            <ul className="mt-3 card divide-y divide-line-soft overflow-hidden">
              {doGrupo.map((a) => {
                const podeMexer = podeAtuar(sessao, "FATURAMENTO", a.responsavelId);
                return (
                  <li
                    key={a.id}
                    className="grid grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_110px_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-xs text-ink">{a.competencia}</span>
                        <Link
                          href={`/propostas/${a.contract.opportunityId}`}
                          className="font-mono text-xs text-brand hover:underline"
                        >
                          {a.contract.numero}
                        </Link>
                        <span className="truncate text-xs text-muted">
                          {a.contract.opportunity.cliente.nome}
                        </span>
                      </div>
                      <p className="mt-1">
                        <Pill {...ATESTACAO_META[a.status]} />
                      </p>
                      <Responsavel nome={a.responsavel?.name ?? null} />
                    </div>
                    <p className="text-sm font-medium tabular-nums">
                      {brl.format(Number(a.valor))}
                    </p>
                    <div className="flex flex-col items-start gap-2">
                      {podeMexer && (
                        <form action={moverAtestacao} className="flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={a.id} />
                          {(ATESTACAO_ACOES[a.status] ?? []).map((t) => (
                            <button
                              key={t.para}
                              type="submit"
                              name="para"
                              value={t.para}
                              className={t.destrutiva ? btnDestrutivo : btnPrimario}
                            >
                              {t.rotulo}
                            </button>
                          ))}
                        </form>
                      )}
                      {gestor && (
                        <Delegar
                          action={delegarAtestacao}
                          itemId={a.id}
                          equipe={equipe}
                          atualId={a.responsavelId}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Secao>
        );
      })}
    </>
  );
}

/* ─── Página ──────────────────────────────────────────────────────── */

export default async function Fila({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area: slug } = await params;
  const area = AREA_SLUGS[slug];
  if (!area) notFound();
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  // Cada um acessa somente a fila da própria área; só o ADMIN circula por todas
  const ehAdmin = sessao.area === "ADMIN";
  if (!ehAdmin && sessao.area !== area) redirect("/filas");

  const analistaDaArea = sessao.area === area && sessao.perfil === "ANALISTA";

  // Contagem de pendências por área — só o ADMIN vê os chips de navegação
  let pendencias: Record<string, number> = {};
  if (ehAdmin) {
    const [porEtapa, contratos, atestacoesAbertas] = await Promise.all([
      prisma.opportunity.groupBy({ by: ["stage"], _count: true }),
      prisma.contract.findMany({ select: { atestacoes: { select: { competencia: true } } } }),
      prisma.attestation.count({ where: { status: { not: "FATURADA" } } }),
    ]);
    const porStage = new Map(porEtapa.map((g) => [g.stage as Stage, g._count]));
    const competencia = new Date().toISOString().slice(0, 7);
    const semCompetencia = contratos.filter(
      (c) => !c.atestacoes.some((a) => a.competencia === competencia),
    ).length;

    pendencias = {
      comercial: (QUEUES.COMERCIAL ?? []).reduce((s, e) => s + (porStage.get(e) ?? 0), 0),
      propostas: (QUEUES.PROPOSTAS ?? []).reduce((s, e) => s + (porStage.get(e) ?? 0), 0),
      delivery: (QUEUES.DELIVERY ?? []).reduce((s, e) => s + (porStage.get(e) ?? 0), 0),
      contratos: contratos.length,
      faturamento: atestacoesAbertas + semCompetencia,
    };
  }

  const descricoes: Record<string, string> = {
    comercial: "Propostas prontas para enviar e respostas de cliente para registrar.",
    propostas: "Oportunidades para tratar: novas entradas, ajustes e tratativas em curso.",
    delivery: "Propostas aguardando verificação técnica.",
    contratos: "Acompanhe e atualize a saúde dos contratos ativos.",
    faturamento: "Atestações do mês: confirmação do cliente, atestação e faturamento.",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {ehAdmin ? "Filas de trabalho" : `Fila de trabalho · ${AREA_LABELS[area]}`}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {descricoes[slug]}
        {analistaDaArea && (
          <span className="text-faint"> Mostrando apenas as suas atribuições.</span>
        )}
      </p>

      {ehAdmin && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {Object.entries(AREA_SLUGS).map(([s, a]) => (
            <Link
              key={s}
              href={`/filas/${s}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                s === slug
                  ? "border-brand-strong bg-brand-strong text-white shadow-sm"
                  : "border-line bg-card text-muted shadow-sm hover:border-faint hover:text-ink"
              }`}
            >
              {AREA_LABELS[a]}
              <span className={s === slug ? "opacity-70" : "text-faint"}> {pendencias[s]}</span>
            </Link>
          ))}
        </div>
      )}

      {area === "CONTRATOS" ? (
        <FilaContratos sessao={sessao} />
      ) : area === "FATURAMENTO" ? (
        <FilaFaturamento sessao={sessao} />
      ) : (
        <FilaPropostas area={area} sessao={sessao} />
      )}
    </div>
  );
}
