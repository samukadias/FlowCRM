-- CreateEnum
CREATE TYPE "EspTipo" AS ENUM ('ITOI', 'ITOD', 'APP');

-- CreateTable
CREATE TABLE "Esp" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "tipo" "EspTipo" NOT NULL,
    "responsavelId" TEXT,
    "pronta" BOOLEAN NOT NULL DEFAULT false,
    "prontaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Esp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Esp_numero_key" ON "Esp"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Esp_opportunityId_tipo_key" ON "Esp"("opportunityId", "tipo");

-- AddForeignKey
ALTER TABLE "Esp" ADD CONSTRAINT "Esp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Esp" ADD CONSTRAINT "Esp_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
