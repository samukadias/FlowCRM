-- CreateEnum
CREATE TYPE "Area" AS ENUM ('COMERCIAL', 'PROPOSTAS', 'DELIVERY', 'CONTRATOS', 'FATURAMENTO', 'ADMIN');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('ENTRADA', 'EM_TRATATIVA', 'EM_VERIFICACAO', 'AJUSTES', 'PROPOSTA_PRONTA', 'ENVIADA_CLIENTE', 'ACEITA', 'RECUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('SAUDAVEL', 'ATENCAO', 'CRITICO');

-- CreateEnum
CREATE TYPE "AttestationStatus" AS ENUM ('PENDENTE', 'CONFIRMADA_CLIENTE', 'ATESTADA', 'FATURADA', 'CONTESTADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "valorEstimado" DECIMAL(14,2),
    "stage" "Stage" NOT NULL DEFAULT 'ENTRADA',
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "deStage" "Stage",
    "paraStage" "Stage" NOT NULL,
    "userId" TEXT NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "inicioVigencia" TIMESTAMP(3) NOT NULL,
    "fimVigencia" TIMESTAMP(3),
    "valor" DECIMAL(14,2) NOT NULL,
    "health" "HealthStatus" NOT NULL DEFAULT 'SAUDAVEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "status" "AttestationStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_codigo_key" ON "Opportunity"("codigo");

-- CreateIndex
CREATE INDEX "WorkflowEvent_opportunityId_createdAt_idx" ON "WorkflowEvent"("opportunityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_opportunityId_key" ON "Contract"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_numero_key" ON "Contract"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_contractId_competencia_key" ON "Attestation"("contractId", "competencia");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
