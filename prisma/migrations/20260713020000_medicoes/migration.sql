-- CreateTable
CREATE TABLE "Medicao" (
    "id" TEXT NOT NULL,
    "attestationId" TEXT NOT NULL,
    "espItemId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medicao_attestationId_espItemId_key" ON "Medicao"("attestationId", "espItemId");

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_attestationId_fkey" FOREIGN KEY ("attestationId") REFERENCES "Attestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_espItemId_fkey" FOREIGN KEY ("espItemId") REFERENCES "EspItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
