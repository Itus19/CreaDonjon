"use client";

import { useTranslations } from "next-intl";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { CustomTableBlockData, SpeciesTraitsBlockData } from "@/src/core/schemas/rule-blocks";
import { mapSpeciesModifiers, parseCustomTableFields, type CustomTableRow } from "@/src/core/rules/srdMapping";
import { ftToM } from "@/src/core/rules/encumbrance";
import { CREATURE_TYPE_LABELS_FR, SIZE_LABELS_FR } from "@/src/i18n/fr";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";
import FicheSelection, { type LigneFiche } from "../characterCreator/FicheSelection";

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

interface SpeciesCardInfo {
  statsLine: string | null;
  lifespan: string | null;
  traits: LigneFiche[];
}

type TraitResolu = { key: string; resolved_name?: string; resolved_description?: string };

/** La première phrase, pour tenir sur une ligne. */
function premierePhrase(texte: string | undefined): string | undefined {
  if (!texte) return undefined;
  const fin = texte.search(/[.!?](\s|$)/);
  return (fin === -1 ? texte : texte.slice(0, fin + 1)).trim();
}

/**
 * Type, taille, vitesse, bonus de caracteristique, esperance de vie et
 * traits d'une espece (retour utilisateur, V2-G1). `species_traits`
 * (type/taille/vitesse/esperance de vie/traits, deja resolu cote serveur —
 * `listRuleEntryBlocksByKeys`) plutot que `custom_table` pour ces champs ;
 * `custom_table` reste la seule source du bonus de caracteristique
 * (`mapSpeciesModifiers`, absent de `species_traits`). Jamais le resume fige
 * `ai_digest` (anglais, en pieds).
 */
function speciesCardInfo(blocks: RuleEntryBlockData[] | undefined): SpeciesCardInfo | null {
  const table = blocks?.find((b) => b.blockType === "custom_table");
  const traitsBlock = blocks?.find((b) => b.blockType === "species_traits");
  if (!table && !traitsBlock) return null;

  const statsParts: string[] = [];
  let lifespan: string | null = null;
  const traits: LigneFiche[] = [];

  if (traitsBlock) {
    const data = traitsBlock.data as SpeciesTraitsBlockData;
    if (data.creature_type) statsParts.push(CREATURE_TYPE_LABELS_FR[data.creature_type] ?? data.creature_type);
    if (data.sizes && data.sizes.length > 0) statsParts.push(data.sizes.map((s) => SIZE_LABELS_FR[s.label] ?? s.label).join("/"));
    if (data.speed?.value !== undefined) statsParts.push(`${ftToM(data.speed.value)} m`);
    lifespan = data.lifespan ?? null;
    for (const tr of data.traits as unknown as TraitResolu[]) traits.push({ nom: tr.resolved_name ?? tr.key, texte: premierePhrase(tr.resolved_description) });
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

  return { statsLine: statsParts.length > 0 ? statsParts.join(" · ") : null, lifespan, traits };
}

/**
 * Etape 1 (specs/wiki-liens-et-personnages.md §B8). V3.1-50 : les especes en
 * petites cartes (trois par ligne, deux quand le conteneur est etroit),
 * dessous la fiche de la selection — traits en une ligne chacun, puis
 * « Ce qui en nait » en pastilles qui menent aux sous-etapes.
 *
 * La fiche de l'espece de base et celle de la lignee choisie restent
 * visibles SIMULTANEMENT (retour utilisateur, V2-G1) : les cartes de lignee
 * apparaissent sous la fiche de base, et choisir une lignee ajoute sa propre
 * fiche en dessous. Espece de base et lignees (sous-especes) sont un seul et
 * meme `entry_type: "species"` (`parentSpeciesKey` les distingue). Les choix
 * que l'espece fait naitre (`sousEtapes`) sont ceux de la selection entiere :
 * ils se rangent sous la fiche de la lignee si elle est choisie, sinon sous
 * celle de l'espece.
 */
export default function SpeciesStep({
  worldSlug,
  character,
  patchCharacter,
  sousEtapes,
  onAller,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  /** Les sous-étapes de l'étape Espèce, venues du chemin. */
  sousEtapes: readonly SousEtape[];
  onAller: (position: string) => void;
}) {
  const t = useTranslations("creation.origines");
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

  function fiche(key: string, avecNaissances: boolean) {
    const entry = speciesEntries.find((e) => e.key === key);
    const info = speciesCardInfo(blocksByKey[key]);
    if (!entry) return null;
    return (
      <FicheSelection
        titre={entry.name}
        resume={[info?.statsLine, info?.lifespan].filter(Boolean).join(" · ") || null}
        lignes={info?.traits ?? []}
        naissent={avecNaissances ? sousEtapes : []}
        onAller={onAller}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 @lg/creation:grid-cols-3">
        {topLevel.map((e) => (
          <SpeciesButton key={e.key} entry={e} info={speciesCardInfo(blocksByKey[e.key])} isSelected={e.key === expandedTopLevelKey} onSelect={select} />
        ))}
      </div>

      {expandedTopLevelKey && fiche(expandedTopLevelKey, !lineageSelected)}

      {lineages.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("lignees")}</span>
          <div className="grid grid-cols-2 gap-2 @lg/creation:grid-cols-3">
            {lineages.map((e) => (
              <SpeciesButton key={e.key} entry={e} info={speciesCardInfo(blocksByKey[e.key])} isSelected={e.key === currentKey} onSelect={select} />
            ))}
          </div>
        </div>
      )}

      {lineageSelected && fiche(currentKey, true)}
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
      aria-pressed={isSelected}
      onClick={() => onSelect(entry.key)}
      className={`flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
        isSelected ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
      }`}
    >
      <span className="text-sm font-semibold text-ink">{entry.name}</span>
      {info?.statsLine && <span className="w-full truncate text-xs text-ink-muted">{info.statsLine}</span>}
    </button>
  );
}
