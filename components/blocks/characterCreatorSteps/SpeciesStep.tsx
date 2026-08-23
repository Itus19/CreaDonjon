"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockType, CustomTableBlockData } from "@/src/core/schemas/rule-blocks";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { mapSpeciesModifiers, parseCustomTableFields, type CustomTableRow } from "@/src/core/rules/srdMapping";
import { ftToM } from "@/src/core/rules/encumbrance";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

/** Vitesse + bonus de caracteristique d'une espece, pour l'afficher directement sur son bouton — meme lecture que `mapSpeciesModifiers` (moteur de regles), jamais le resume fige `ai_digest` (anglais, en pieds). */
function speciesCardSubtitle(blocks: RuleEntryBlockData[] | undefined): string | null {
  const table = blocks?.find((b) => b.blockType === "custom_table");
  if (!table) return null;
  const fields = parseCustomTableFields((table.data as CustomTableBlockData).rows as unknown as CustomTableRow[]);
  const modifiers = mapSpeciesModifiers(fields, "", "");
  const parts: string[] = [];
  const speedMod = modifiers.find((m) => m.target === "speed");
  if (speedMod?.value !== undefined) parts.push(`${ftToM(speedMod.value)} m`);
  const abilityParts = modifiers
    .filter((m) => m.target.startsWith("ability."))
    .map((m) => `${ABILITY_LABELS[m.target.slice(8)] ?? m.target.slice(8).toUpperCase()} +${m.value}`);
  if (abilityParts.length > 0) parts.push(abilityParts.join(", "));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Etape 1 (specs/wiki-liens-et-personnages.md §B8), en boutons plutot qu'un
 * menu deroulant (demande explicite, meme motif que `LevelClassesStep`) :
 * les caracteristiques (vitesse, bonus) directement visibles sur chaque
 * bouton. Espece de base et lignees (sous-especes) sont un seul et meme
 * `entry_type: "species"` cote donnees (`parentSpeciesKey` les distingue,
 * meme mecanisme que `parentClassKey` pour les sous-classes) — la 5.2.1 ne
 * porte pas de type distinct pour une lignee elfique ou une ascendance
 * draconique. Le niveau "de base" (`!parentSpeciesKey`) s'affiche en premier ;
 * choisir une lignee affine `character.species` vers sa cle precise, mais
 * rien n'empeche de garder l'espece de base si elle n'a pas de lignee ou si
 * aucune ne convient.
 */
export default function SpeciesStep({
  worldSlug,
  character,
  patchCharacter,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
}) {
  const entries = useWorldRuleEntries(worldSlug);
  const speciesEntries = entries.filter((e) => e.entryType === "species");
  const topLevel = speciesEntries.filter((e) => !e.parentSpeciesKey);

  const blocksByKey = useRuleEntryBlocks(
    worldSlug,
    speciesEntries.map((e) => e.key)
  );

  const currentKey = character.species?.kind === "rule" ? character.species.key : "";
  const currentEntry = speciesEntries.find((e) => e.key === currentKey);
  const expandedTopLevelKey = currentEntry ? (currentEntry.parentSpeciesKey ?? currentEntry.key) : null;
  const lineages = expandedTopLevelKey ? speciesEntries.filter((e) => e.parentSpeciesKey === expandedTopLevelKey) : [];

  function select(key: string) {
    patchCharacter({ species: { kind: "rule", key } });
  }

  const detailKey = currentKey || expandedTopLevelKey || "";
  const detailBlocks = blocksByKey[detailKey];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {topLevel.map((e) => {
          const subtitle = speciesCardSubtitle(blocksByKey[e.key]);
          const isSelected = e.key === expandedTopLevelKey;
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => select(e.key)}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                isSelected ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
              }`}
            >
              <span className="text-sm font-semibold text-ink">{e.name}</span>
              {subtitle && <span className="text-[10px] text-ink-muted">{subtitle}</span>}
            </button>
          );
        })}
      </div>

      {lineages.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Lignées</span>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {lineages.map((e) => {
              const subtitle = speciesCardSubtitle(blocksByKey[e.key]);
              const isSelected = e.key === currentKey;
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => select(e.key)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isSelected ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
                  }`}
                >
                  <span className="text-sm font-semibold text-ink">{e.name}</span>
                  {subtitle && <span className="text-[10px] text-ink-muted">{subtitle}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {detailKey && detailBlocks && detailBlocks.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
          {detailBlocks
            .filter((b) => b.blockType === "description" || b.blockType === "species_traits")
            .map((b, i) => (
              <div key={i}>{renderBlockData(b.blockType as BlockType, b.data, worldSlug)}</div>
            ))}
        </div>
      )}
    </div>
  );
}
