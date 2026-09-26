import { useEffect, useState } from "react";
import { BookOpen, Layers, Menu, ScanLine, SlidersHorizontal, Table2 } from "lucide-react";
import { useBinder } from "@/lib/binder-store";
import { cn } from "@/lib/utils";
import { BinderView } from "@/components/binder-view";
import { TableView } from "@/components/table-view";
import { LensView } from "@/components/lens-view";
import { AtlasView } from "@/components/atlas-view";
import { CardSheet } from "@/components/card-sheet";
import { SettingsSheet } from "@/components/settings-sheet";
import { LoadingScreen } from "@/components/loading-screen";
import type { RootTab } from "@/lib/types";

const TABS: { id: RootTab; label: string; icon: typeof Layers }[] = [
  { id: "binder", label: "Binder", icon: Layers },
  { id: "table", label: "Table", icon: Table2 },
  { id: "lens", label: "Lens", icon: ScanLine },
  { id: "atlas", label: "Atlas", icon: BookOpen },
];

export function AppShell() {
  const root = useBinder((s) => s.root);
  const setRoot = useBinder((s) => s.setRoot);
  const toast = useBinder((s) => s.toast);
  const clearToast = useBinder((s) => s.clearToast);
  const hydrateAdvice = useBinder((s) => s.hydrateAdvice);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [splash, setSplash] = useState(true);
  const [splashForce, setSplashForce] = useState(false);
  const lens = root === "lens";

  useEffect(() => {
    const apply = () => {
      const s = useBinder.getState();
      if (s.settings.lastRoot && s.settings.lastRoot !== s.root) s.setRoot(s.settings.lastRoot);
      if (s.settings.lastDeckId) s.setActiveDeck(s.settings.lastDeckId);
      hydrateAdvice();
    };
    apply();
    const unsub = useBinder.persist.onFinishHydration(apply);
    return unsub;
  }, [hydrateAdvice]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 2200);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-bg text-fg">
      <div
        className={cn(
          "z-30 flex items-center justify-between px-3",
          lens ? "absolute inset-x-0 top-0 pt-[max(0.6rem,env(safe-area-inset-top))]" : "px-4 pt-3",
        )}
      >
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-full bg-bg/70 ring-1 ring-border"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        {lens ? null : (
          <div className="flex items-center gap-2">
            <img src="/icons/app-icon.png" alt="" className="size-8 rounded-sm ring-1 ring-border" />
            <p className="font-display text-lg tracking-tight">WUBRGer</p>
          </div>
        )}
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-full bg-bg/70 text-sm ring-1 ring-border"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open policy"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col", !lens && "pt-1")}>
        {root === "binder" ? <BinderView /> : null}
        {root === "table" ? <TableView /> : null}
        {root === "lens" ? <LensView /> : null}
        {root === "atlas" ? <AtlasView /> : null}
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-bg/60" aria-label="Close menu" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[78%] max-w-xs flex-col bg-surface p-4 pt-[max(1.2rem,env(safe-area-inset-top))] ring-1 ring-border">
            <div className="mb-6 flex items-center gap-2">
              <img src="/icons/app-icon.png" alt="" className="size-10 rounded-md ring-1 ring-border" />
              <p className="font-display text-xl">WUBRGer</p>
            </div>
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = root === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setRoot(t.id);
                    setNavOpen(false);
                  }}
                  className={cn(
                    "mb-1 flex min-h-12 items-center gap-3 rounded-md px-3 text-left",
                    on ? "bg-accent text-accent-fg" : "text-fg",
                  )}
                >
                  <Icon className="size-5" />
                  {t.label}
                </button>
              );
            })}
          </aside>
        </div>
      ) : null}

      <CardSheet />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReplaySplash={() => {
          setSettingsOpen(false);
          setSplashForce(true);
          setSplash(true);
        }}
      />

      {splash ? (
        <LoadingScreen
          force={splashForce}
          onDone={() => {
            setSplash(false);
            setSplashForce(false);
          }}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-sm text-accent-fg shadow-sm">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
