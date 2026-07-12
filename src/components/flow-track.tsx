import type { Stage } from "@/generated/prisma/enums";
import { PATH_LABELS, STAGE_META, TONE_COLOR } from "@/lib/flow";

/**
 * Régua do fluxo: os seis marcos do caminho da proposta, com o progresso
 * pintado até a posição atual. É o coração visual do produto.
 */
export function FlowTrack({
  stage,
  size = "sm",
}: {
  stage: Stage;
  size?: "sm" | "lg";
}) {
  const meta = STAGE_META[stage];
  const color = TONE_COLOR[meta.tone];
  // Recusada/cancelada: o caminho percorrido fica cinza; só o marco final leva a cor.
  const abandonada = stage === "RECUSADA" || stage === "CANCELADA";
  const trilha = abandonada ? "var(--faint)" : color;

  const dot = size === "lg" ? 14 : 8;
  const dotCurrent = size === "lg" ? 18 : 11;

  return (
    <ol className="flex w-full" aria-label={`Etapa atual: ${meta.label}`}>
      {PATH_LABELS.map((label, i) => {
        const feito = i < meta.pos;
        const atual = i === meta.pos;
        const d = atual ? dotCurrent : dot;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden
                className="absolute h-0.5"
                style={{
                  top: dotCurrent / 2 - 1,
                  right: "50%",
                  left: "-50%",
                  background: feito || atual ? trilha : "var(--line)",
                }}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 rounded-full ${atual && !meta.terminal ? "flow-current" : ""}`}
              style={{
                width: d,
                height: d,
                marginTop: (dotCurrent - d) / 2,
                background: feito ? trilha : atual ? color : "var(--canvas)",
                border: feito || atual ? "none" : "2px solid var(--line)",
                ["--pulse" as string]: color,
              }}
            />
            {size === "lg" && (
              <span
                className={`mt-2.5 px-2 text-xs ${
                  atual ? "font-semibold" : feito ? "text-ink" : "text-faint"
                }`}
                style={atual ? { color } : undefined}
              >
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
