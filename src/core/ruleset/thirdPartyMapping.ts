import type { EntryType } from "../schemas/rule-blocks/entry-types";

/**
 * Forme de sortie de l'assistant de correspondance (V2-J4,
 * specs/arbitrage-modifications.md §1.2, "assistant de correspondance...
 * l'utilisateur associe les champs, on n'ecrit pas trente convertisseurs").
 * Duplique volontairement `ImportRulesetEntryInput`
 * (src/server/services/rules.ts) plutot que de l'importer — src/core
 * n'importe jamais depuis src/server (CLAUDE.md regle 19). Meme forme,
 * un seul bloc `description` par entree : jamais de tentative de deviner
 * des blocs structures (arme/armure/etc.) a partir d'un format tiers
 * inconnu, l'auteur enrichit ensuite a la main.
 */
export interface MappedRulesetEntry {
  name: string;
  entry_type: EntryType;
  blocks: [{ block_type: "description"; data: { segments: { text: string }[] } }];
}

export interface ThirdPartyFieldMapping {
  /** Cle du champ source a utiliser comme nom de l'entree — une entree sans valeur non vide a cette cle est ecartee. */
  nameKey: string;
  /** Cle(s) du champ source concatenees (une ligne par cle presente et non vide) pour former l'unique bloc description. */
  descriptionKeys: string[];
  /** Un seul type pour tout le lot — l'utilisateur trie/repete l'import s'il a plusieurs types dans un meme fichier, pas de detection automatique. */
  entryType: EntryType;
}

/**
 * Normalise un lot d'enregistrements JSON tiers (un tableau d'objets a plat,
 * cles arbitraires) vers `MappedRulesetEntry[]`, prets pour le meme chemin
 * d'import que "notre format" (V2-J4). Un enregistrement dont `nameKey` est
 * absent, non-textuel ou vide (apres `trim`) est ecarte plutot que de
 * produire une entree sans nom — meme discipline que `importRulesetEntries`
 * cote serveur, qui ecarte deja une entree individuellement invalide sans
 * bloquer les autres.
 */
export function mapThirdPartyEntries(records: Record<string, unknown>[], mapping: ThirdPartyFieldMapping): MappedRulesetEntry[] {
  const entries: MappedRulesetEntry[] = [];

  for (const record of records) {
    const rawName = record[mapping.nameKey];
    if (typeof rawName !== "string" || rawName.trim() === "") continue;

    const descriptionLines = mapping.descriptionKeys
      .map((key) => record[key])
      .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .map((value) => value.trim());

    entries.push({
      name: rawName.trim(),
      entry_type: mapping.entryType,
      blocks: [{ block_type: "description", data: { segments: descriptionLines.map((text) => ({ text })) } }],
    });
  }

  return entries;
}
