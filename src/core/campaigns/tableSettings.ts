import { z } from "zod";
import { zPlayStyle, type PlayStyle } from "../remote/feed";

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
  /**
   * ADR 0103 — la façon de jouer : à table, à distance, ou les deux. Elle ne
   * règle que ce que l'app montre. Absente du schéma d'écriture ci-dessous :
   * elle ne change que par sa route à elle, avec confirmation, jamais au
   * passage d'un autre réglage.
   */
  play_style: PlayStyle;
  /**
   * AG-10 — la campagne se sert du niveau de visibilité « Joueurs ». Coupé,
   * l'interface ne le propose plus (le contenu déjà « Joueurs » le garde) ;
   * rien ne change côté base ni filtrage.
   */
  players_level: boolean;
  player_can_edit: Record<PlayerEditableField, boolean>;
  /**
   * AG-14 — les PJ « en réserve » (identifiants d'entité) : un PJ invité qui
   * n'est pas toujours là. Rien n'est supprimé : l'outil Table replie leur
   * carte et « Toute la table » ne les coche plus d'office.
   */
  reserve: string[];
  /**
   * V3.2-20 — le solo montre-t-il le DD (ou la CA) et l'issue d'un jet ?
   * Coupé par défaut (décision de l'auteur, 25 novembre) : c'est le récit qui
   * dit si l'on a réussi. Ce n'est que de l'affichage : le moteur calcule
   * toujours l'issue et la donne au narrateur (règle absolue 8).
   */
  solo_show_outcome: boolean;
}

/** Decides par l'auteur le 4 octobre : etats et inspiration au MJ, le reste a la joueuse. */
export const DEFAULT_TABLE_SETTINGS: CampaignTableSettings = {
  inspiration_max: 1,
  play_style: "table",
  players_level: true,
  player_can_edit: { conditions: false, inspiration: false, hp: true, currency: true, spell_slots: true, hit_dice: true },
  reserve: [],
  solo_show_outcome: false,
};

/** Une campagne compte quelques PJ : la borne protège seulement la colonne d'une écriture démesurée. */
const RESERVE_MAX = 50;

/** Schema d'ECRITURE : partiel (un reglage a la fois), strict (aucune cle inconnue), bornes. */
export const zCampaignTableSettings = z
  .object({
    inspiration_max: z.number().int().min(1).max(5).optional(),
    players_level: z.boolean().optional(),
    player_can_edit: z
      .object(Object.fromEntries(PLAYER_EDITABLE_FIELDS.map((f) => [f, z.boolean().optional()])) as Record<PlayerEditableField, z.ZodOptional<z.ZodBoolean>>)
      .strict()
      .optional(),
    /** AG-14 : la liste entière, écrite d'un bloc. */
    reserve: z.array(z.string().uuid()).max(RESERVE_MAX).optional(),
    /** V3.2-20 : DD et issue des jets, visibles ou non dans le solo. */
    solo_show_outcome: z.boolean().optional(),
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
    play_style: zPlayStyle.safeParse(source.play_style).data ?? DEFAULT_TABLE_SETTINGS.play_style,
    players_level: typeof source.players_level === "boolean" ? source.players_level : DEFAULT_TABLE_SETTINGS.players_level,
    player_can_edit: Object.fromEntries(
      PLAYER_EDITABLE_FIELDS.map((f) => [f, typeof edits[f] === "boolean" ? (edits[f] as boolean) : DEFAULT_TABLE_SETTINGS.player_can_edit[f]])
    ) as Record<PlayerEditableField, boolean>,
    reserve: lireReserve(source.reserve),
    solo_show_outcome: typeof source.solo_show_outcome === "boolean" ? source.solo_show_outcome : DEFAULT_TABLE_SETTINGS.solo_show_outcome,
  };
}

function lireReserve(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  const ids = valeur.filter((v): v is string => typeof v === "string" && z.string().uuid().safeParse(v).success);
  return [...new Set(ids)].slice(0, RESERVE_MAX);
}

/** AG-14 : ce PJ est-il en réserve ? */
export function estEnReserve(settings: CampaignTableSettings, entityId: string): boolean {
  return settings.reserve.includes(entityId);
}

/** Applique un reglage partiel sur les reglages courants (route d'ecriture du MJ). */
export function mergeTableSettings(current: CampaignTableSettings, patch: CampaignTableSettingsPatch): CampaignTableSettings {
  return {
    inspiration_max: patch.inspiration_max ?? current.inspiration_max,
    play_style: current.play_style,
    players_level: patch.players_level ?? current.players_level,
    player_can_edit: Object.fromEntries(
      PLAYER_EDITABLE_FIELDS.map((f) => [f, patch.player_can_edit?.[f] ?? current.player_can_edit[f]])
    ) as Record<PlayerEditableField, boolean>,
    reserve: patch.reserve ? [...new Set(patch.reserve)] : current.reserve,
    solo_show_outcome: patch.solo_show_outcome ?? current.solo_show_outcome,
  };
}

export function mayPlayerChange(field: PlayerEditableField, settings: CampaignTableSettings, caller: { callerIsGm: boolean }): boolean {
  return caller.callerIsGm || settings.player_can_edit[field];
}

/**
 * V3.1-109 — les commandes que la fiche montre à SON lecteur : un champ dont
 * l'interrupteur est coupé se voit, sans commande. Le MJ garde tout. Hors
 * campagne (`settings` null : fiche d'essai, état « hors partie »), il n'y a
 * pas de table, donc rien à couper. Indication d'interface : le serveur
 * refuse de toute façon le geste (`decideSheetActionAccess`).
 */
export function sheetControls(settings: CampaignTableSettings | null, caller: { callerIsGm: boolean }): Record<PlayerEditableField, boolean> {
  return Object.fromEntries(
    PLAYER_EDITABLE_FIELDS.map((f) => [f, settings === null || mayPlayerChange(f, settings, caller)])
  ) as Record<PlayerEditableField, boolean>;
}

/** ADR 0103 — change la seule façon de jouer, en gardant tout le reste. */
export function withPlayStyle(current: CampaignTableSettings, playStyle: PlayStyle): CampaignTableSettings {
  return { ...current, play_style: playStyle };
}

/** L'écran « Jeu à distance » existe pour cette campagne. */
export function showsRemotePlay(settings: CampaignTableSettings): boolean {
  return settings.play_style !== "table";
}
