import { TONE_COLOR, TONE_SOFT, type Tone } from "@/lib/flow";

export function Pill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{
        background: TONE_SOFT[tone],
        color: TONE_COLOR[tone],
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${TONE_COLOR[tone]}, transparent 82%)`,
      }}
    >
      {label}
    </span>
  );
}
