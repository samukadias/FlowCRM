-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "numeroContratoTecnico" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_numeroContratoTecnico_key" ON "Opportunity"("numeroContratoTecnico");
