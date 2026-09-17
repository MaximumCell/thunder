import Link from "next/link";
import { Home, Sparkles, User } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="flex w-16 shrink-0 flex-col items-center justify-between border-r border-border py-5">
      <div className="flex flex-col items-center gap-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          T
        </Link>
        <nav className="flex flex-col items-center gap-2">
          <Link
            href="/"
            title="Home"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <Home className="size-4.5" />
          </Link>
          <span
            title="Studio"
            className="flex size-9 items-center justify-center rounded-lg bg-card text-foreground"
          >
            <Sparkles className="size-4.5" />
          </span>
        </nav>
      </div>

      <span
        title="Account — coming with Supabase auth (Step 5)"
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground/50"
      >
        <User className="size-4.5" />
      </span>
    </aside>
  );
}
