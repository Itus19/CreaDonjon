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
  /** Vrai si cette entite est de type `notes` ET a ete creee par ce viewer (`entities.created_by`) — V2-M7b, coquille joueur : une fiche de notes privee, jamais visible d'un autre compte (voir `getEntityTree`). */
  isOwnPrivateNotes: boolean;
}

/**
 * Autorisation d'ECRITURE sur une entite (V2-M3, Lot M ; 5e cas V2-M7b) —
 * jamais confondue avec `canSee` (LECTURE, dossier voisin `visibility/`).
 * Cinq cas, et rien d'autre :
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
 * 5. C'est SA PROPRE fiche de notes privee (`entity_kind = 'notes'`,
 *    `created_by = auth.uid()`) — sans ce cas, `entities_insert` (deja
 *    ouvert a tout membre du monde) laisserait un joueur creer sa fiche de
 *    notes mais jamais y toucher ensuite : aucun des quatre cas ci-dessus
 *    ne couvre "je l'ai creee moi-meme".
 *
 * Il y a eu un 6e cas (V2.1-3) : sa propre entree du Livre de sessions.
 * Retire en V2.1-15 — un droit en dur ici est un droit que le MJ ne peut
 * pas reprendre, et il n'apparaissait nulle part dans « Octrois d'edition ».
 * L'autrice recoit desormais une vraie ligne `entity_grants` a la creation
 * de son entree (`app.claim_journal_entry_grant`), donc le cas 4 la couvre
 * — et le bouton « Retirer » de l'outil de gestion de campagne fonctionne
 * sur elle comme sur n'importe quel autre octroi.
 *
 * Le cas 5 (notes) ne pouvait pas suivre le meme chemin : une fiche de
 * notes privee n'est visible d'aucun autre compte, donc aucun MJ n'a
 * d'octroi a lui accorder ni a lui reprendre.
 *
 * Un visiteur anonyme n'ecrit jamais rien.
 */
export function canEditEntity(viewer: Viewer, ctx: CanEditEntityContext): boolean {
  if (viewer.kind === "anonymous") return false;
  if (viewer.worldRole && EDITOR_WORLD_ROLES.has(viewer.worldRole)) return true;
  if (Object.values(viewer.campaignRoles).includes("gm")) return true;
  return ctx.isOwnCharacter || ctx.isGranted || ctx.isOwnPrivateNotes;
}
