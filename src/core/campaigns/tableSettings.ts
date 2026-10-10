import { z } from "zod";

/**
 * V3.1-108 (ADR 0036 §5, ADR 0043) — « Ce que les joueurs modifient
 * eux-memes » : les reglages de table d'une campagne (`campaigns.table_settings`).
 *
 * Six interrupteurs, un par champ de l'etat de jeu qu'une joueuse peut
 * changer a la main sur sa fiche. Ils ne concernent que les gestes manuels :
 * le moteur (repos, resolution) ecrit ces memes champs sans les consulter.
 * Le MJ n'est jamais concerne.
 */
export const PLAYER_EDITABLE_FIELDS = ["conditions", "inspiration", "hp", "currency", "spell_slots", "hit_dice"] as const;
export type PlayerEditableField = (typeof PLAYER_EDITABLE_FIELDS)[number];

export interface CampaignTableSettings {
  inspiration_max: number;
  player_can_edit: Record<PlayerEditableField, boolean>;
}

/** Decides par l'auteur le 4 octobre : etats et inspiration au MJ, le reste a la joueuse. */
export const DEFAULT_TABLE_SETTINGS: CampaignTableSettings = {
  inspiration_max: 1,
  player_can_edit: { conditions: false, inspiration: false, hp: true, currency: true, spell_slots: true, hit_dice: true },
};

/** Schema d'ECRITURE : partiel (un reglage a la fois), strict (aucune cle inconnue), bornes. */
export const zCampaignTableSettings = z
  .object({
    inspiration_max: z.number().int().min(1).max(5).optional(),
    player_can_edit: z
      .object(Object.fromEntries(PLAYER_EDITABLE_FIELDS.map((f) => [f, z.boolean().optional()])) as Record<PlayerEditableField, z.ZodOptional<z.ZodBoolean>>)
      .strict()
      .optional(),
  })
  .strict();
export type CampaignTableSettingsPatch = z.infer<typeof zCampaignTableSettings>;

/**
 * LECTURE de la colonne : complete champ par champ avec les defauts. Une
 * valeur illisible (ecrite a la main en base) retombe sur les defauts, qui
 * sont restrictifs pour ce qui compte (etats, inspiration) — jamais sur
 * « tout permis ».
 */
export function parseTableSettings(raw: unknown): CampaignTableSettings {
  const source = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const max = source.inspiration_max;
  const edits = source.player_can_edit !== null && typeof source.player_can_edit === "object" ? (source.player_can_edit as Record<string, unknown>) : {};
  return {
    inspiration_max: typeof max === "number" && Number.isInteger(max) && max >= 1 && max <= 5 ? max : DEFAULT_TABLE_SETTINGS.inspiration_max,
    player_can_edit: Object.fromEntries(
      PLAYER_EDITABLE_FIELDS.map((f) => [f, typeof edits[f] === "boolean" ? (edits[f] as boolean) : DEFAULT_TABLE_SETTINGS.player_can_edit[f]])
    ) as Record<PlayerEditableField, boolean>,
  };
}

/** Applique un reglage partiel sur les reglages courants (route d'ecriture du MJ). */
export function mergeTableSettings(current: CampaignTableSettings, patch: CampaignTableSettingsPatch): CampaignTableSettings {
  return {
    inspiration_max: patch.inspiration_max ?? current.inspiration_max,
    player_can_edit: Object.fromEntries(
      PLAYER_EDITABLE_FIELDS.map((f) => [f, patch.player_can_edit?.[f] ?? current.player_can_edit[f]])
    ) as Record<PlayerEditableField, boolean>,
  };
}

export function mayPlayerChange(field: PlayerEditableField, settings: CampaignTableSettings, caller: { callerIsGm: boolean }): boolean {
  return caller.callerIsGm || settings.player_can_edit[field];
}
