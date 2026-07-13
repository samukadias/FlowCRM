-- CreateEnum
CREATE TYPE "TipoProposta" AS ENUM ('ORCAMENTO_ORIENTATIVO', 'PROPOSTA_TECNICA');

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "tipo" "TipoProposta";
