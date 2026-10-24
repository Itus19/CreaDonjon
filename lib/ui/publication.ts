import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import type { WikiBackgroundInput } from "@/src/core/theme/worldWikiBackground";

/** Longueur maximale du message d'accueil (la même que l'action serveur). */
export const MESSAGE_ACCUEIL_MAX = 500;

/** Le grand titre de la page d'accueil publique : le message s'il y en a un, sinon le nom de la campagne. */
export function titreApercu(message: string, campaignName: string): string {
  return message.trim() || campaignName;
}

/**
 * Le petit sommaire de l'aperçu : les premiers groupes du sommaire public, les
 * premières entrées de chacun, leurs noms seulement. Un groupe vide est sauté.
 */
export function sommaireApercu(arbre: readonly EntityTreeGroup[], groupes = 3, entrees = 3): string[][] {
  return arbre
    .filter((groupe) => groupe.items.length > 0)
    .slice(0, groupes)
    .map((groupe) => groupe.items.slice(0, entrees).map((noeud) => noeud.name));
}

/** Le flou de l'aperçu est réduit : le cadre est bien plus petit que la page réelle. */
export function flouApercuPx(blur: number): number {
  return blur * 0.35;
}

/**
 * Envoie le fond par défaut du wiki (`PUT /api/worlds/[slug]/wiki-background`).
 * Rend le message d'erreur du serveur (ou `repli`), `null` si tout va bien.
 * Hors du composant : l'écran ne charge rien après son affichage, il enregistre
 * seulement (docs/CABLAGE.md C1).
 */
export async function enregistrerFondWiki(worldSlug: string, corps: WikiBackgroundInput, repli: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/worlds/${worldSlug}/wiki-background`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? repli;
  } catch (e) {
    console.error("Enregistrement du fond du wiki impossible", e);
    return repli;
  }
}
