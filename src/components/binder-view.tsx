import { SETS, printingById, primaryType } from "@/lib/catalog";
import { priceForPrinting, useBinder } from "@/lib/binder-store";
import { ageLabel, cn, formatUsd } from "@/lib/utils";
import { CardTile } from "@/components/card-tile";
import type { BinderSegment } from "@/lib/types";

const SEGS: { id: BinderSegment; label: string }[] = [
  { id: "faces", label: "Faces" },
  { id: "sets", label: "Sets" },
  { id: "value", label: "Value" },
  { id: "where", label: "Where" },
];

export function BinderView() {
  const inventory = useBinder((s) => s.inventory);
  const prices = useBinder((s) => s.prices);
  const segment = useBinder((s) => s.binderSegment);
  const setSeg = useBinder((s) => s.setBinderSegment);
  const search = useBinder((s) => s.search);
  const setSearch = useBinder((s) => s.setSearch);
  const colorChip = useBinder((s) => s.colorChip);
  const typeChip = useBinder((s) => s.typeChip);
  const setChip = useBinder((s) => s.setChip);
  const finishChip = useBinder((s) => s.finishChip);
  const setChips = useBinder((s) => s.setChips);
  const openSheet = useBinder((s) => s.openSheet);
  const refreshOwned = useBinder((s) => s.refreshOwnedPrices);
  const fetched = useBinder((s) => s.settings.pricesFetchedAt);

  const rows = inventory
    .map((r) => ({ row: r, p: printingById(r.scryfall_id) }))
    .filter((x): x is { row: (typeof inventory)[0]; p: NonNullable<ReturnType<typeof printingById>> } => Boolean(x.p))
    .filter(({ p, row }) => {
      if (search && !`${p.name} ${p.set} ${p.collector_number}`.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (colorChip && !p.color_identity.includes(colorChip) && !(colorChip === "C" && p.color_identity.length === 0))
        return false;
      if (typeChip && !p.type_line.includes(typeChip)) return false;
      if (setChip && p.set !== setChip) return false;
      if (finishChip && row.foil !== finishChip) return false;
      return true;
    });

  const faces = [...rows].sort((a, b) => b.row.added_at.localeCompare(a.row.added_at));
  const valued = [...rows].sort((a, b) => {
    const pa = priceForPrinting(a.p, prices)?.market ?? 0;
    const pb = priceForPrinting(b.p, prices)?.market ?? 0;
    return pb * b.row.qty - pa * a.row.qty;
  });
  const total = valued.reduce((n, x) => n + (priceForPrinting(x.p, prices)?.market ?? 0) * x.row.qty, 0);

  const bySet = new Map<string, number>();
  for (const { p, row } of rows) bySet.set(p.set, (bySet.get(p.set) ?? 0) + row.qty);

  const byLoc = new Map<string, typeof rows>();
  for (const item of rows) {
    const k = item.row.location || "unsorted";
    byLoc.set(k, [...(byLoc.get(k) ?? []), item]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-4 pt-5 pb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Binder</p>
        <h1 className="font-display text-[28px] leading-none tracking-tight">Your printings</h1>
        <p className="mt-2 text-sm text-muted">{inventory.reduce((n, r) => n + r.qty, 0)} copies · keyed by Scryfall id</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, set, number"
          className="mt-3 h-11 w-full rounded-md bg-raised px-3 text-sm text-fg outline-none ring-1 ring-border placeholder:text-faint"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["W", "U", "B", "R", "G", "C"].map((c) => (
            <Chip key={c} on={colorChip === c} onClick={() => setChips({ colorChip: colorChip === c ? null : c })}>
              {c}
            </Chip>
          ))}
          {["Creature", "Instant", "Artifact", "Land"].map((t) => (
            <Chip key={t} on={typeChip === t} onClick={() => setChips({ typeChip: typeChip === t ? null : t })}>
              {t}
            </Chip>
          ))}
          {(["nonfoil", "foil"] as const).map((f) => (
            <Chip key={f} on={finishChip === f} onClick={() => setChips({ finishChip: finishChip === f ? null : f })}>
              {f}
            </Chip>
          ))}
        </div>
      </header>

      <div className="flex gap-1 px-4">
        {SEGS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeg(s.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              segment === s.id ? "bg-accent text-accent-fg" : "text-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {segment === "faces" ? (
          faces.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {faces.map(({ row, p }) => (
                <CardTile
                  key={row.id}
                  scryfallId={p.id}
                  qty={row.qty}
                  foil={row.foil !== "nonfoil"}
                  onClick={() => openSheet({ kind: "printing", id: p.id })}
                />
              ))}
            </div>
          ) : (
            <Empty hint="Point the lens or search-add. The binder stays empty until a write lands." />
          )
        ) : null}

        {segment === "sets" ? (
          <ul className="space-y-2">
            {SETS.map((set) => {
              const have = bySet.get(set.code) ?? 0;
              return (
                <li key={set.code}>
                  <button
                    type="button"
                    onClick={() => setChips({ setChip: setChip === set.code ? null : set.code })}
                    className="flex w-full items-center gap-3 rounded-md bg-raised px-3 py-3 text-left ring-1 ring-border"
                  >
                    <span className="w-12 font-mono text-xs uppercase text-muted">{set.code}</span>
                    <span className="flex-1 truncate">{set.name}</span>
                    <span className="tabular-nums text-sm text-muted">
                      {have}/{set.total}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {segment === "value" ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-faint">Cached market · {ageLabel(fetched)}</p>
                <p className="font-display text-3xl tabular-nums">{formatUsd(total)}</p>
              </div>
              <button type="button" className="text-sm text-accent" onClick={() => refreshOwned()}>
                Refresh owned
              </button>
            </div>
            <ul className="space-y-2">
              {valued.map(({ row, p }) => {
                const pr = priceForPrinting(p, prices);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openSheet({ kind: "printing", id: p.id })}
                      className="flex w-full items-center gap-3 rounded-md bg-raised px-3 py-2 text-left ring-1 ring-border"
                    >
                      <img src={p.image_small ?? ""} alt="" className="h-12 w-9 rounded-xs object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{p.name}</p>
                        <p className="text-xs text-muted">
                          {p.set.toUpperCase()} {p.collector_number} · ×{row.qty}
                        </p>
                      </div>
                      <span className="tabular-nums text-sm">{formatUsd((pr?.market ?? 0) * row.qty)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {segment === "where" ? (
          <div className="space-y-5">
            {[...byLoc.entries()].map(([loc, items]) => (
              <section key={loc}>
                <h2 className="mb-2 text-xs uppercase tracking-wide text-faint">{loc}</h2>
                <div className="grid grid-cols-3 gap-3">
                  {items.map(({ row, p }) => (
                    <CardTile
                      key={row.id}
                      scryfallId={p.id}
                      qty={row.qty}
                      subtitle={primaryType(p.type_line)}
                      onClick={() => openSheet({ kind: "printing", id: p.id })}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs",
        on ? "bg-accent text-accent-fg" : "bg-raised text-muted ring-1 ring-border",
      )}
    >
      {children}
    </button>
  );
}

function Empty({ hint }: { hint: string }) {
  return <p className="py-16 text-center text-sm text-muted">{hint}</p>;
}
