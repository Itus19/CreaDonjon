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
      {items.map((item, index) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          // Roving tabindex (motif ARIA des onglets) : UN seul onglet dans
          // l'ordre de tabulation, les fleches circulent entre eux. Sans
          // ca, Tab traverse les six onglets un a un avant d'atteindre le
          // contenu — d'autant plus penible que la liste est longue.
          tabIndex={item.value === value ? 0 : -1}
          onKeyDown={(e) => {
            const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            let next = -1;
            if (delta !== 0) next = (index + delta + items.length) % items.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = items.length - 1;
            if (next < 0) return;
            e.preventDefault();
            onChange(items[next].value);
            // Le focus suit la selection : c'est le comportement attendu
            // d'un onglet (`aria-activedescendant` mis a part), et sans lui
            // les fleches suivantes repartiraient du mauvais index.
            (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
          }}
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
