import type { Viewer } from "@/src/core/visibility/types";

const EDITOR_WORLD_ROLES = new Set<string>(["owner", "editor"]);

/**
 * Ce que le service appelant doit avoir deja resolu par requete — cette
 * fonction reste pure (specs/module-joueur-et-solo.md §A2), sans acces base.
 */
export interface CanEditEntityContext {
  /** Vrai si cette entite EST le personnage que ce joueur a revendique dans une campagne de ce monde (`campaign_characters.user_id`). */
  isOwnCharacter: boolean;
  /** Vrai si une ligne `entity_grants` autorise explicitement ce joueur sur cette entite. */
  isGranted: boolean;
}

/**
 * Autorisation d'ECRITURE sur une entite (V2-M3, Lot M) — jamais confondue
 * avec `canSee` (LECTURE, dossier voisin `visibility/`). Quatre cas, et
 * rien d'autre :
 *
 * 1. Proprietaire ou editeur du MONDE (`worldRole`) — memes roles que
 *    `ADMIN_WORLD_ROLES` dans `canSee.ts`.
 * 2. MJ d'une campagne de ce monde (`campaignRoles` contient "gm") — sans
 *    ce cas, le flux d'invitation par email deja existant
 *    (`inviteCampaignMember`, qui n'ecrit QUE dans `campaign_members`,
 *    jamais dans `world_members`) casserait l'ecriture d'un co-MJ invite
 *    qui n'est pas proprietaire/editeur du monde — pas dans la liste du
 *    ticket a l'origine, ajoute en verifiant les appelants reels.
 * 3. C'est SA PROPRE fiche PJ dans une campagne de ce monde.
 * 4. Une ligne `entity_grants` l'autorise explicitement sur cette entite.
 *
 * Un visiteur anonyme n'ecrit jamais rien.
 */
export function canEditEntity(viewer: Viewer, ctx: CanEditEntityContext): boolean {
  if (viewer.kind === "anonymous") return false;
  if (viewer.worldRole && EDITOR_WORLD_ROLES.has(viewer.worldRole)) return true;
  if (Object.values(viewer.campaignRoles).includes("gm")) return true;
  return ctx.isOwnCharacter || ctx.isGranted;
}
