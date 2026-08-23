"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockType, CustomTableBlockData, SpeciesTraitsBlockData } from "@/src/core/schemas/rule-blocks";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { mapSpeciesModifiers, parseCustomTableFields, type CustomTableRow } from "@/src/core/rules/srdMapping";
import { ftToM } from "@/src/core/rules/encumbrance";
import { CREATURE_TYPE_LABELS_FR, SIZE_LABELS_FR } from "@/src/i18n/fr";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

interface SpeciesCardInfo {
  statsLine: string | null;
  lifespan: string | null;
  traitsLine: string | null;
}

/**
 * Type, taille, vitesse, bonus de caracteristique, esperance de vie et
 * traits d'une espece, pour les afficher directement sur son bouton (retour
 * utilisateur, V2-G1 : seule la vitesse+bonus etait visible avant de
 * cliquer). `species_traits` (type/taille/vitesse/esperance de vie/traits,
 * deja resolu cote serveur — `listRuleEntryBlocksByKeys`) plutot que
 * `custom_table` pour ces champs ; `custom_table` reste la seule source du
 * bonus de caracteristique (`mapSpeciesModifiers`, absent de
 * `species_traits`). Jamais le resume fige `ai_digest` (anglais, en pieds).
 */
function speciesCardInfo(blocks: RuleEntryBlockData[] | undefined): SpeciesCardInfo | null {
  const table = blocks?.find((b) => b.blockType === "custom_table");
  const traitsBlock = blocks?.find((b) => b.blockType === "species_traits");
  if (!table && !traitsBlock) return null;

  const statsParts: string[] = [];
  let lifespan: string | null = null;
  let traitsLine: string | null = null;

  if (traitsBlock) {
    const data = traitsBlock.data as SpeciesTraitsBlockData;
    const traits = data.traits as unknown as { key: string; resolved_name?: string }[];
    if (data.creature_type) statsParts.push(CREATURE_TYPE_LABELS_FR[data.creature_type] ?? data.creature_type);
    if (data.sizes && data.sizes.length > 0) statsParts.push(data.sizes.map((s) => SIZE_LABELS_FR[s.label] ?? s.label).join("/"));
    if (data.speed?.value !== undefined) statsParts.push(`${ftToM(data.speed.value)} m`);
    lifespan = data.lifespan ?? null;
    if (traits.length > 0) traitsLine = traits.map((t) => t.resolved_name ?? t.key).join(", ");
  }

  if (table) {
    const fields = parseCustomTableFields((table.data as CustomTableBlockData).rows as unknown as CustomTableRow[]);
    const modifiers = mapSpeciesModifiers(fields, "", "");
    const abilityParts = modifiers
      .filter((m) => m.target.startsWith("ability."))
      .map((m) => `${ABILITY_LABELS[m.target.slice(8)] ?? m.target.slice(8).toUpperCase()} +${m.value}`);
    if (abilityParts.length > 0) statsParts.push(abilityParts.join(", "));
    if (!traitsBlock) {
      const speedMod = modifiers.find((m) => m.target === "speed");
      if (speedMod?.value !== undefined) statsParts.unshift(`${ftToM(speedMod.value)} m`);
    }
  }

  return { statsLine: statsParts.length > 0 ? statsParts.join(" · ") : null, lifespan, traitsLine };
}

/**
 * Etape 1 (specs/wiki-liens-et-personnages.md §B8), en boutons plutot qu'un
 * menu deroulant (demande explicite, meme motif que `LevelClassesStep`) :
 * type/taille/vitesse/esperance de vie/traits directement visibles sur
 * chaque bouton (retour utilisateur, V2-G1). La fiche de l'espece de base et
 * celle de la lignee choisie restent visibles SIMULTANEMENT (retour
 * utilisateur) : la fiche de base s'affiche des qu'une espece de base est
 * choisie, les boutons de lignee apparaissent en dessous d'elle, et choisir
 * une lignee ajoute sa propre fiche encore en dessous plutot que de
 * remplacer celle de l'espece. Espece de base et lignees (sous-especes)
 * sont un seul et meme `entry_type: "species"` cote donnees (`parentSpeciesKey` les distingue,
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
  const lineageSelected = currentKey !== "" && currentKey !== expandedTopLevelKey;

  function select(key: string) {
    patchCharacter({ species: { kind: "rule", key } });
  }

  function detailPanel(key: string) {
    const blocks = blocksByKey[key];
    if (!blocks || blocks.length === 0) return null;
    return (
      <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
        {blocks
          .filter((b) => b.blockType === "description" || b.blockType === "species_traits")
          .map((b, i) => (
            <div key={i}>{renderBlockData(b.blockType as BlockType, b.data, worldSlug)}</div>
          ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {topLevel.map((e) => (
          <SpeciesButton key={e.key} entry={e} info={speciesCardInfo(blocksByKey[e.key])} isSelected={e.key === expandedTopLevelKey} onSelect={select} />
        ))}
      </div>

      {expandedTopLevelKey && detailPanel(expandedTopLevelKey)}

      {/* Boutons de lignee sous la fiche de l'espece de base (retour
          utilisateur, V2-G1) : choisir une lignee AJOUTE sa propre fiche en
          dessous plutot que de remplacer celle de l'espece — les deux
          restent visibles a la fois. */}
      {lineages.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Lignées</span>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {lineages.map((e) => (
              <SpeciesButton key={e.key} entry={e} info={speciesCardInfo(blocksByKey[e.key])} isSelected={e.key === currentKey} onSelect={select} />
            ))}
          </div>
        </div>
      )}

      {lineageSelected && detailPanel(currentKey)}
    </div>
  );
}

function SpeciesButton({
  entry,
  info,
  isSelected,
  onSelect,
}: {
  entry: { key: string; name: string };
  info: SpeciesCardInfo | null;
  isSelected: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key)}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
        isSelected ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
      }`}
    >
      <span className="text-sm font-semibold text-ink">{entry.name}</span>
      {info?.statsLine && <span className="text-[10px] text-ink-muted">{info.statsLine}</span>}
      {info?.lifespan && <span className="text-[10px] text-ink-muted">{info.lifespan}</span>}
      {info?.traitsLine && <span className="text-[10px] text-ink-muted">{info.traitsLine}</span>}
    </button>
  );
}
