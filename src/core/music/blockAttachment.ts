import type { MusicBlockData, MusicTrack } from "@/src/core/schemas/blocks/music";

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
 * Ce fichier ne calcule que le PLAN (quelles pistes, quels fondus, lequel
 * demarre a la visite) ; le rendu appartient a `PublicEntityBody` et
 * `PublicMusicToggle`. La partie qui merite d'etre ici est l'arbitrage de la
 * lecture automatique : elle s'eprouve en millisecondes, alors qu'elle
 * demanderait un wiki publie et un navigateur si elle restait dans un
 * composant serveur.
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
  /** Toutes les pistes du bloc, dans l'ordre : le lecteur pilote les enchaine (lot 2), le repli iframe ne joue que la premiere. */
  tracks: MusicTrack[];
  /** `display.label` du bloc musique, c'est-a-dire le nom de la station. */
  label: string;
  autoplay: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  /** Arrive au bout de la liste, le bloc repart de sa premiere piste. */
  loop: boolean;
}

/**
 * Defauts appliques quand le champ manque — c'est-a-dire pour les blocs poses
 * avant le lot 2, que rien n'a revalides depuis. Ils reprennent ceux du
 * schema : un bloc ancien se comporte comme un bloc neuf, jamais comme un
 * bloc au fondu eteint.
 */
const FADE_IN_PAR_DEFAUT = 1500;
const FADE_OUT_PAR_DEFAUT = 1500;

function borneFondu(valeur: number | undefined, defaut: number): number {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return defaut;
  return Math.min(5000, Math.max(0, Math.round(valeur)));
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
    const tracks = data.tracks ?? [];
    // Un bloc vide n'a rien a lancer : aucun bouton, et il ne consomme pas
    // le droit de demarrer a la visite — sinon un bloc oublie en haut de
    // fiche empecherait silencieusement le bloc suivant de jouer.
    if (tracks.length === 0) continue;

    // Le lecteur partage n'a qu'une source active a la fois : si plusieurs
    // blocs de la fiche demandent la lecture a la visite, le premier dans
    // l'ordre de la fiche gagne. Laisser les composants se la disputer
    // donnerait un resultat dependant de l'ordre de montage, c'est-a-dire
    // imprevisible.
    const autoplay = !autoplayTaken && data.autoplayOnVisit === true;
    if (autoplay) autoplayTaken = true;

    attachments.push({
      blockId: block.id,
      tracks,
      label: block.display.label,
      autoplay,
      fadeInMs: borneFondu(data.fadeInMs, FADE_IN_PAR_DEFAUT),
      fadeOutMs: borneFondu(data.fadeOutMs, FADE_OUT_PAR_DEFAUT),
      // Absent pour les blocs anterieurs a la boucle : ils s'arretaient en fin
      // de liste, ils continuent de s'arreter.
      loop: data.loop === true,
    });
  }

  return { contentBlocks, attachments };
}
