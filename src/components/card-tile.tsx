import { printingById, printingsByOracle } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { ManaPips } from "@/components/mana";

export function CardArt({
  src,
  name,
  foil,
  ghost,
}: {
  src: string | null | undefined;
  name: string;
  foil?: boolean;
  ghost?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-ink aspect-5/7 w-full",
        ghost && "opacity-40 grayscale",
      )}
      style={{ borderRadius: "calc(var(--radius-md) - 2px)" }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full items-end p-2 text-left text-xs text-muted">{name}</div>
      )}
      {foil ? <div className="card-foil pointer-events-none absolute inset-0" /> : null}
    </div>
  );
}

export function CardTile({
  scryfallId,
  oracleId,
  qty,
  foil,
  ghost,
  price,
  onClick,
  subtitle,
}: {
  scryfallId?: string | null;
  oracleId?: string;
  qty?: number;
  foil?: boolean;
  ghost?: boolean;
  price?: string | null;
  subtitle?: string;
  onClick?: () => void;
}) {
  const p = scryfallId ? printingById(scryfallId) : oracleId ? printingsByOracle(oracleId)[0] : undefined;
  if (!p) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-1.5 text-left"
    >
      <div className="relative">
        <CardArt src={p.image_small ?? p.image_normal} name={p.name} foil={foil} ghost={ghost} />
        {qty != null && qty > 0 ? (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-bg/85 px-1.5 text-[11px] font-medium tabular-nums text-fg ring-1 ring-border">
            {qty}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="truncate text-[13px] font-medium leading-snug text-fg">{p.name}</p>
          <ManaPips colors={p.color_identity} />
        </div>
        <p className="truncate text-[11px] text-muted">
          {subtitle ?? `${p.set.toUpperCase()} ${p.collector_number}`}
          {price ? ` · ${price}` : ""}
        </p>
      </div>
    </button>
  );
}
