import type { MusicBlockData } from "@/src/core/schemas/blocks/music";

/**
 * V2.1-6 — sur les pages de lecture, un bloc `music` ne s'affiche plus : il
 * sort du fil des blocs et ne laisse qu'un bouton lecture/pause, pose a cote
 * du NOM DE LA FICHE, tout en haut.
 *
 * Le premier jet accrochait le bouton au titre du bloc precedent ; l'auteur
 * a tranche pour le titre de la fiche ("c'est plus simple et coherent"), ce
 * qui supprime du meme coup tous les cas limites de la premiere approche —
 * bloc musique en tete de fiche, bloc precedent sans titre affiche, bloc
 * precedent sans libelle. Un endroit, toujours le meme, quel que soit
 * l'endroit ou le bloc a ete range dans la fiche.
 *
 * Ce fichier ne calcule que le PLAN (quels boutons, lequel demarre a la
 * visite) ; le rendu appartient a `PublicEntityBody` et `PublicMusicToggle`.
 * La partie qui merite d'etre ici est l'arbitrage de la lecture automatique :
 * elle s'eprouve en millisecondes, alors qu'elle demanderait un wiki publie
 * et un navigateur si elle restait dans un composant serveur.
 */

/** Forme minimale d'un bloc pour ce calcul — `PublicBlock` (serveur) la satisfait, sans que le noyau ait a en dependre. */
export interface MusicAttachmentBlock {
  id: string;
  blockType: string;
  display: { label: string };
  data: unknown;
}

export interface MusicAttachment {
  blockId: string;
  trackId: string;
  trackUrl: string;
  /** `display.label` du bloc musique, c'est-a-dire le nom de la station. */
  label: string;
  autoplay: boolean;
}

export function planMusicAttachments<T extends MusicAttachmentBlock>(
  blocks: T[]
): { contentBlocks: T[]; attachments: MusicAttachment[] } {
  const contentBlocks: T[] = [];
  const attachments: MusicAttachment[] = [];
  let autoplayTaken = false;

  for (const block of blocks) {
    if (block.blockType !== "music") {
      contentBlocks.push(block);
      continue;
    }

    const data = block.data as Partial<MusicBlockData>;
    const track = data.tracks?.[0];
    // Un bloc vide n'a rien a lancer : aucun bouton, et il ne consomme pas
    // le droit de demarrer a la visite — sinon un bloc oublie en haut de
    // fiche empecherait silencieusement le bloc suivant de jouer.
    if (!track) continue;

    // Le lecteur partage n'a qu'une source a la fois : si plusieurs blocs de
    // la fiche demandent la lecture a la visite, le premier dans l'ordre de
    // la fiche gagne. Laisser les composants se la disputer donnerait un
    // resultat dependant de l'ordre de montage, c'est-a-dire imprevisible.
    const autoplay = !autoplayTaken && data.autoplayOnVisit === true;
    if (autoplay) autoplayTaken = true;

    attachments.push({
      blockId: block.id,
      trackId: track.id,
      trackUrl: track.url,
      label: block.display.label,
      autoplay,
    });
  }

  return { contentBlocks, attachments };
}
