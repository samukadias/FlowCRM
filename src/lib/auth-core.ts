// Parte da autenticação sem dependência de next/headers,
// para poder ser importada também pelo middleware (Edge).
import type { Area, Perfil } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "pf_sessao";
export const DURACAO_DIAS = 7;

export type Sessao = { id: string; name: string; area: Area; perfil: Perfil };

export function authSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-secret-defina-AUTH_SECRET-no-env",
  );
}

/** A área pode executar a ação? ADMIN pode tudo. */
export function podeAgir(sessao: Sessao | null, area: Area): sessao is Sessao {
  return sessao != null && (sessao.area === area || sessao.area === "ADMIN");
}

/** É gestor da área (delega e enxerga toda a equipe)? ADMIN conta como gestor. */
export function ehGestor(sessao: Sessao | null, area: Area): boolean {
  return (
    sessao != null &&
    (sessao.area === "ADMIN" || (sessao.area === area && sessao.perfil === "GESTOR"))
  );
}

/**
 * Pode atuar sobre um item específico? Gestor da área (e ADMIN) atua em tudo;
 * analista só no que foi delegado a ele.
 */
export function podeAtuar(
  sessao: Sessao | null,
  area: Area,
  responsavelId: string | null | undefined,
): boolean {
  if (sessao == null) return false;
  if (sessao.area === "ADMIN") return true;
  if (sessao.area !== area) return false;
  return sessao.perfil === "GESTOR" || sessao.id === responsavelId;
}
