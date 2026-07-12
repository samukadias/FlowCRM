import { Mail, Paperclip, StickyNote } from "lucide-react";
import type { Tone } from "@/lib/flow";
import { TONE_COLOR } from "@/lib/flow";
import { tamanhoArquivo, tempoRelativoFino } from "@/lib/format";
import { Pill } from "@/components/pill";

/**
 * Timeline de atividade de uma proposta: mudanças de etapa, e-mails, notas
 * internas e anexos, todos na mesma linha do tempo.
 */

export interface TimelineEvent {
  kind: "event";
  id: string;
  stage: string;
  tone: Tone;
  user: string;
  timestamp: Date;
  observation?: string;
}

export interface TimelineCommunication {
  kind: "communication";
  id: string;
  type: "email" | "note";
  from: string;
  subject: string;
  content: string;
  timestamp: Date;
}

export interface TimelineAttachment {
  kind: "attachment";
  id: string;
  name: string;
  size: number;
  uploadedBy: string;
  timestamp: Date;
  url?: string;
}

export type TimelineItem = TimelineEvent | TimelineCommunication | TimelineAttachment;

const commTone: Record<TimelineCommunication["type"], Tone> = {
  email: "progress",
  note: "warn",
};

function Rail({ isLast }: { isLast: boolean }) {
  if (isLast) return null;
  return (
    <span
      aria-hidden
      className="absolute top-9 bottom-0 left-[9px] w-0.5 bg-line"
    />
  );
}

function Dot({ tone, children }: { tone: Tone; children?: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-canvas text-white"
      style={{ background: TONE_COLOR[tone] }}
    >
      {children}
    </span>
  );
}

function EventRow({ item, isLast }: { item: TimelineEvent; isLast: boolean }) {
  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      <Rail isLast={isLast} />
      <Dot tone={item.tone} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="text-sm font-medium">{item.stage}</p>
          <time className="text-xs text-faint tabular-nums">
            {tempoRelativoFino(item.timestamp)}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-muted">por {item.user}</p>
        {item.observation && (
          <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink/90">
            {item.observation}
          </p>
        )}
      </div>
    </li>
  );
}

function CommunicationRow({
  item,
  isLast,
}: {
  item: TimelineCommunication;
  isLast: boolean;
}) {
  const tone = commTone[item.type];
  const Icone = item.type === "email" ? Mail : StickyNote;
  const preview =
    item.content.length > 140 ? `${item.content.slice(0, 140)}…` : item.content;
  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      <Rail isLast={isLast} />
      <Dot tone={tone}>
        <Icone size={11} strokeWidth={2} aria-hidden />
      </Dot>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{item.subject}</p>
            <Pill label={item.type === "email" ? "E-mail" : "Nota interna"} tone={tone} />
          </div>
          <time className="shrink-0 text-xs text-faint tabular-nums">
            {tempoRelativoFino(item.timestamp)}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-muted">de {item.from}</p>
        {preview && <p className="mt-1.5 text-sm text-ink/90">{preview}</p>}
      </div>
    </li>
  );
}

function AttachmentRow({ item, isLast }: { item: TimelineAttachment; isLast: boolean }) {
  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      <Rail isLast={isLast} />
      <Dot tone="neutral">
        <Paperclip size={11} strokeWidth={2} aria-hidden />
      </Dot>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <div className="flex min-w-0 items-center gap-2">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm font-medium text-brand hover:underline"
              >
                {item.name}
              </a>
            ) : (
              <p className="truncate text-sm font-medium">{item.name}</p>
            )}
            <Pill label={tamanhoArquivo(item.size)} tone="neutral" />
          </div>
          <time className="shrink-0 text-xs text-faint tabular-nums">
            {tempoRelativoFino(item.timestamp)}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-muted">anexado por {item.uploadedBy}</p>
      </div>
    </li>
  );
}

export function ProposalTimeline({
  items,
  emptyMessage = "Nenhuma atividade registrada nesta proposta.",
}: {
  items: TimelineItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  const ordenados = [...items].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  return (
    <ol>
      {ordenados.map((item, i) => {
        const isLast = i === ordenados.length - 1;
        switch (item.kind) {
          case "event":
            return <EventRow key={item.id} item={item} isLast={isLast} />;
          case "communication":
            return <CommunicationRow key={item.id} item={item} isLast={isLast} />;
          case "attachment":
            return <AttachmentRow key={item.id} item={item} isLast={isLast} />;
        }
      })}
    </ol>
  );
}
