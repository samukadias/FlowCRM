import { describe, expect, it } from "vitest";
import { filtroPropostasVisiveis } from "./visibilidade";
import type { Sessao } from "./auth-core";

function sessao(area: Sessao["area"], perfil: Sessao["perfil"]): Sessao {
  return { id: "user-1", name: "Fulano", area, perfil };
}

describe("filtroPropostasVisiveis", () => {
  it("ADMIN enxerga tudo (filtro vazio)", () => {
    expect(filtroPropostasVisiveis(sessao("ADMIN", "GESTOR"))).toEqual({});
  });

  it("gestor de Propostas: fila da área ou propostas já movimentadas pela área", () => {
    const filtro = filtroPropostasVisiveis(sessao("PROPOSTAS", "GESTOR"));
    expect(filtro).toEqual({
      OR: [
        { stage: { in: ["ENTRADA", "AJUSTES", "EM_TRATATIVA"] } },
        { eventos: { some: { user: { area: "PROPOSTAS" } } } },
      ],
    });
  });

  it("gestor de Contratos: só propostas que já viraram contrato", () => {
    expect(filtroPropostasVisiveis(sessao("CONTRATOS", "GESTOR"))).toEqual({
      contrato: { isNot: null },
    });
  });

  it("gestor de Faturamento: mesma regra de Contratos", () => {
    expect(filtroPropostasVisiveis(sessao("FATURAMENTO", "GESTOR"))).toEqual({
      contrato: { isNot: null },
    });
  });

  it("analista de área comum: só envolvimento pessoal (responsável, criador ou movimentou)", () => {
    const filtro = filtroPropostasVisiveis(sessao("DELIVERY", "ANALISTA"));
    expect(filtro).toEqual({
      OR: [
        { responsavelId: "user-1" },
        { criadoPorId: "user-1" },
        { eventos: { some: { userId: "user-1" } } },
      ],
    });
  });

  it("analista de Contratos: envolvimento pessoal + contrato delegado a ele", () => {
    const filtro = filtroPropostasVisiveis(sessao("CONTRATOS", "ANALISTA"));
    expect(filtro).toEqual({
      OR: [
        { responsavelId: "user-1" },
        { criadoPorId: "user-1" },
        { eventos: { some: { userId: "user-1" } } },
        { contrato: { responsavelId: "user-1" } },
      ],
    });
  });

  it("analista de Faturamento: envolvimento pessoal + atestação delegada a ele", () => {
    const filtro = filtroPropostasVisiveis(sessao("FATURAMENTO", "ANALISTA"));
    expect(filtro).toEqual({
      OR: [
        { responsavelId: "user-1" },
        { criadoPorId: "user-1" },
        { eventos: { some: { userId: "user-1" } } },
        { contrato: { atestacoes: { some: { responsavelId: "user-1" } } } },
      ],
    });
  });
});
