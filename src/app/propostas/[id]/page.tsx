import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ListTodo, Mail, Paperclip, Pencil, StickyNote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  ATESTACAO_META,
  ESP_TIPO_LABELS,
  ESP_TIPO_ORDEM,
  FILA_DONA,
  HEALTH_META,
  MOTIVO_PERDA_LABELS,
  STAGE_META,
  TIPO_PROPOSTA_LABELS,
  TONE_COLOR,
  TRANSITIONS,
} from "@/lib/flow";
import {
  anexarArquivo,
  atualizarPropostaComercial,
  delegarProposta,
  moverProposta,
  registrarEmail,
  registrarNota,
} from "@/app/propostas/actions";
import { criarEsp, designarEsp, alternarEspPronta } from "@/app/propostas/esp-actions";
import { espsPendentes } from "@/lib/esp";
import { criarTarefa, concluirTarefa } from "@/app/tarefas/actions";
import { brl, dataCurta, tempoRelativo } from "@/lib/format";
import { FlowTrack } from "@/components/flow-track";
import { StageBadge } from "@/components/stage-badge";
import { Pill } from "@/components/pill";
import { CampoValor } from "@/components/campo-valor";
import { ProposalTimeline, type TimelineItem } from "@/components/proposal-timeline";
import { ehGestor, obterSessao, podeAtuar } from "@/lib/auth";
import { filtroPropostasVisiveis } from "@/lib/visibilidade";

export const dynamic = "force-dynamic";

const campoTexto =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25";
const btnAdicionar =
  "h-8 shrink-0 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink";

const MENSAGENS_ERRO: Record<string, string> = {
  anexo_invalido:
    "Não foi possível anexar o arquivo. Confira o formato (PDF, Office, imagem, CSV, TXT ou ZIP) e o tamanho (até 15 MB).",
  anexo_falhou: "Não foi possível salvar o anexo. Tente novamente.",
  motivo_obrigatorio: "Selecione o motivo antes de registrar a recusa ou o cancelamento.",
  esps_pendentes: "Todas as ESPs precisam estar prontas antes de enviar para verificação.",
};

