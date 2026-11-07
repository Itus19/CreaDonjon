"use client";

import { useState } from "react";
import { PRONOUN_SETS, type PronounSetKey, type Pronouns } from "@/src/core/rules/pronouns";

const PASTILLE = "rounded-full border px-2.5 py-1 text-xs normal-case tracking-normal transition-colors";
const ACTIVE = "border-accent bg-accent/10 text-accent";
const INACTIVE = "border-edge text-ink-muted hover:bg-panel-raised";

/**
 * V3.1-170 — Les pronoms d'une entité : des pastilles à cocher, plusieurs
 * possibles, dans l'ordre où on les coche (l'ordre dit l'alternance au mode
 * solo), et « Autre… » pour une saisie libre. La liste vient du noyau
 * (`PRONOUN_SETS`). Le même champ sert à l'Identité de l'assistant et au
 * bloc Personnage de la fiche.
 */
export default function PronomsField({
  value,
  onChange,
  className = "",
  formulaire = false,
}: {
  value: Pronouns | undefined;
  onChange: (next: Pronouns) => void;
  className?: string;
  /** V3.1-171 : la saisie libre à la hauteur des champs de formulaire (assistant). */
  formulaire?: boolean;
}) {
  const courant: Pronouns = value ?? { sets: [] };
  const [autreOuvert, setAutreOuvert] = useState(Boolean(courant.custom));

  function basculer(cle: PronounSetKey) {
    const sets = courant.sets.includes(cle) ? courant.sets.filter((s) => s !== cle) : [...courant.sets, cle];
    onChange({ ...courant, sets });
  }

  function basculerAutre() {
    if (autreOuvert) onChange({ sets: courant.sets });
    setAutreOuvert(!autreOuvert);
  }

  return (
    <fieldset className={`flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted ${className}`}>
      <legend className="mb-1">Pronoms</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRONOUN_SETS.map((p) => {
          const actif = courant.sets.includes(p.key);
          return (
            <button key={p.key} type="button" aria-pressed={actif} title={p.forms} onClick={() => basculer(p.key)} className={`${PASTILLE} ${actif ? ACTIVE : INACTIVE}`}>
              {p.label}
            </button>
          );
        })}
        <button type="button" aria-pressed={autreOuvert} onClick={basculerAutre} className={`${PASTILLE} ${autreOuvert ? ACTIVE : INACTIVE}`}>
          Autre…
        </button>
        {autreOuvert && (
          <input
            value={courant.custom ?? ""}
            onChange={(e) => onChange({ ...courant, custom: e.target.value })}
            maxLength={80}
            placeholder="préciser…"
            aria-label="Pronoms, autre"
            className={`w-32 rounded-md border border-edge bg-transparent px-2 ${formulaire ? "py-1.5" : "py-1"} text-sm normal-case tracking-normal text-ink outline-none`}
          />
        )}
      </div>
    </fieldset>
  );
}
