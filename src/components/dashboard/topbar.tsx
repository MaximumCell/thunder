"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Home, LogOut, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  loadProfileName,
  loadUsageDetail,
  loadUsageSummary,
  type UsageLogEntry,
  type UsageSummary,
} from "@/lib/db";

export function Topbar() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [detail, setDetail] = useState<UsageLogEntry[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadProfileName().then(setName).catch(() => {});
    loadUsageSummary().then(setUsage).catch(() => {});
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const openUsage = () => {
    setUsageOpen((v) => !v);
    if (!detail && !detailLoading) {
      setDetailLoading(true);
      loadUsageDetail()
        .then(setDetail)
        .catch(() => setDetail([]))
        .finally(() => setDetailLoading(false));
    }
  };

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
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={openUsage}
              title="Usage breakdown"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
            >
              <Zap className="size-3" />
              {usage.byteplus.tokens > 0
                ? `${usage.byteplus.tokens} tokens`
                : `${usage.byteplus.count} generation${usage.byteplus.count === 1 ? "" : "s"}`}
            </button>

            {usageOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUsageOpen(false)} />
                <div className="absolute top-11 right-0 z-20 w-96 rounded-xl border border-border bg-card shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                  <div className="grid grid-cols-2 gap-2 border-b border-border p-3">
                    <div className="rounded-lg bg-secondary/50 p-2.5">
                      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        BytePlus
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {usage.byteplus.count} generation{usage.byteplus.count === 1 ? "" : "s"}
                      </p>
                      {usage.byteplus.tokens > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {usage.byteplus.tokens} tokens
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-2.5">
                      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        Gemma
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {usage.gemma.count} call{usage.gemma.count === 1 ? "" : "s"}
                      </p>
                      {usage.gemma.tokens > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {usage.gemma.tokens} tokens
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto thin-scrollbar">
                    {detailLoading && (
                      <p className="p-3 text-xs text-muted-foreground">Loading…</p>
                    )}
                    {detail?.length === 0 && (
                      <p className="p-3 text-xs text-muted-foreground">
                        No usage logged yet.
                      </p>
                    )}
                    {detail?.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-3 border-b border-border px-3 py-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${
                                entry.source === "byteplus"
                                  ? "bg-foreground text-background"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {entry.source}
                            </span>
                            <p className="truncate text-xs text-foreground/90">
                              {entry.conversation_title || entry.generation_label || "Untitled"}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {entry.model ?? "unknown model"}
                            {entry.tokens ? ` · ${entry.tokens} tokens` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
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
