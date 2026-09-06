"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import type { CarteOption } from "@/src/server/services/mapSource";

const PLACEHOLDER = "__choose__";

/**
 * Sélecteur de fiche `carte` existante (Lot I, phase F₁) — liste
 * `/api/worlds/[worldSlug]/cartes` (fiches de type `carte` du monde) et
 * renvoie le `blockId` de son bloc `map` propriétaire, seule donnée dont a
 * besoin `sourceBlockId` (ADR 0017 décision 1).
 */
export default function CartePicker({
  worldSlug,
  value,
  onPick,
}: {
  worldSlug: string;
  /** `sourceBlockId` actuellement choisi, s'il y en a un. */
  value: string | null;
  onPick: (option: CarteOption) => void;
}) {
  const [options, setOptions] = useState<CarteOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/worlds/${worldSlug}/cartes`)
      .then((res) => (res.ok ? res.json() : []))
      .then((body: CarteOption[]) => {
        if (!cancelled) setOptions(body);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [worldSlug]);

  if (!options) {
    return <p className="text-sm text-ink-muted">Chargement des cartes…</p>;
  }
  if (options.length === 0) {
    return <p className="text-sm italic text-ink-muted">Aucune fiche « Carte » dans ce monde pour l&apos;instant — créez-en une depuis la catégorie « Cartes » de la barre latérale.</p>;
  }

  const dropdownOptions = [
    { value: PLACEHOLDER, label: "Choisir une carte…" },
    ...options.map((o) => ({ value: o.blockId, label: o.entityName })),
  ];

  return (
    <Dropdown
      value={value ?? PLACEHOLDER}
      options={dropdownOptions}
      onChange={(blockId) => {
        const found = options.find((o) => o.blockId === blockId);
        if (found) onPick(found);
      }}
      aria-label="Choisir une carte à référencer"
      triggerClassName="rounded-full border border-edge bg-panel-raised px-3 py-1 text-xs text-ink transition-colors hover:bg-panel"
    />
  );
}
