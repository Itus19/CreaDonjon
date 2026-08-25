"use client";

export interface TabItem {
  value: string;
  label: string;
}

/**
 * Bascule d'onglets generique (V2-K5), meme famille que `Dropdown.tsx` :
 * un primitif controle, pas un cas particulier pour un seul ecran. Reprend
 * le style deja etabli par `SectionToggle.tsx` (segments egaux dans un
 * conteneur arrondi) plutot que d'inventer une deuxieme presentation
 * d'onglets dans le depot.
 */
export default function Tabs({
  value,
  items,
  onChange,
  className,
}: {
  value: string;
  items: TabItem[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={className ?? "flex w-full items-center gap-1 rounded-full border border-edge p-0.5 text-xs"}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={`flex-1 rounded-full px-3 py-1 text-center transition-colors ${
            item.value === value ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
