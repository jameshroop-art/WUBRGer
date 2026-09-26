import { cn } from "@/lib/utils";

const COLOR: Record<string, string> = {
  W: "bg-mana-w",
  U: "bg-mana-u",
  B: "bg-mana-b",
  R: "bg-mana-r",
  G: "bg-mana-g",
};

export function ManaPips({ colors, className }: { colors: string[]; className?: string }) {
  const ordered = [...colors].sort((a, b) => "WUBRG".indexOf(a) - "WUBRG".indexOf(b));
  if (!ordered.length) {
    return <span className={cn("mana-pip bg-faint/40 inline-block", className)} title="colorless" />;
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {ordered.map((c) => (
        <span key={c} className={cn("mana-pip inline-block", COLOR[c] ?? "bg-faint")} title={c} />
      ))}
    </span>
  );
}
