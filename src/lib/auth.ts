import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import {
  authSecret,
  DURACAO_DIAS,
  SESSION_COOKIE,
  type Sessao,
} from "./auth-core";

export { podeAgir, ehGestor, podeAtuar, type Sessao } from "./auth-core";

export async function criarSessao(sessao: Sessao) {
  const token = await new SignJWT(sessao)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(authSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function obterSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    return {
      id: payload.id,
      name: payload.name,
      area: payload.area,
      // Sessões antigas (antes dos perfis) não trazem o campo: assume analista
      perfil: payload.perfil ?? "ANALISTA",
    } as Sessao;
  } catch {
    return null;
  }
}

export async function encerrarSessao() {
  (await cookies()).delete(SESSION_COOKIE);
}
