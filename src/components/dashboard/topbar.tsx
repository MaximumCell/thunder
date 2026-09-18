"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Home, LogOut, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadProfileName, loadUsageSummary } from "@/lib/db";

export function Topbar() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ generations: number; tokens: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadProfileName().then(setName).catch(() => {});
    loadUsageSummary().then(setUsage).catch(() => {});
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initial = (name || email || "?")[0].toUpperCase();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
          T
        </span>
        <span className="text-sm font-medium tracking-tight">Thunder</span>
        <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">
          Studio
        </span>
      </div>

      <div className="flex items-center gap-2">
        {usage && (
          <span
            title={
              usage.tokens > 0
                ? `${usage.tokens} tokens logged across ${usage.generations} generation${usage.generations === 1 ? "" : "s"}`
                : `${usage.generations} generation${usage.generations === 1 ? "" : "s"} logged`
            }
            className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:flex"
          >
            <Zap className="size-3" />
            {usage.tokens > 0 ? `${usage.tokens} tokens` : `${usage.generations} generations`}
          </span>
        )}

        <Link
          href="/app/projects"
          title="Projects"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <FolderOpen className="size-4.5" />
        </Link>
        <Link
          href="/"
          title="Home"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <Home className="size-4.5" />
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold transition-colors hover:bg-secondary/70"
          >
            {initial}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-11 right-0 z-20 w-56 rounded-xl border border-border bg-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                <div className="px-2.5 py-2">
                  <p className="truncate text-sm font-medium">{name || "Account"}</p>
                  {email && (
                    <p className="truncate text-xs text-muted-foreground">{email}</p>
                  )}
                </div>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
