export type GenerationStatus = "queued" | "generating" | "completed" | "error";

export type Ratio = "16:9" | "1:1" | "9:16";

export const RATIOS: Ratio[] = ["16:9", "1:1", "9:16"];

export const MODELS = [
  {
    id: "seedance-2.5",
    name: "Seedance 2.5",
    mode: "Video",
    status: "Available" as const,
    description: "Text-to-video generation, any concept, any prompt.",
  },
  {
    id: "seedream",
    name: "Seedream",
    mode: "Image",
    status: "Coming soon" as const,
    description: "Text-to-image generation on the same ModelArk platform.",
  },
];

export const QUICK_STARTS = [
  { label: "Product ad", prompt: "A 15-second product ad for a minimalist ceramic coffee mug, studio lighting, slow rotation" },
  { label: "Cinematic scene", prompt: "A cinematic wide shot of a lone figure walking through a neon-lit city street at night, rain reflections" },
  { label: "Social clip", prompt: "A fast-paced, upbeat clip introducing a new sneaker drop, quick cuts, bold energy" },
  { label: "Character intro", prompt: "A close-up character introduction shot, dramatic rim lighting, slow push-in" },
];

let nextId = 1;
export function makeId(prefix: string) {
  return `${prefix}-${nextId++}`;
}
