import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { authSecret, SESSION_COOKIE } from "@/lib/auth-core";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const autenticado = token
    ? await jwtVerify(token, authSecret()).then(() => true).catch(() => false)
    : false;

  if (!autenticado) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Tudo exige sessão, exceto login, cadastro e arquivos estáticos
  matcher: ["/((?!login|cadastro|_next|favicon\\.ico|.*\\..*).*)"],
};
