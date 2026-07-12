import type { Prisma } from "@/generated/prisma/client";
import type { Sessao } from "./auth-core";
import { QUEUES } from "./flow";

/**
 * Quais propostas o usuário enxerga na busca e no detalhe.
 *
 * - ADMIN: todas.
 * - Gestor: as com envolvimento da área dele — na fila da área agora, ou que a
 *   equipe já movimentou. Para Contratos/Faturamento, as que viraram contrato.
 * - Analista: apenas as com envolvimento pessoal — é o responsável atual,
 *   criou, movimentou, ou (Contratos/Faturamento) tem contrato/atestação
 *   delegado a ele.
 */
export function filtroPropostasVisiveis(
  sessao: Sessao,
): Prisma.OpportunityWhereInput {
  if (sessao.area === "ADMIN") return {};

  if (sessao.perfil === "GESTOR") {
    if (sessao.area === "CONTRATOS" || sessao.area === "FATURAMENTO") {
      return { contrato: { isNot: null } };
    }
    return {
      OR: [
        { stage: { in: QUEUES[sessao.area] ?? [] } },
        { eventos: { some: { user: { area: sessao.area } } } },
      ],
    };
  }

  // Analista
  const pessoais: Prisma.OpportunityWhereInput[] = [
    { responsavelId: sessao.id },
    { criadoPorId: sessao.id },
    { eventos: { some: { userId: sessao.id } } },
  ];
  if (sessao.area === "CONTRATOS") {
    pessoais.push({ contrato: { responsavelId: sessao.id } });
  }
  if (sessao.area === "FATURAMENTO") {
    pessoais.push({ contrato: { atestacoes: { some: { responsavelId: sessao.id } } } });
  }
  return { OR: pessoais };
}
