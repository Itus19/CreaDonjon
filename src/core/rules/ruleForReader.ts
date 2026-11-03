/**
 * V3.1-95 (règle 5) — Une fiche de règle telle qu'un JOUEUR la reçoit. Le
 * filtrage se fait au serveur, avant l'envoi : jamais une donnée envoyée puis
 * cachée à l'écran. Un joueur ne reçoit :
 * - ni les données brutes du SRD (tables d'import, progressions) ;
 * - ni la donnée officielle d'avant une variante (`originalData`) ;
 * - ni les marques destinées au MJ (blocs modifiés, version maison).
 * Il lit les règles de sa table : `tableRule` dit seulement qu'elle diffère
 * de l'officielle (badge « Règle de la table »).
 */

/** Les blocs de données brutes, réservés au MJ. */
export const RAW_DATA_BLOCK_TYPES: ReadonlySet<string> = new Set(["custom_table", "class_progression", "spellcasting_progression"]);

export function ruleEntryForPlayer<
  T extends {
    blocks: { blockType: string; originalData?: unknown }[];
    modifiedBlockTypes: string[];
    houseVersion: boolean;
  },
>(entry: T): T & { tableRule: boolean } {
  const tableRule = entry.modifiedBlockTypes.length > 0 || entry.houseVersion;
  return {
    ...entry,
    blocks: entry.blocks
      .filter((b) => !RAW_DATA_BLOCK_TYPES.has(b.blockType))
      .map((b) => {
        const { originalData: _cache, ...reste } = b;
        void _cache;
        return reste as typeof b;
      }),
    modifiedBlockTypes: [],
    houseVersion: false,
    tableRule,
  };
}
