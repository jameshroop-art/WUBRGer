import { useBinder } from "@/lib/binder-store";
import { SCRYFALL_LIMITS, scryfall } from "@/lib/scryfall";
import { ageLabel, cn } from "@/lib/utils";
import type { NetworkPolicy } from "@/lib/types";
import { useEffect, useState } from "react";

const POLICIES: { id: NetworkPolicy; label: string; hint: string }[] = [
  { id: "wifi_only", label: "Wi-Fi only", hint: "Default. Workers skip on mobile." },
  { id: "wifi_and_mobile", label: "Wi-Fi + mobile", hint: "Smaller batches on a metered path." },
  { id: "manual", label: "Manual", hint: "Nothing runs until you pull." },
];

export function SettingsSheet({
  open,
  onClose,
  onReplaySplash,
}: {
  open: boolean;
  onClose: () => void;
  onReplaySplash?: () => void;
}) {
  const settings = useBinder((s) => s.settings);
  const setPolicy = useBinder((s) => s.setPolicy);
  const reset = useBinder((s) => s.resetDemo);
  const exportDump = useBinder((s) => s.exportDump);
  const importDump = useBinder((s) => s.importDump);
  const refreshOwned = useBinder((s) => s.refreshOwnedPrices);
  const downloadCatalog = useBinder((s) => s.downloadCatalogMeta);
  const syncBusy = useBinder((s) => s.syncBusy);
  const [gateLine, setGateLine] = useState("");

  useEffect(() => {
    if (!open) return;
    return scryfall.subscribe((g) => {
      const cool = g.cooldownUntil > Date.now() ? `cooldown ${Math.ceil((g.cooldownUntil - Date.now()) / 1000)}s` : "open";
      setGateLine(`${cool} · last ${g.lastStatus ?? "—"} ${g.lastPath ?? ""}`.trim());
    });
  }, [open]);

  if (!open) return null;

  function download() {
    const blob = new Blob([JSON.stringify(exportDump(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "binder.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onFile(file: File) {
    file.text().then((t) => {
      try {
        importDump(JSON.parse(t));
        onClose();
      } catch {
        /* ignore */
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/70" onClick={onClose} aria-label="Close settings" />
      <div className="relative z-10 w-full max-w-md rounded-t-xl bg-surface p-5 ring-1 ring-border sm:rounded-xl">
        <h2 className="font-display text-2xl">Sync policy</h2>
        <p className="mt-1 text-sm text-muted">Not an OS dialog. The binder already opened.</p>
        <ul className="mt-4 space-y-2">
          {POLICIES.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPolicy(p.id)}
                className={cn(
                  "w-full rounded-md px-3 py-3 text-left ring-1",
                  settings.networkPolicy === p.id ? "bg-accent text-accent-fg ring-transparent" : "bg-raised ring-border",
                )}
              >
                <span className="block font-medium">{p.label}</span>
                <span className="block text-sm opacity-80">{p.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className="rounded-md bg-raised px-3 py-2 ring-1 ring-border disabled:opacity-50"
            disabled={Boolean(syncBusy)}
            onClick={() => refreshOwned({ force: true })}
          >
            Refresh owned prices
          </button>
          <button
            type="button"
            className="rounded-md bg-raised px-3 py-2 ring-1 ring-border disabled:opacity-50"
            disabled={Boolean(syncBusy)}
            onClick={() => downloadCatalog()}
          >
            Catalog index
          </button>
          <button type="button" className="rounded-md bg-raised px-3 py-2 ring-1 ring-border" onClick={download}>
            Export binder
          </button>
          <label className="rounded-md bg-raised px-3 py-2 ring-1 ring-border">
            Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <button type="button" className="rounded-md bg-raised px-3 py-2 ring-1 ring-border" onClick={onReplaySplash}>
            Loading screens
          </button>
          <button type="button" className="rounded-md px-3 py-2 text-danger" onClick={reset}>
            Restore demo
          </button>
        </div>
        <p className="mt-4 text-sm text-muted">
          APK keeps the binder in app-private files. Force-stop does not wipe qty, decks, or last tab.
        </p>
        <a
          href="/WUBRGer.apk"
          download="WUBRGer.apk"
          className="mt-2 inline-flex h-11 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg"
        >
          Download APK
        </a>
        <div className="mt-4 rounded-md bg-raised p-3 text-xs leading-relaxed text-muted ring-1 ring-border">
          <p className="font-medium text-fg">Scryfall gate</p>
          <p className="mt-1">
            search / named / collection {SCRYFALL_LIMITS.collection.rps}/s · other {SCRYFALL_LIMITS.other.rps}/s ·
            manifest {SCRYFALL_LIMITS.manifest.rps}/min · collection ≤{SCRYFALL_LIMITS.collection.maxIds} ids
          </p>
          <p>429 pauses every process 30s. Prices cache 24h. Catalog cursor 36h. Images on scryfall.io are uncapped.</p>
          <p className="mt-2 text-faint">
            {gateLine || "idle"} · catalog {ageLabel(settings.catalogFetchedAt)} · prices{" "}
            {ageLabel(settings.pricesFetchedAt)}
            {syncBusy ? ` · busy ${syncBusy}` : ""}
          </p>
        </div>
        <p className="mt-3 text-xs text-faint">
          Catalog {settings.catalogFetchedAt?.slice(0, 16) ?? "—"} · prices {settings.pricesFetchedAt?.slice(0, 16) ?? "—"}
        </p>
      </div>
    </div>
  );
}
