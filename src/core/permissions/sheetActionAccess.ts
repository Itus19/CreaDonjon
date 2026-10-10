import { mayPlayerChange, type CampaignTableSettings, type PlayerEditableField } from "../campaigns/tableSettings";

/**
 * V3.1-108 (ADR 0043) — Qui peut agir sur une fiche par ses routes
 * `/api/entities/[id]/actions/**` ?
 *
 * 1. Celui qui peut l'editer (`canEditEntity` : MJ, PJ revendique, octroi).
 * 2. La campagne envoyee dans le corps doit etre une campagne du monde de
 *    la fiche : sinon une joueuse choisirait une campagne ou les
 *    interrupteurs sont ouverts (la sienne, ailleurs) pour les contourner.
 * 3. Un geste manuel sur un champ regle (`field`) passe par l'interrupteur
 *    de la campagne, sauf pour le MJ. Hors campagne (fiche d'essai), il n'y
 *    a pas de table, donc pas d'interrupteur.
 *
 * « Refuse » est rendu avant « introuvable » pour la campagne : une joueuse
 * sans droit n'apprend rien de la campagne qu'elle a nommee.
 */
export type SheetActionAccess = "ok" | "forbidden" | "not_found" | "switch_off";

export function decideSheetActionAccess(params: {
  /** `null` : fiche introuvable ou invisible de l'appelant (RLS). */
  entityWorldId: string | null;
  callerCanEdit: boolean;
  callerIsGm: boolean;
  /** Absent : aucune campagne envoyee. `null` : envoyee mais introuvable. */
  campaign?: { worldId: string } | null;
  /** Champ regle que le geste modifie a la main ; absent pour un jet ou un geste du moteur. */
  field?: PlayerEditableField;
  settings: CampaignTableSettings;
}): SheetActionAccess {
  if (params.entityWorldId === null) return "not_found";
  if (!params.callerCanEdit) return "forbidden";
  if (params.campaign === undefined) return "ok";
  if (params.campaign === null || params.campaign.worldId !== params.entityWorldId) return "not_found";
  if (params.field && !mayPlayerChange(params.field, params.settings, { callerIsGm: params.callerIsGm })) return "switch_off";
  return "ok";
}
