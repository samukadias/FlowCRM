"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Stage } from "@/generated/prisma/enums";
import { TONE_COLOR, type Tone } from "@/lib/flow";
import { brl, tempoRelativo } from "@/lib/format";
import { moverProposta } from "@/app/propostas/actions";

export interface KanbanCard {
  id: string;
  codigo: string;
  titulo: string;
  clienteNome: string;
  valorEstimado: number | null;
  stage: Stage;
  desde: Date;
  responsavelNome: string | null;
  /** Etapas do board para as quais esta proposta pode ser arrastada agora. */
  alvosValidos: Stage[];
}

export interface KanbanColuna {
  stage: Stage;
  label: string;
  tone: Tone;
}

/** Conteúdo visual do cartão — compartilhado entre a versão arrastável e a
 * versão estática (renderizada no servidor, antes do dnd-kit montar). */
function CartaoConteudo({ card }: { card: KanbanCard }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-faint">{card.codigo}</span>
        <span className="text-[11px] text-faint tabular-nums">{tempoRelativo(card.desde)}</span>
      </div>
      <p className="mt-1 truncate text-xs text-muted">{card.clienteNome}</p>
      <p className="mt-0.5 line-clamp-2 text-sm font-medium">{card.titulo}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-faint">
          {card.responsavelNome ?? "sem responsável"}
        </span>
        <span className="shrink-0 text-xs font-medium tabular-nums">
          {card.valorEstimado != null ? brl.format(card.valorEstimado) : "—"}
        </span>
      </div>
      <Link
        href={`/propostas/${card.id}`}
        className="absolute inset-0 rounded-xl"
        style={{ pointerEvents: "none" }}
        aria-hidden
      />
    </>
  );
}

function CartaoEstatico({ card }: { card: KanbanCard }) {
  return (
    <div className="card relative p-3 opacity-80">
      <CartaoConteudo card={card} />
    </div>
  );
}

function Cartao({ card, arrastando }: { card: KanbanCard; arrastando: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
    data: card,
    disabled: card.alvosValidos.length === 0,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
          : undefined
      }
      className={`card relative touch-none p-3 ${
        card.alvosValidos.length > 0 ? "cursor-grab active:cursor-grabbing" : "opacity-80"
      } ${arrastando ? "opacity-40" : ""}`}
    >
      <CartaoConteudo card={card} />
    </div>
  );
}

function ColunaCabecalho({ coluna, qtd, valorTotal }: { coluna: KanbanColuna; qtd: number; valorTotal: number }) {
  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: TONE_COLOR[coluna.tone] }}
        />
        <h3 className="text-xs font-semibold">{coluna.label}</h3>
        <span className="text-xs text-faint">{qtd}</span>
      </div>
      {valorTotal > 0 && (
        <p className="mt-0.5 text-[11px] text-muted tabular-nums">{brl.format(valorTotal)}</p>
      )}
    </div>
  );
}

function ColunaEstatica({ coluna, cards }: { coluna: KanbanColuna; cards: KanbanCard[] }) {
  const valorTotal = cards.reduce((s, c) => s + (c.valorEstimado ?? 0), 0);
  return (
    <div className="flex min-w-64 flex-1 flex-col rounded-xl border border-line bg-surface">
      <ColunaCabecalho coluna={coluna} qtd={cards.length} valorTotal={valorTotal} />
      <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
        {cards.map((c) => (
          <CartaoEstatico key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function Coluna({
  coluna,
  cards,
  arrastandoId,
  destinoValido,
}: {
  coluna: KanbanColuna;
  cards: KanbanCard[];
  arrastandoId: string | null;
  destinoValido: boolean | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.stage });
  const valorTotal = cards.reduce((s, c) => s + (c.valorEstimado ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-64 flex-1 flex-col rounded-xl border bg-surface transition-colors duration-150 ${
        isOver && destinoValido === true
          ? "border-brand bg-brand-soft/40"
          : isOver && destinoValido === false
            ? "border-danger/40 bg-danger-soft/30"
            : "border-line"
      }`}
    >
      <ColunaCabecalho coluna={coluna} qtd={cards.length} valorTotal={valorTotal} />
      <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
        {cards.map((c) => (
          <Cartao key={c.id} card={c} arrastando={arrastandoId === c.id} />
        ))}
      </div>
    </div>
  );
}

const inscreverNoop = () => () => {};

/** true só depois de montado no cliente; false na renderização do servidor. */
function useMontadoNoCliente() {
  return useSyncExternalStore(
    inscreverNoop,
    () => true,
    () => false,
  );
}

export function KanbanBoard({
  colunas,
  cards: cardsIniciais,
}: {
  colunas: KanbanColuna[];
  cards: KanbanCard[];
}) {
  // O dnd-kit gera ids internos de acessibilidade só no cliente; renderizar o
  // DndContext já na primeira passada (SSR) causaria mismatch de hidratação.
  // Por isso: primeira renderização é estática, e só depois de montado no
  // cliente é que a árvore arrastável entra — sem diferença visual perceptível.
  const montado = useMontadoNoCliente();

  const [cards, setCards] = useState(cardsIniciais);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  const cardAtivo = cards.find((c) => c.id === arrastandoId) ?? null;

  function aoSoltar(evento: DragEndEvent) {
    setArrastandoId(null);
    const { active, over } = evento;
    if (!over) return;

    const alvo = over.id as Stage;
    const card = cards.find((c) => c.id === active.id);
    if (!card || !card.alvosValidos.includes(alvo)) return;

    const anterior = cards;
    setCards((atual) => atual.map((c) => (c.id === card.id ? { ...c, stage: alvo } : c)));

    const fd = new FormData();
    fd.set("id", card.id);
    fd.set("para", alvo);
    iniciarTransicao(async () => {
      try {
        await moverProposta(fd);
      } catch {
        setCards(anterior); // ação bloqueada no servidor (permissão mudou etc.)
      }
    });
  }

  if (!montado) {
    return (
      <div className="-mx-6 overflow-x-auto px-6 pb-2">
        <div className="flex gap-3">
          {colunas.map((coluna) => (
            <ColunaEstatica
              key={coluna.stage}
              coluna={coluna}
              cards={cards.filter((c) => c.stage === coluna.stage)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DndContext
      onDragStart={(e) => setArrastandoId(e.active.id as string)}
      onDragEnd={aoSoltar}
      onDragCancel={() => setArrastandoId(null)}
    >
      <div className="-mx-6 overflow-x-auto px-6 pb-2">
        <div className="flex gap-3">
          {colunas.map((coluna) => (
            <Coluna
              key={coluna.stage}
              coluna={coluna}
              cards={cards.filter((c) => c.stage === coluna.stage)}
              arrastandoId={arrastandoId}
              destinoValido={cardAtivo ? cardAtivo.alvosValidos.includes(coluna.stage) : null}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
