import { NextResponse, type NextRequest } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/auth";
import { filtroPropostasVisiveis } from "@/lib/visibilidade";
import { MIME_POR_EXTENSAO, NOME_ARQUIVO_VALIDO, UPLOADS_DIR } from "@/lib/uploads";

/**
 * Serve um anexo já enviado. Exige sessão e a mesma visibilidade que vale
 * para a proposta dona do arquivo — o link não é público.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const sessao = await obterSessao();
  if (!sessao) return new NextResponse("Não autenticado.", { status: 401 });

  const { filename } = await params;
  if (!NOME_ARQUIVO_VALIDO.test(filename)) {
    return new NextResponse("Nome de arquivo inválido.", { status: 400 });
  }

  const [evento, espDoc] = await Promise.all([
    prisma.workflowEvent.findFirst({
      where: {
        fileUrl: `/api/uploads/${filename}`,
        opportunity: filtroPropostasVisiveis(sessao),
      },
      select: { fileName: true },
    }),
    prisma.esp.findFirst({
      where: {
        relatorioUrl: `/api/uploads/${filename}`,
        opportunity: filtroPropostasVisiveis(sessao),
      },
      select: { relatorioNome: true },
    }),
  ]);
  const nomeArquivo = evento?.fileName ?? espDoc?.relatorioNome;
  if (!nomeArquivo) return new NextResponse("Arquivo não encontrado.", { status: 404 });

  const extensao = path.extname(filename).slice(1).toLowerCase();
  const contentType = MIME_POR_EXTENSAO[extensao] ?? "application/octet-stream";

  try {
    const bytes = await readFile(path.join(UPLOADS_DIR, filename));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(nomeArquivo)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Arquivo não encontrado.", { status: 404 });
  }
}
