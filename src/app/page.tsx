import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroReel } from "@/components/hero-reel";
import { Reveal } from "@/components/reveal";
import { CategoryRow, type CategoryItem } from "@/components/category-row";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Contact", href: "mailto:hello@thunder.app" },
];

const PARTNERS = ["BytePlus ModelArk", "Seedance 2.5", "Seedream", "Gemini"];

// Two rows for now, built from our own 7 clips — swap in real categorized
// media (and real category labels) once there's enough of it to group.
const ROW_A: CategoryItem[] = [
  { src: "/videos/1.mp4", title: "Sample 01" },
  { src: "/videos/2.mp4", title: "Sample 02" },
  { src: "/videos/3.mp4", title: "Sample 03" },
  { src: "/videos/4.mp4", title: "Sample 04" },
];

const ROW_B: CategoryItem[] = [
  { src: "/videos/5.mp4", title: "Sample 05" },
  { src: "/videos/6.mp4", title: "Sample 06" },
  { src: "/videos/7.mp4", title: "Sample 07" },
];

const STEPS = [
  {
    title: "Describe the video",
    body: "Tell the assistant what you want to see — an ad, a scene, a concept. It asks the right follow-ups until the prompt is tight.",
  },
  {
    title: "Seedance generates",
    body: "BytePlus Seedance turns the refined prompt into a finished video — no camera, no editing timeline, no stock footage.",
  },
  {
    title: "Download and use it",
    body: "Every take lands in your gallery, ready to post, share, or drop into whatever you're making.",
  },
];

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Start generating", href: "/app" },
      { label: "Pricing", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contact", href: "mailto:hello@thunder.app" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "BytePlus ModelArk", href: "https://www.byteplus.com/en/product/modelark" },
      { label: "Status", href: "#" },
    ],
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <main className="flex-1">
        {/* Hero: full-bleed rolling video reel with corner-anchored copy */}
        <section className="relative h-screen min-h-[640px] w-full overflow-hidden bg-black">
          <HeroReel />

          <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10">
            <span className="text-base font-medium tracking-tight text-white">
              Thunder
            </span>
            <div className="hidden items-center gap-8 text-sm text-white/70 sm:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition-colors duration-200 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Button
              size="sm"
              className="rounded-full px-4 transition-transform duration-200 hover:scale-[1.03]"
              render={<Link href="/app" />}
              nativeButton={false}
            >
              Try it free
            </Button>
          </nav>

          <div className="relative z-10 flex h-[calc(100%-88px)] flex-col justify-end px-6 pb-14 sm:px-10 sm:pb-20">
            <div className="max-w-xl">
              <p className="mb-4 text-sm text-white/60">
                AI video generator · BytePlus Seedance
              </p>
              <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Describe it.
                <br />
                Watch it become video.
              </h1>
              <p className="mt-5 max-w-md text-base text-white/70 sm:text-lg">
                Chat with an assistant that refines your prompt, then Seedance
                generates the finished video — any concept, not just ads.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="rounded-full px-6 text-base transition-transform duration-200 hover:scale-[1.03]"
                  render={<Link href="/app" />}
                  nativeButton={false}
                >
                  Start generating
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-white/25 bg-transparent px-6 text-base text-white transition-colors duration-200 hover:bg-white/10"
                  render={<Link href="#how-it-works" />}
                  nativeButton={false}
                >
                  See how it works
                </Button>
              </div>
            </div>
          </div>

        </section>

        {/* Partner / stack strip */}
        <Reveal className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-10 gap-y-3 border-b border-border px-6 py-8 text-xs tracking-wide text-muted-foreground uppercase sm:px-6">
          <span className="normal-case tracking-normal">Built on</span>
          {PARTNERS.map((name) => (
            <span key={name} className="font-medium text-foreground/80">
              {name}
            </span>
          ))}
        </Reveal>

        {/* Statement section */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-6">
          <Reveal>
            <p className="mb-4 text-sm text-muted-foreground">What it does</p>
            <p className="max-w-3xl text-2xl leading-snug font-medium tracking-tight sm:text-3xl">
              You describe any video. The assistant sharpens it into a strong
              prompt.{" "}
              <span className="text-muted-foreground">
                Seedance renders it — ads, scenes, concepts, anything you can
                put into words.
              </span>
            </p>
          </Reveal>
        </section>

        {/* Showcase: category rows, contained cards, not full-bleed video */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl space-y-14 px-6 py-20 sm:px-6">
            <Reveal>
              <CategoryRow title="Examples" items={ROW_A} />
            </Reveal>
            <Reveal delay={100}>
              <CategoryRow title="More examples" items={ROW_B} />
            </Reveal>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-6">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                From prompt to finished video, three steps
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * 100}>
                  <div className="flex h-full flex-col gap-3 rounded-xl border border-border p-6 transition-colors duration-300 hover:border-white/25">
                    <span className="text-sm font-medium text-muted-foreground">
                      0{i + 1}
                    </span>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-[85vh] items-center overflow-hidden border-t border-border bg-black">
          <video
            className="absolute inset-0 size-full object-cover"
            src="/videos/8.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 text-center sm:px-6">
            <Reveal className="flex flex-col items-center gap-6">
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Your next video is one conversation away.
              </h2>
              <Button
                size="lg"
                className="h-11 rounded-full px-8 text-base transition-transform duration-200 hover:scale-[1.03]"
                render={<Link href="/app" />}
                nativeButton={false}
              >
                Start generating
              </Button>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <span className="text-base font-medium tracking-tight text-foreground">
                Thunder
              </span>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                Describe any video. The assistant sharpens the prompt, BytePlus Seedance
                renders it.
              </p>
            </div>

            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-sm font-medium text-foreground">{col.title}</p>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 Thunder. All rights reserved.</span>
            <span>Built on BytePlus ModelArk</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
