"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import Dropdown from "@/components/shared/Dropdown";
import { AgeInput, GENDER_OPTIONS, genderDropdownValue } from "../CharacterSheetHeader";

/**
 * Etape « Identite » de l'assistant de creation (V3-Z1) : qui est le
 * personnage, avant ce qu'il sait faire. Trois champs, aucun obligatoire —
 * l'etape se passe sans rien remplir, et un personnage sans age reste un
 * personnage valide (`age`, `gender`, `pronouns` sont `.optional()` dans le
 * bloc). Memes controles que la rangee d'identite de `CharacterSheetHeader`,
 * importes plutot que recopies : on les retrouve au meme geste sur la fiche.
 */
export default function IdentityStep({
  character,
  patchCharacter,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">Qui est ce personnage ? Rien n&apos;est obligatoire ici : tout se complète plus tard sur la fiche.</p>
      <div className="flex flex-wrap items-start gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
          Âge
          <AgeInput age={character.age} onChange={(age) => patchCharacter({ age })} className="w-20" />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
          Genre
          <Dropdown
            size="md"
            value={genderDropdownValue(character.gender)}
            options={GENDER_OPTIONS}
            onChange={(v) =>
              patchCharacter({
                gender:
                  v === "custom"
                    ? { custom: typeof character.gender === "object" ? character.gender.custom : "" }
                    : (v as Exclude<CharacterBlockData["gender"], { custom: string } | undefined>),
              })
            }
            aria-label="Genre"
          />
          {typeof character.gender === "object" && (
            <input
              value={character.gender.custom}
              onChange={(e) => patchCharacter({ gender: { custom: e.target.value } })}
              placeholder="préciser…"
              aria-label="Genre personnalisé"
              className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
          Pronoms
          <input
            value={character.pronouns ?? ""}
            onChange={(e) => patchCharacter({ pronouns: e.target.value })}
            placeholder="elle, il, iel…"
            className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
      </div>
    </div>
  );
}
