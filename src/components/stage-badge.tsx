import type { Stage } from "@/generated/prisma/enums";
import { STAGE_META, TONE_COLOR, TONE_SOFT } from "@/lib/flow";

export function StageBadge({ stage }: { stage: Stage }) {
  const meta = STAGE_META[stage];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{
        background: TONE_SOFT[meta.tone],
        color: TONE_COLOR[meta.tone],
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${TONE_COLOR[meta.tone]}, transparent 82%)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: TONE_COLOR[meta.tone] }}
      />
      {meta.label}
    </span>
  );
}
