-- AddColumn
ALTER TABLE "ProdutoServico" ADD COLUMN "categoria" TEXT NOT NULL DEFAULT 'Geral';
ALTER TABLE "ProdutoServico" ALTER COLUMN "categoria" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ProdutoServico_categoria_idx" ON "ProdutoServico"("categoria");
