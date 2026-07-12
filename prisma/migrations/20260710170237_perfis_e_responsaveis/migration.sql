-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ANALISTA', 'GESTOR');

-- AlterTable
ALTER TABLE "Attestation" ADD COLUMN     "responsavelId" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "responsavelId" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "responsavelId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "perfil" "Perfil" NOT NULL DEFAULT 'ANALISTA';

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
