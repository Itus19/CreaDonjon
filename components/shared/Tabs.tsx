"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { nextTabIndex } from "@/lib/ui/tabsKeyboard";

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Identifiants reliant un onglet à son panneau (ADR 0034). Partagés par
 * `Tabs` et `TabPanel` pour qu'ils ne divergent jamais.
 */
const tabId = (idPrefix: string, value: string) => `${idPrefix}-tab-${value}`;
const panelId = (idPrefix: string, value: string) => `${idPrefix}-panel-${value}`;

/**
 * Pilule glissante (ADR 0034) : l'unique présentation d'onglets. Les onglets
 * sont posés dans une gélule ; un fond relevé glisse sous l'actif.
 *
 * Le fond est positionné d'après l'onglet actif MESURÉ (`offsetLeft` /
 * `offsetWidth`), pas d'après un pourcentage : il suit donc aussi quand la
 * gélule déborde et défile horizontalement sur téléphone. Recalculé au
 * changement d'onglet et au redimensionnement (`ResizeObserver`).
 *
 * Contrat ARIA (ADR 0026) : `role="tablist"`, `aria-selected`, roving
 * tabindex (un seul onglet tabulable), flèches/`Home`/`End`, le focus suit
 * la sélection. Avec `idPrefix`, chaque onglet pointe vers son `TabPanel`.
 */
export default function Tabs<T extends string>({
  value,
  items,
  onChange,
  className,
  idPrefix,
  "aria-label": ariaLabel,
}: {
  value: T;
  items: TabItem<T>[];
  onChange: (value: T) => void;
  /** Mise en page uniquement — largeur, marge. Ni couleur, ni bordure, ni rayon (CHARTE-UI §3). */
  className?: string;
  /** Active `id` / `aria-controls` sur les onglets, à associer à `TabPanel`. */
  idPrefix?: string;
  /** Obligatoire : une liste d'onglets sans nom accessible ne dit pas de quoi elle est la vue. */
  "aria-label": string;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // `null` tant qu'on n'a pas mesuré : pas de fond au premier rendu serveur.
  const [fond, setFond] = useState<{ left: number; width: number } | null>(null);
  // Les transitions ne s'activent qu'après la première mesure : le fond
  // apparaît en place, il ne glisse pas depuis zéro au premier rendu.
  const [anime, setAnime] = useState(false);

  const activeIndex = items.findIndex((item) => item.value === value);

  function mesurer() {
    const el = tabRefs.current[activeIndex];
    if (!el) {
      setFond(null);
      return;
    }
    setFond((prev) =>
      prev && prev.left === el.offsetLeft && prev.width === el.offsetWidth
        ? prev
        : { left: el.offsetLeft, width: el.offsetWidth },
    );
  }

  useLayoutEffect(() => {
    mesurer();
    // `mesurer` ne dépend que de l'index actif et des refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, items.length]);

  useEffect(() => {
    // Après la première mesure peinte, on autorise la transition.
    const id = requestAnimationFrame(() => setAnime(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => mesurer());
    observer.observe(list);
    tabRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, items.length]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative flex items-center overflow-x-auto rounded-full border border-edge bg-panel-sunken p-[3px] text-xs${
        className ? ` ${className}` : ""
      }`}
    >
      {fond && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[3px] top-[3px] rounded-full border border-edge-strong bg-panel-raised shadow-sm motion-reduce:transition-none ${
            anime ? "transition-[left,width] duration-[260ms] ease-[cubic-bezier(.4,0,.2,1)]" : ""
          }`}
          style={{ left: fond.left, width: fond.width }}
        />
      )}
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={idPrefix ? tabId(idPrefix, item.value) : undefined}
            aria-controls={idPrefix ? panelId(idPrefix, item.value) : undefined}
            aria-selected={active}
            // Roving tabindex : UN seul onglet dans l'ordre de tabulation,
            // les flèches circulent entre eux.
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              const next = nextTabIndex(e.key, index, items.length);
              if (next === null) return;
              e.preventDefault();
              onChange(items[next].value);
              // Le focus suit la sélection ; par refs, car la gélule porte
              // aussi le fond glissant parmi ses enfants.
              tabRefs.current[next]?.focus();
            }}
            onClick={() => onChange(item.value)}
            className={`relative flex-1 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-center transition-colors ${
              active ? "font-semibold text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Panneau d'un onglet : à placer autour du contenu de l'onglet actif. */
export function TabPanel({
  idPrefix,
  value,
  className,
  children,
}: {
  idPrefix: string;
  value: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, value)} aria-labelledby={tabId(idPrefix, value)} className={className}>
      {children}
    </div>
  );
}
