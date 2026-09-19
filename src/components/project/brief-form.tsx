"use client";

import { Button } from "@/components/ui/button";
import { RATIOS, type Ratio } from "@/lib/mock-generations";

// Seedance 2.5 accepts an integer duration in [4, 30] or -1 (model picks);
// null here means "leave it to the model". 15s is the cap offered — cost
// scales with output seconds.
export const DURATIONS: (number | null)[] = [5, 10, 15, null];

const SHOT_STYLES = ["Cinematic", "Handheld", "Drone aerial", "Close-up", "Slow motion", "Animated"];
const MOODS = ["High-energy", "Calm & elegant", "Dramatic", "Playful", "Dark & moody"];
const IMAGE_STYLES = ["Photorealistic", "Cinematic", "Illustration", "3D render", "Minimal studio"];
const COMPOSITIONS = ["Close-up", "Wide shot", "Portrait", "Top-down"];

export interface BriefChoices {
  ratio: Ratio;
  duration: number | null;
  style: string | null; // video: shot style · image: visual style
  composition: string | null; // image only
  mood: string | null;
}

export const DEFAULT_CHOICES: BriefChoices = {
  ratio: "16:9",
  duration: 5,
  style: "Cinematic",
  composition: null,
  mood: null,
};

/** The plain-text answer sent to the agent (and shown in the chat). */
export function summarizeChoices(mode: "video" | "image", c: BriefChoices) {
  const parts =
    mode === "video"
      ? [
          `aspect ratio ${c.ratio}`,
          c.duration ? `duration ${c.duration} seconds` : null,
          c.style && `${c.style.toLowerCase()} shot style`,
          c.mood && `${c.mood.toLowerCase()} mood`,
        ]
      : [
          c.style && `${c.style.toLowerCase()} style`,
          c.composition && `${c.composition.toLowerCase()} composition`,
          c.mood && `${c.mood.toLowerCase()} mood`,
        ];
  return `Options — ${parts.filter(Boolean).join(", ") || "no preference"}. Generate it now, no more questions.`;
}

function Group<T extends string | number | null>({
  label,
  options,
  value,
  format = String,
  onChange,
  clearable,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format?: (v: T) => string;
  onChange: (v: T) => void;
  clearable?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = o === value;
          return (
            <button
              key={String(o)}
              type="button"
              onClick={() => onChange(selected && clearable ? (null as T) : o)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-white/30 hover:text-foreground"
              }`}
            >
              {format(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One click-to-choose card replacing the agent's open-ended clarifying
 * questions. Everything is a single-select chip; style/mood/composition can be
 * un-clicked to mean "no preference". */
export function BriefForm({
  mode,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  mode: "video" | "image";
  value: BriefChoices;
  onChange: (next: BriefChoices) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof BriefChoices>(key: K, v: BriefChoices[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm">A few quick choices, then I&apos;ll generate it.</p>
      {mode === "video" ? (
        <>
          <Group label="Aspect ratio" options={RATIOS} value={value.ratio} onChange={(v) => set("ratio", v)} />
          <Group
            label="Duration"
            options={DURATIONS}
            value={value.duration}
            format={(d) => (d ? `${d}s` : "Auto")}
            onChange={(v) => set("duration", v)}
          />
          <Group label="Shot style" options={SHOT_STYLES} value={value.style} onChange={(v) => set("style", v)} clearable />
        </>
      ) : (
        <>
          <Group label="Style" options={IMAGE_STYLES} value={value.style} onChange={(v) => set("style", v)} clearable />
          <Group label="Composition" options={COMPOSITIONS} value={value.composition} onChange={(v) => set("composition", v)} clearable />
        </>
      )}
      <Group label="Mood" options={MOODS} value={value.mood} onChange={(v) => set("mood", v)} clearable />
      <Button className="w-full rounded-full" onClick={onSubmit} disabled={disabled}>
        Generate {mode}
      </Button>
    </div>
  );
}
