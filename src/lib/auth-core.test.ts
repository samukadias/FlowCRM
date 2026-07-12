import { describe, expect, it } from "vitest";
import { ehGestor, podeAgir, podeAtuar, type Sessao } from "./auth-core";

function sessao(area: Sessao["area"], perfil: Sessao["perfil"] = "GESTOR"): Sessao {
  return { id: "user-1", name: "Fulano", area, perfil };
}

describe("podeAgir — a área pode executar o verbo?", () => {
  it("permite quando a sessão é da própria área (analista ou gestor)", () => {
    expect(podeAgir(sessao("COMERCIAL", "ANALISTA"), "COMERCIAL")).toBe(true);
    expect(podeAgir(sessao("COMERCIAL", "GESTOR"), "COMERCIAL")).toBe(true);
  });

  it("nega quando a sessão é de outra área", () => {
    expect(podeAgir(sessao("PROPOSTAS"), "COMERCIAL")).toBe(false);
  });

  it("ADMIN pode agir em qualquer área", () => {
    expect(podeAgir(sessao("ADMIN"), "COMERCIAL")).toBe(true);
    expect(podeAgir(sessao("ADMIN"), "FATURAMENTO")).toBe(true);
  });

  it("nega sem sessão", () => {
    expect(podeAgir(null, "COMERCIAL")).toBe(false);
  });
});

describe("ehGestor — delega e vê toda a equipe?", () => {
  it("gestor da própria área: true", () => {
    expect(ehGestor(sessao("PROPOSTAS", "GESTOR"), "PROPOSTAS")).toBe(true);
  });

  it("analista da própria área: false", () => {
    expect(ehGestor(sessao("PROPOSTAS", "ANALISTA"), "PROPOSTAS")).toBe(false);
  });

  it("gestor de outra área: false", () => {
    expect(ehGestor(sessao("PROPOSTAS", "GESTOR"), "DELIVERY")).toBe(false);
  });

  it("ADMIN conta como gestor de qualquer área", () => {
    expect(ehGestor(sessao("ADMIN"), "DELIVERY")).toBe(true);
  });

  it("nega sem sessão", () => {
    expect(ehGestor(null, "PROPOSTAS")).toBe(false);
  });
});

describe("podeAtuar — pode agir sobre este item específico?", () => {
  it("ADMIN atua em qualquer item, mesmo delegado a outra pessoa", () => {
    expect(podeAtuar(sessao("ADMIN"), "PROPOSTAS", "outro-usuario")).toBe(true);
  });

  it("gestor da área atua em qualquer item da área, delegado ou não", () => {
    const g = sessao("PROPOSTAS", "GESTOR");
    expect(podeAtuar(g, "PROPOSTAS", null)).toBe(true);
    expect(podeAtuar(g, "PROPOSTAS", "outro-usuario")).toBe(true);
  });

  it("analista só atua no item delegado a ele mesmo", () => {
    const a = sessao("PROPOSTAS", "ANALISTA"); // id "user-1"
    expect(podeAtuar(a, "PROPOSTAS", "user-1")).toBe(true);
    expect(podeAtuar(a, "PROPOSTAS", "outro-usuario")).toBe(false);
    expect(podeAtuar(a, "PROPOSTAS", null)).toBe(false);
  });

  it("nega quando a área do item não é a área da sessão", () => {
    expect(podeAtuar(sessao("PROPOSTAS", "GESTOR"), "DELIVERY", null)).toBe(false);
  });

  it("nega sem sessão", () => {
    expect(podeAtuar(null, "PROPOSTAS", "user-1")).toBe(false);
  });
});
