/**
 * Hook de inicialização do servidor (ver docs/instrumentation do Next.js).
 * Usado aqui só para agendar a checagem periódica de propostas paradas —
 * o app não tem fila de jobs, então isso roda em processo mesmo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { verificarEstagnacao } = await import("@/lib/estagnacao");
  const UMA_HORA_MS = 60 * 60 * 1000;

  const rodar = () => {
    verificarEstagnacao().catch((erro) => {
      console.error("[estagnacao] falha ao verificar propostas paradas:", erro);
    });
  };

  rodar(); // primeira checagem já na subida do servidor
  setInterval(rodar, UMA_HORA_MS);
}
