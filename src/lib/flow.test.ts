import { describe, expect, it } from "vitest";
import {
  AREA_LABELS,
  FILA_DONA,
  PATH_LABELS,
  QUEUES,
  STAGE_META,
  STAGE_ORDER,
  TRANSITIONS,
} from "./flow";
import type { Area, Stage } from "@/generated/prisma/enums";

/**
 * Guarda de regressão: essa configuração é editada com frequência (regras de
 * fluxo mudam), e um erro de digitação aqui não dá erro de TypeScript —
 * silenciosamente quebra a UI ou trava uma proposta numa etapa. Estes testes
 * garantem que a malha de dados continua consistente entre si.
 */
describe("integridade da configuração do fluxo", () => {
  const todasEtapas = Object.keys(STAGE_META) as Stage[];
  const todasAreas = Object.keys(AREA_LABELS) as Area[];

  it("toda etapa de destino em TRANSITIONS existe em STAGE_META", () => {
    for (const [origem, destinos] of Object.entries(TRANSITIONS)) {
      for (const t of destinos ?? []) {
        expect(todasEtapas, `TRANSITIONS.${origem} → ${t.para}`).toContain(t.para);
        expect(todasAreas, `TRANSITIONS.${origem} → área ${t.area}`).toContain(t.area);
      }
    }
  });

  it("etapas terminais (aceita/recusada/cancelada) não têm transições de saída", () => {
    expect(TRANSITIONS.ACEITA).toBeUndefined();
    expect(TRANSITIONS.RECUSADA).toBeUndefined();
    expect(TRANSITIONS.CANCELADA).toBeUndefined();
  });

  it("toda etapa em QUEUES existe em STAGE_META", () => {
    for (const [area, etapas] of Object.entries(QUEUES)) {
      for (const etapa of etapas ?? []) {
        expect(todasEtapas, `QUEUES.${area} → ${etapa}`).toContain(etapa);
      }
    }
  });

  it("toda área em FILA_DONA é uma área válida", () => {
    for (const [etapa, area] of Object.entries(FILA_DONA)) {
      expect(todasAreas, `FILA_DONA.${etapa} → ${area}`).toContain(area);
    }
  });

  it("toda etapa não terminal tem uma fila dona (senão fica órfã, sem quem a mova)", () => {
    for (const etapa of todasEtapas) {
      if (STAGE_META[etapa].terminal) continue;
      expect(FILA_DONA[etapa], `FILA_DONA.${etapa}`).toBeDefined();
    }
  });

  it("a posição de cada etapa cabe dentro da régua de PATH_LABELS", () => {
    for (const etapa of todasEtapas) {
      const { pos } = STAGE_META[etapa];
      expect(pos, `STAGE_META.${etapa}.pos`).toBeGreaterThanOrEqual(0);
      expect(pos, `STAGE_META.${etapa}.pos`).toBeLessThan(PATH_LABELS.length);
    }
  });

  it("STAGE_ORDER cobre exatamente as etapas de STAGE_META, sem repetir", () => {
    expect(new Set(STAGE_ORDER)).toEqual(new Set(todasEtapas));
    expect(STAGE_ORDER.length).toBe(todasEtapas.length);
  });

  it("toda etapa alcançável a partir de ENTRADA existe em STAGE_META (sem transição para etapa inexistente)", () => {
    const visitadas = new Set<Stage>();
    const fila: Stage[] = ["ENTRADA"];
    while (fila.length > 0) {
      const atual = fila.pop()!;
      if (visitadas.has(atual)) continue;
      visitadas.add(atual);
      for (const t of TRANSITIONS[atual] ?? []) fila.push(t.para);
    }
    for (const etapa of visitadas) {
      expect(todasEtapas).toContain(etapa);
    }
  });
});
