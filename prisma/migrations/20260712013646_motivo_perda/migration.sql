-- CreateEnum
CREATE TYPE "MotivoPerda" AS ENUM ('PRECO', 'CONCORRENCIA', 'PRAZO', 'ESCOPO', 'SEM_ORCAMENTO', 'SEM_RETORNO', 'MUDANCA_PRIORIDADE', 'OUTRO');

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "motivoPerda" "MotivoPerda";
