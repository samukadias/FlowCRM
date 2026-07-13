export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Com centavos — para preço unitário (ex.: R$ 4,80/GB), onde arredondar
 * para inteiro perderia precisão relevante. */
export const brlUnitario = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function tempoRelativo(data: Date): string {
  const dias = Math.floor((Date.now() - data.getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

/** Como tempoRelativo, mas com granularidade de minutos/horas — para
 * timelines de atividade onde vários eventos acontecem no mesmo dia. */
export function tempoRelativoFino(data: Date): string {
  const ms = Date.now() - data.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.round(meses / 12);
  return `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