export default async function DetalheProposta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  // A mesma regra de visibilidade da busca vale para o acesso direto por URL
  const p = await prisma.opportunity.findFirst({
    where: { AND: [{ id }, filtroPropostasVisiveis(sessao)] },
    include: {
      criadoPor: true,
      cliente: { select: { nome: true } },
      responsavel: { select: { name: true } },
      eventos: { orderBy: { createdAt: "desc" }, include: { user: true } },
      contrato: { include: { atestacoes: { orderBy: { competencia: "asc" } } } },
      esps: { include: { responsavel: { select: { name: true } } }, orderBy: { tipo: "asc" } },
    },
  });
  if (!p) notFound();

  const meta = STAGE_META[p.stage];
  // Só mudança de etapa conta para "nesta etapa há X dias" — uma nota ou
  // e-mail registrado não deve resetar o tempo na etapa atual.
  const desde =
    p.eventos.find((e) => e.eventType === "STAGE_CHANGE")?.createdAt ?? p.updatedAt;
  // Proposta Técnica só segue para verificação com todas as ESPs prontas —
  // a equipe de Propostas trabalha na ESP, não na oportunidade diretamente.
  const bloqueadaPorEsp = await espsPendentes(p.id, p.tipo);
  const acoesPermitidas = (TRANSITIONS[p.stage] ?? []).filter((t) =>
    podeAtuar(sessao, t.area, p.responsavelId),
  );
  const acoes = acoesPermitidas.filter((t) => !(t.para === "EM_VERIFICACAO" && bloqueadaPorEsp));
  const avisoEspsPendentes =
    bloqueadaPorEsp && acoesPermitidas.some((t) => t.para === "EM_VERIFICACAO");
  // Gestor da área dona da fila atual pode delegar daqui mesmo
  const filaDona = FILA_DONA[p.stage];
  const podeDelegar = filaDona != null && ehGestor(sessao, filaDona);
  // Quem registrou a proposta, ou o gestor Comercial, ajusta os dados
  // comerciais enquanto ela não estiver encerrada.
  const podeEditarComercial =
    !meta.terminal &&
    (ehGestor(sessao, "COMERCIAL") ||
      (sessao.area === "COMERCIAL" && sessao.id === p.criadoPorId));
  // Gestor de Propostas desmembra o contrato PD em ESPs e delega cada uma.
  const podeGerirEsp = ehGestor(sessao, "PROPOSTAS");
  const podeCriarEsp =
    podeGerirEsp &&
    p.numeroContratoTecnico != null &&
    (p.stage === "EM_TRATATIVA" || p.stage === "AJUSTES");
  const tiposFaltantes = ESP_TIPO_ORDEM.filter((t) => !p.esps.some((e) => e.tipo === t));
  const [equipe, equipePropostas] = await Promise.all([
    podeDelegar
      ? prisma.user.findMany({
          where: { area: filaDona, ativo: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    podeGerirEsp
      ? prisma.user.findMany({
          where: { area: "PROPOSTAS", ativo: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const [tarefas, todosUsuarios] = await Promise.all([
    prisma.tarefa.findMany({
      where: { opportunityId: id },
      include: { responsavel: { select: { name: true } } },
      orderBy: [{ concluida: "asc" }, { dataLimite: "asc" }],
    }),
    prisma.user.findMany({
      where: { ativo: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const timelineItems: TimelineItem[] = p.eventos.map((e): TimelineItem => {
    if (e.eventType === "EMAIL" || e.eventType === "NOTE") {
      return {
        kind: "communication",
        id: e.id,
        type: e.eventType === "EMAIL" ? "email" : "note",
        from: e.user.name,
        subject: e.subject ?? (e.eventType === "NOTE" ? "Nota interna" : "(sem assunto)"),
        content: e.content ?? "",
        timestamp: e.createdAt,
      };
    }
    if (e.eventType === "ATTACHMENT") {
      return {
        kind: "attachment",
        id: e.id,
        name: e.fileName ?? "Arquivo",
        size: e.fileSize ?? 0,
        uploadedBy: e.user.name,
        timestamp: e.createdAt,
        url: e.fileUrl ?? undefined,
      };
    }
    const eMeta = e.paraStage ? STAGE_META[e.paraStage] : null;
    return {
      kind: "event",
      id: e.id,
      stage:
        e.deStage == null
          ? "Entrada registrada"
          : `Movida para ${eMeta?.label.toLowerCase() ?? "—"}`,
      tone: eMeta?.tone ?? "neutral",
      user: e.user.name,
      timestamp: e.createdAt,
      observation: e.observacao ?? undefined,
    };
  });

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        ← Voltar para propostas
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-faint">{p.codigo}</span>
            <StageBadge stage={p.stage} />
            {p.numeroContratoTecnico && (
              <span
                className="font-mono text-xs font-medium text-brand"
                title="Número de contrato — atribuído automaticamente, não editável"
              >
                {p.numeroContratoTecnico}
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-balance">
            {p.titulo}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {p.cliente.nome} · registrada em {dataCurta.format(p.createdAt)} por{" "}
            {p.criadoPor.name}
            {p.tipo && <> · {TIPO_PROPOSTA_LABELS[p.tipo]}</>}
          </p>
        </div>
        <div className="text-right max-sm:text-left">
          <p className="text-xs text-muted">Valor estimado</p>
          <p className="text-xl font-semibold tracking-tight tabular-nums">
            {p.valorEstimado != null ? brl.format(Number(p.valorEstimado)) : "—"}
          </p>
        </div>
      </div>

      {erro && MENSAGENS_ERRO[erro] && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
        >
          {MENSAGENS_ERRO[erro]}
        </p>
      )}

      <section className="card mt-8 px-6 pt-7 pb-5">
        <FlowTrack stage={p.stage} size="lg" />
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm text-muted">
            <span className="font-medium" style={{ color: TONE_COLOR[meta.tone] }}>
              {meta.label}
            </span>
            {!meta.terminal && <> · aguardando ação de <strong className="font-medium text-ink">{meta.quem}</strong></>}
            {" · "}nesta etapa {tempoRelativo(desde)}
            {!meta.terminal &&
              (p.responsavel ? (
                <> · responsável: <strong className="font-medium text-ink">{p.responsavel.name}</strong></>
              ) : (
                <> · <span className="font-medium text-warn">sem responsável</span></>
              ))}
            {p.motivoPerda && (
              <> · motivo: <strong className="font-medium text-ink">{MOTIVO_PERDA_LABELS[p.motivoPerda]}</strong></>
            )}
          </p>
          {acoes.length > 0 && (
            <form action={moverProposta} className="mt-4 flex flex-wrap items-center gap-2.5">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="voltarLimpo" value="1" />
              <input
                name="observacao"
                placeholder="Observação (opcional)"
                aria-label="Observação da movimentação"
                className="h-9 min-w-52 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
              {acoes.some((t) => t.para === "RECUSADA" || t.para === "CANCELADA") && (
                <select
                  name="motivoPerda"
                  defaultValue=""
                  aria-label="Motivo, obrigatório para recusar ou cancelar"
                  className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                >
                  <option value="" disabled>
                    Motivo (recusa/cancelamento)
                  </option>
                  {(Object.entries(MOTIVO_PERDA_LABELS) as [keyof typeof MOTIVO_PERDA_LABELS, string][]).map(
                    ([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ),
                  )}
                </select>
              )}
              {acoes.map((t) =>
                t.destrutiva ? (
                  <button
                    key={t.para}
                    type="submit"
                    name="para"
                    value={t.para}
                    className="h-9 rounded-lg border border-line px-3.5 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
                  >
                    {t.rotulo}
                  </button>
                ) : (
                  <button
                    key={t.para}
                    type="submit"
                    name="para"
                    value={t.para}
                    className="h-9 rounded-lg bg-brand-strong px-3.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand"
                  >
                    {t.rotulo}
                  </button>
                ),
              )}
            </form>
          )}
          {avisoEspsPendentes && (
            <p className="mt-3 text-xs font-medium text-warn">
              Todas as ESPs precisam estar prontas antes de enviar para verificação.
            </p>
          )}
          {podeDelegar && (
            <form action={delegarProposta} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <label className="text-xs text-muted" htmlFor="delegar-select">
                Delegar para
              </label>
              <select
                id="delegar-select"
                name="userId"
                defaultValue={p.responsavelId ?? ""}
                className="h-8 max-w-48 rounded-md border border-line bg-canvas px-2 text-xs outline-none focus:border-brand"
              >
                <option value="">— sem responsável</option>
                {equipe.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-8 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
              >
                Delegar
              </button>
            </form>
          )}
        </div>
      </section>

      {podeEditarComercial && (
        <details className="card mt-6">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-4 text-sm font-medium text-ink marker:hidden">
            <Pencil size={14} strokeWidth={1.75} aria-hidden />
            Editar dados comerciais
          </summary>
          <form
            action={atualizarPropostaComercial}
            className="space-y-4 border-t border-line px-5 py-5"
          >
            <input type="hidden" name="id" value={p.id} />
            <label className="block text-sm font-medium">
              Título
              <input
                name="titulo"
                required
                defaultValue={p.titulo}
                className={`${campoTexto} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium">
              Valor estimado
              <CampoValor
                name="valor"
                defaultValue={p.valorEstimado != null ? Number(p.valorEstimado) : null}
              />
            </label>
            <label className="block text-sm font-medium">
              Descrição
              <textarea
                name="descricao"
                rows={3}
                defaultValue={p.descricao ?? ""}
                className={`${campoTexto} mt-1.5`}
              />
            </label>
            <button
              type="submit"
              className="h-9 rounded-lg bg-brand-strong px-4 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-brand"
            >
              Salvar alterações
            </button>
          </form>
        </details>
      )}

      {p.tipo === "PROPOSTA_TECNICA" && p.numeroContratoTecnico && (
        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold">ESPs do contrato {p.numeroContratoTecnico}</h2>
          <p className="mt-0.5 text-xs text-muted">
            Especificação dos Serviços — a proposta só segue para verificação quando
            todas estiverem prontas.
          </p>

          {p.esps.length > 0 && (
            <ul className="card mt-4 divide-y divide-line-soft overflow-hidden">
              {p.esps.map((e) => {
                const podeMarcarPronta =
                  podeGerirEsp || (sessao.area === "PROPOSTAS" && sessao.id === e.responsavelId);
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{e.numero}</span>
                        <Pill label={ESP_TIPO_LABELS[e.tipo]} tone="neutral" />
                        <Pill
                          label={e.pronta ? "Pronta" : "Em elaboração"}
                          tone={e.pronta ? "success" : "warn"}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {e.responsavel ? (
                          <>responsável: {e.responsavel.name}</>
                        ) : (
                          <span className="font-medium text-warn">sem responsável</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {podeGerirEsp && (
                        <form action={designarEsp} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="opportunityId" value={p.id} />
                          <select
                            key={e.responsavelId ?? "nenhum"}
                            name="userId"
                            defaultValue={e.responsavelId ?? ""}
                            aria-label={`Delegar ${e.numero} para`}
                            className="h-8 max-w-40 rounded-md border border-line bg-canvas px-2 text-xs outline-none focus:border-brand"
                          >
                            <option value="">— sem responsável</option>
                            {equipePropostas.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="h-8 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                          >
                            Delegar
                          </button>
                        </form>
                      )}
                      {podeMarcarPronta && (
                        <form action={alternarEspPronta}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="opportunityId" value={p.id} />
                          <input type="hidden" name="pronta" value={e.pronta ? "0" : "1"} />
                          <button
                            type="submit"
                            className="h-8 rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                          >
                            {e.pronta ? "Reabrir" : "Marcar pronta"}
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {podeCriarEsp && tiposFaltantes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tiposFaltantes.map((tipo) => (
                <form key={tipo} action={criarEsp}>
                  <input type="hidden" name="opportunityId" value={p.id} />
                  <input type="hidden" name="tipo" value={tipo} />
                  <button type="submit" className={btnAdicionar}>
                    + {ESP_TIPO_LABELS[tipo]}
                  </button>
                </form>
              ))}
            </div>
          )}

          {p.esps.length === 0 && !podeCriarEsp && (
            <p className="mt-4 text-sm text-muted">
              Nenhuma ESP desmembrada ainda — aguardando o gestor de Propostas.
            </p>
          )}
        </section>
      )}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="text-sm font-semibold">Histórico</h2>

          <div className="card mt-4 divide-y divide-line-soft">
            <form action={registrarNota} className="flex flex-col gap-2 p-4">
              <label
                htmlFor="nota-content"
                className="flex items-center gap-2 text-xs font-medium text-muted"
              >
                <StickyNote size={14} strokeWidth={1.75} aria-hidden />
                Nota interna
              </label>
              <input type="hidden" name="id" value={p.id} />
              <div className="flex flex-wrap items-end gap-2">
                <textarea
                  id="nota-content"
                  name="content"
                  rows={2}
                  required
                  placeholder="Registrar uma observação para a equipe…"
                  className={`${campoTexto} flex-1`}
                />
                <button type="submit" className={btnAdicionar}>
                  Adicionar
                </button>
              </div>
            </form>

            <form action={registrarEmail} className="flex flex-col gap-2 p-4">
              <label
                htmlFor="email-subject"
                className="flex items-center gap-2 text-xs font-medium text-muted"
              >
                <Mail size={14} strokeWidth={1.75} aria-hidden />
                Registrar e-mail
              </label>
              <input type="hidden" name="id" value={p.id} />
              <input
                id="email-subject"
                name="subject"
                required
                placeholder="Assunto"
                className={campoTexto}
              />
              <div className="flex flex-wrap items-end gap-2">
                <textarea
                  name="content"
                  rows={2}
                  required
                  placeholder="Conteúdo do e-mail…"
                  className={`${campoTexto} flex-1`}
                />
                <button type="submit" className={btnAdicionar}>
                  Registrar
                </button>
              </div>
            </form>

            <form action={anexarArquivo} className="flex flex-wrap items-center gap-3 p-4">
              <label
                htmlFor="anexo-file"
                className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted"
              >
                <Paperclip size={14} strokeWidth={1.75} aria-hidden />
                Anexar arquivo
              </label>
              <input type="hidden" name="id" value={p.id} />
              <input
                id="anexo-file"
                type="file"
                name="file"
                required
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip"
                className="min-w-0 flex-1 text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink file:transition-colors file:duration-150 hover:file:bg-surface-2"
              />
              <button type="submit" className={btnAdicionar}>
                Anexar
              </button>
            </form>
          </div>

          <div className="mt-6">
            <ProposalTimeline items={timelineItems} />
          </div>
        </section>

        <aside>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <ListTodo size={15} strokeWidth={1.75} aria-hidden />
            Tarefas
          </h2>
          <div className="card mt-4">
            {tarefas.length > 0 && (
              <ul className="divide-y divide-line-soft">
                {tarefas.map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5 px-4 py-3">
                    <form action={concluirTarefa} className="mt-0.5">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="concluida" value={t.concluida ? "0" : "1"} />
                      <button
                        type="submit"
                        aria-label={t.concluida ? "Reabrir tarefa" : "Concluir tarefa"}
                        className={`flex size-5 items-center justify-center rounded-md border transition-colors duration-150 ${
                          t.concluida
                            ? "border-ok bg-ok-soft text-ok"
                            : "border-line text-transparent hover:border-brand hover:text-brand"
                        }`}
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${t.concluida ? "text-muted line-through" : "text-ink"}`}>
                        {t.titulo}
                      </p>
                      <p className="mt-0.5 text-xs text-faint">
                        {t.dataLimite && <>{dataCurta.format(t.dataLimite)} · </>}
                        {t.responsavel.name}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form
              action={criarTarefa}
              className={`flex flex-col gap-2 p-4 ${tarefas.length > 0 ? "border-t border-line-soft" : ""}`}
            >
              <input type="hidden" name="opportunityId" value={p.id} />
              <input
                name="titulo"
                required
                placeholder="Nova tarefa…"
                aria-label="Título da tarefa"
                className={campoTexto}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  name="dataLimite"
                  aria-label="Prazo"
                  className="h-8 rounded-lg border border-line bg-canvas px-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                />
                <select
                  name="responsavelId"
                  defaultValue={p.responsavelId ?? sessao.id}
                  aria-label="Responsável pela tarefa"
                  className="h-8 rounded-lg border border-line bg-canvas px-2 text-xs outline-none focus:border-brand"
                >
                  {todosUsuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id === sessao.id ? "Eu" : u.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className={`${btnAdicionar} ml-auto`}>
                  Adicionar
                </button>
              </div>
            </form>
          </div>

          <h2 className="mt-8 text-sm font-semibold">Contrato</h2>
          {p.contrato ? (
            <div className="card mt-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm">{p.contrato.numero}</span>
                <Pill {...HEALTH_META[p.contrato.health]} />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Vigência</dt>
                  <dd className="tabular-nums">
                    {dataCurta.format(p.contrato.inicioVigencia)}
                    {p.contrato.fimVigencia && (
                      <> – {dataCurta.format(p.contrato.fimVigencia)}</>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Valor</dt>
                  <dd className="font-medium tabular-nums">
                    {brl.format(Number(p.contrato.valor))}
                  </dd>
                </div>
              </dl>

              {p.contrato.atestacoes.length > 0 && (
                <>
                  <h3 className="mt-6 text-xs font-semibold text-muted">
                    Atestações
                  </h3>
                  <ul className="mt-2 divide-y divide-line">
                    {p.contrato.atestacoes.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm tabular-nums">{a.competencia}</p>
                          <p className="text-xs text-muted tabular-nums">
                            {brl.format(Number(a.valor))}
                          </p>
                        </div>
                        <Pill {...ATESTACAO_META[a.status]} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">
              O contrato é criado quando o cliente aceita a proposta. Esta
              proposta ainda não chegou lá.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
