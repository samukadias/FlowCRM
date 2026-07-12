import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth";
import { AREA_SLUGS } from "@/lib/flow";

export default async function Filas() {
  const sessao = await obterSessao();
  // Cada um cai na própria fila; ADMIN começa pela fila de Propostas.
  const slug =
    Object.entries(AREA_SLUGS).find(([, a]) => a === sessao?.area)?.[0] ??
    "propostas";
  redirect(`/filas/${slug}`);
}
