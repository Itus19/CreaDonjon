"use client";

import Link from "next/link";
import type { ResolvedFeature } from "@/src/core/rules/sheet";
import { refIdentity, type ResolvedChipView } from "./useReferenceChips";

/**
 * Onglet Traits de la fiche jouable (V1-B5, extrait de
 * `PlayableCharacterSheet.tsx` par V2-G5) : les aptitudes accordées, et
 * seulement elles.
 *
 * Les maîtrises et les langues sont parties dans l'onglet Maîtrises
 * (`MasteriesTab`), avec les bottes d'arme : trois listes de même nature qui
 * étaient réparties sur deux onglets.
 */
export default function TraitsTab({
  traits,
  traitChips,
  traitSourceLabel,
}: {
  traits: ResolvedFeature[];
  traitChips: Map<string, ResolvedChipView>;
  traitSourceLabel: (f: ResolvedFeature) => string;
}) {
  function traitRefKey(f: ResolvedFeature): string {
    return f.key === f.source && f.source.includes(":") ? f.source.slice(f.source.indexOf(":") + 1) : f.key;
  }

  return (
    <div className="flex flex-col gap-1 pt-3 text-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Aptitudes accordées</span>
      {traits.length > 0 ? (
        <div className="flex flex-col gap-2">
          {traits.map((f) => {
            const chip = traitChips.get(refIdentity({ kind: "rule", key: traitRefKey(f) }));
            return (
              <div key={f.key} className="rounded-md border border-edge/60 bg-panel-raised p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  {chip?.found ? (
                    <Link
                      href={chip.href}
                      className="text-sm font-semibold no-underline hover:underline"
                      style={{ color: "var(--link-rule)" }}
                    >
                      {chip.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold italic text-ink-muted">{f.label}</span>
                  )}
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">{traitSourceLabel(f)}</span>
                </div>
                {chip?.found && chip.summary && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{chip.summary}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Aucune aptitude accordée pour l&apos;instant.</p>
      )}
    </div>
  );
}
