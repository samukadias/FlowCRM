-- AlterTable
ALTER TABLE "Esp" ADD COLUMN "relatorioNome" TEXT,
ADD COLUMN "relatorioTamanho" INTEGER,
ADD COLUMN "relatorioUrl" TEXT;

-- CreateTable
CREATE TABLE "ProdutoServico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "valorUnitarioPadrao" DECIMAL(14,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoServico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoServico_nome_key" ON "ProdutoServico"("nome");

-- CreateTable
CREATE TABLE "EspItem" (
    "id" TEXT NOT NULL,
    "espId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidadeMensal" DECIMAL(12,2) NOT NULL,
    "periodoContratualMeses" INTEGER NOT NULL,
    "valorUnitario" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EspItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EspItem_espId_idx" ON "EspItem"("espId");

-- AddForeignKey
ALTER TABLE "EspItem" ADD CONSTRAINT "EspItem_espId_fkey" FOREIGN KEY ("espId") REFERENCES "Esp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspItem" ADD CONSTRAINT "EspItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoServico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
