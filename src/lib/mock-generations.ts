export type GenerationStatus = "queued" | "generating" | "completed" | "error";

export type Ratio = "16:9" | "1:1" | "9:16";

export const RATIOS: Ratio[] = ["16:9", "1:1", "9:16"];

export interface Generation {
  id: string;
  prompt: string;
  status: GenerationStatus;
  progress: number;
  ratio: Ratio;
  videoSrc?: string;
}

export const AVAILABLE_VIDEOS = [
  "/videos/1.mp4",
  "/videos/2.mp4",
  "/videos/3.mp4",
  "/videos/4.mp4",
  "/videos/5.mp4",
  "/videos/6.mp4",
  "/videos/7.mp4",
];

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

/** Drives a mock generation through queued → generating → completed/error via
 * setTimeout steps, standing in for real async polling until Step 4 wires up
 * the actual BytePlus task API. */
export function runMockGeneration(
  id: string,
  onUpdate: (patch: Partial<Generation>) => void
) {
  const progressSteps = [20, 45, 70, 90];
  progressSteps.forEach((progress, i) => {
    setTimeout(
      () => onUpdate({ status: "generating", progress }),
      500 + i * 650
    );
  });

  const finishDelay = 500 + progressSteps.length * 650 + 500;
  setTimeout(() => {
    const failed = Math.random() < 0.2;
    if (failed) {
      onUpdate({ status: "error", progress: 100 });
    } else {
      const videoSrc =
        AVAILABLE_VIDEOS[Math.floor(Math.random() * AVAILABLE_VIDEOS.length)];
      onUpdate({ status: "completed", progress: 100, videoSrc });
    }
  }, finishDelay);
}
