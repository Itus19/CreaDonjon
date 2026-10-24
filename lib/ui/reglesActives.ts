import {
  DEFAULT_TABLE_SETTINGS,
  PLAYER_EDITABLE_FIELDS,
  type CampaignTableSettings,
  type CampaignTableSettingsPatch,
  type PlayerEditableField,
} from "@/src/core/campaigns/tableSettings";

/** Ce que l'écran sait d'un ruleset (une ligne de `SelectableRulesetRow`, sans le serveur). */
export interface RulesetListe {
  id: string;
  name: string;
  is_official_base: boolean;
  parent_ruleset_id: string | null;
  content_origin: string;
}

/** Une ligne de l'arbre : le ruleset, sa profondeur (0 = base) et s'il est le dernier de sa fratrie (trait de rattachement). */
export interface LigneArbre<T extends RulesetListe> {
  ruleset: T;
  profondeur: number;
  dernier: boolean;
}

/**
 * Range les rulesets en arbre : chaque base officielle, puis ses variantes en
 * dessous (et les variantes de variantes), dans l'ordre reçu. Une variante dont
 * le parent n'est pas dans la liste (parent d'un autre utilisateur) retombe à la racine.
 */
export function arbreRulesets<T extends RulesetListe>(options: readonly T[]): LigneArbre<T>[] {
  const ids = new Set(options.map((o) => o.id));
  const enfantsDe = (parentId: string | null) =>
    options.filter((o) => (parentId === null ? o.parent_ruleset_id === null || !ids.has(o.parent_ruleset_id) : o.parent_ruleset_id === parentId));
  const lignes: LigneArbre<T>[] = [];
  const vus = new Set<string>();
  const descendre = (parentId: string | null, profondeur: number) => {
    const fratrie = enfantsDe(parentId).filter((o) => !vus.has(o.id));
    fratrie.forEach((ruleset, i) => {
      vus.add(ruleset.id);
      lignes.push({ ruleset, profondeur, dernier: i === fratrie.length - 1 });
      descendre(ruleset.id, profondeur + 1);
    });
  };
  descendre(null, 0);
  return lignes;
}

/** « Exporter » : une variante, jamais une base officielle ni une référence personnelle (qui ne repart jamais en copie). */
export function peutExporter(ruleset: Pick<RulesetListe, "is_official_base" | "content_origin">): boolean {
  return !ruleset.is_official_base && ruleset.content_origin !== "personal_reference";
}

/** Le nom de la base à laquelle la campagne revient si on supprime `id` alors qu'elle est active ; `null` si inconnue. */
export function baseDeRetour(options: readonly RulesetListe[], id: string): RulesetListe | null {
  const parentId = options.find((o) => o.id === id)?.parent_ruleset_id ?? null;
  return parentId ? (options.find((o) => o.id === parentId) ?? null) : null;
}

/** Les six interrupteurs, dans l'ordre de la planche. */
export const INTERRUPTEURS_TABLE: readonly PlayerEditableField[] = PLAYER_EDITABLE_FIELDS;

/** « Par défaut » : un seul patch complet, les six réglages ET l'inspiration au plus. */
export function reglagesParDefaut(): CampaignTableSettings {
  return { inspiration_max: DEFAULT_TABLE_SETTINGS.inspiration_max, player_can_edit: { ...DEFAULT_TABLE_SETTINGS.player_can_edit } };
}

/** L'inspiration au plus reste entre 1 et 5 (bornes du schéma d'écriture). */
export function bornerInspirationMax(valeur: number): number {
  return Math.min(5, Math.max(1, valeur));
}

/**
 * Envoie un réglage de table (`PUT /api/campaigns/[id]/table-settings`).
 * Rend le message d'erreur du serveur (ou `repli`), `null` si tout va bien.
 * Hors du composant (docs/CABLAGE.md C1) : l'écran ne charge rien après son
 * affichage, il enregistre seulement.
 */
export async function enregistrerReglagesTable(campaignId: string, patch: CampaignTableSettingsPatch, repli: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/table-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? repli;
  } catch (e) {
    console.error("Enregistrement des réglages de table impossible", e);
    return repli;
  }
}
