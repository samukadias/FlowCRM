import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

/** Diretório de armazenamento dos anexos, fora de `public/` — só é servido
 * via /api/uploads/[filename], que confere sessão e visibilidade da proposta. */
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export const TAMANHO_MAX_ANEXO = 15 * 1024 * 1024; // 15 MB

/** Extensão (minúscula, sem ponto) → Content-Type. Whitelist deliberada:
 * cobre os formatos de proposta comercial, nada executável. */
export const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
};

/** Só o padrão do nome gerado internamente é aceito — barra qualquer
 * tentativa de path traversal na rota que serve os arquivos. */
export const NOME_ARQUIVO_VALIDO = /^[a-zA-Z0-9._-]+$/;

export class AnexoInvalido extends Error {}

/** Valida e grava o anexo em disco; devolve os metadados para o WorkflowEvent. */
export async function salvarAnexo(
  file: File,
): Promise<{ fileName: string; fileSize: number; fileUrl: string }> {
  if (file.size === 0) throw new AnexoInvalido("Arquivo vazio.");
  if (file.size > TAMANHO_MAX_ANEXO) {
    throw new AnexoInvalido("Arquivo maior que 15 MB.");
  }

  const extensao = path.extname(file.name).slice(1).toLowerCase();
  if (!extensao || !(extensao in MIME_POR_EXTENSAO)) {
    throw new AnexoInvalido(
      "Tipo de arquivo não permitido. Use PDF, Office, imagem, CSV, TXT ou ZIP.",
    );
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  const nomeArmazenado = `${randomUUID()}.${extensao}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOADS_DIR, nomeArmazenado), bytes);

  return {
    fileName: file.name,
    fileSize: file.size,
    fileUrl: `/api/uploads/${nomeArmazenado}`,
  };
}
