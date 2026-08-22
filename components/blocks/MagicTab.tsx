"use client";

import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { refIdentity } from "./useReferenceChips";

export interface KnownSpellView {
  known: { ref: BlockReference };
  label: string;
  level: number;
}

/**
 * Onglet Magie de la fiche jouable (V1-B5, extrait de
 * `PlayableCharacterSheet.tsx` par V2-G5 — pur découpage, aucun changement de
 * comportement) : sorts connus triés par niveau, bascule « Préparé ».
 */
export default function MagicTab({
  sortedKnownSpells,
  spellcasting,
  onTogglePrepared,
}: {
  sortedKnownSpells: KnownSpellView[];
  spellcasting: SpellcastingBlockData;
  onTogglePrepared: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-3">
      <p className="text-[10px] italic text-ink-muted">
        Sorts connus, triés par niveau. Cochez « Préparé » pour les retrouver dans l&apos;onglet Actions.
      </p>
      {sortedKnownSpells.map(({ known, label, level }) => (
        <div key={refIdentity(known.ref)} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 px-2.5 py-1.5 text-sm">
          <span className="w-10 shrink-0 text-xs text-ink-muted">{level === 0 ? "Tour" : `Niv. ${level}`}</span>
          <span className="flex-1 text-ink">{label}</span>
          <label className="flex items-center gap-1 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={known.ref.kind === "rule" && spellcasting.prepared.includes(known.ref.key)}
              onChange={() => known.ref.kind === "rule" && onTogglePrepared(known.ref.key)}
            />
            Préparé
          </label>
        </div>
      ))}
      {sortedKnownSpells.length === 0 && <p className="text-sm text-ink-muted">Aucun sort connu.</p>}
    </div>
  );
}
