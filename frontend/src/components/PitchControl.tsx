import { Minus, Plus, RotateCcw } from "lucide-react";
import { usePlayer } from "../player/PlayerContext";

const MIN_PITCH = -6;
const MAX_PITCH = 6;

/** Label shown for a given shift: "Original", "+2", "-3". */
function pitchLabel(pitch: number): string {
  if (pitch === 0) return "Original";
  return pitch > 0 ? `+${pitch}` : `${pitch}`;
}

const TICKS = Array.from(
  { length: MAX_PITCH - MIN_PITCH + 1 },
  (_, i) => MIN_PITCH + i,
);

/**
 * Key / pitch control. Changes are applied live by the audio engine, so the
 * buttons can be nudged while the song is playing.
 */
export default function PitchControl({
  variant = "full",
}: {
  variant?: "full" | "compact";
}) {
  const { pitch, changePitch } = usePlayer();
  const down = () => changePitch(Math.max(MIN_PITCH, pitch - 1));
  const up = () => changePitch(Math.min(MAX_PITCH, pitch + 1));
  const reset = () => changePitch(0);
  const shifted = pitch !== 0;

  const stepClass =
    "flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-cream transition-all active:scale-90 disabled:opacity-30";

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={down}
          disabled={pitch <= MIN_PITCH}
          className={stepClass}
          aria-label="Scade tonalitatea cu un semiton"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={reset}
          disabled={!shifted}
          className={`h-8 w-12 rounded-full text-xs font-bold tabular-nums transition-colors ${
            shifted
              ? "bg-spotlight/20 text-spotlight"
              : "bg-surface-3 text-cream"
          }`}
          aria-label={shifted ? "Resetează tonalitatea" : "Tonalitate originală"}
          title={shifted ? "Apasă pentru reset" : "Tonalitate originală"}
        >
          {shifted ? pitchLabel(pitch) : "0"}
        </button>
        <button
          onClick={up}
          disabled={pitch >= MAX_PITCH}
          className={stepClass}
          aria-label="Crește tonalitatea cu un semiton"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Tonalitate
          </span>
          <span
            className={`text-sm font-bold tabular-nums ${
              shifted ? "text-spotlight" : "text-cream"
            }`}
          >
            {pitchLabel(pitch)}
            {shifted && (
              <span className="ml-1 text-[10px] font-semibold text-muted">
                semitonuri
              </span>
            )}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={down}
            disabled={pitch <= MIN_PITCH}
            className={stepClass}
            aria-label="Scade tonalitatea cu un semiton"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={up}
            disabled={pitch >= MAX_PITCH}
            className={stepClass}
            aria-label="Crește tonalitatea cu un semiton"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={reset}
            disabled={!shifted}
            className="ml-1 flex h-8 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-[11px] font-semibold text-cream transition-all active:scale-95 disabled:opacity-30"
            aria-label="Resetează tonalitatea la original"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-px">
        {TICKS.map((n) => {
          const active = n === pitch;
          const filled =
            pitch > 0 ? n > 0 && n <= pitch : pitch < 0 && n < 0 && n >= pitch;
          return (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full ${
                active
                  ? "bg-spotlight"
                  : filled
                    ? "bg-spotlight/50"
                    : "bg-white/10"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
