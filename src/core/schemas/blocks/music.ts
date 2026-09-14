import { z } from "zod";
import { detectProvider } from "@/src/core/music/embedUrl";

/**
 * Bloc `music` (V2-G3) : une "station" est un bloc nomme (son propre
 * `display.label`, comme tout bloc) portant une liste de pistes — chacune
 * un lien externe vers une plateforme sous licence (Spotify, SoundCloud,
 * YouTube), jamais un fichier heberge par nous. Grouper plusieurs pistes
 * sous un nom choisi par la personne elle-meme (jamais une categorie
 * fournie par l'application, jamais une marque de franchise) est ce qui
 * permet plusieurs "stations" sur une meme fiche, sans wiki-liens-et-personnages
 * lourds : un bloc de plus, comme les autres.
 *
 * Le fournisseur n'est jamais stocke : toujours redetecte depuis l'URL a
 * la validation (`detectProvider`) — un champ `provider` fourni par le
 * client n'aurait aucune prise s'il ne correspondait pas a l'URL reelle,
 * simplement en ne le stockant jamais.
 */
const zMusicTrack = z
  .object({
    id: z.string().min(1),
    url: z
      .string()
      .url()
      .refine((u) => detectProvider(u) !== null, {
        message: "Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptés.",
      }),
    title: z.string().max(200).optional(),
    /**
     * Bornes de lecture (V2.1-6, lot 2,
     * docs/adr/0022-lecteur-youtube-pilote.md) : sauter une intro parlee,
     * isoler un passage. **YouTube seulement** — ni Spotify ni SoundCloud ne
     * savent les honorer, et l'editeur le dit a cote du lien concerne plutot
     * que d'afficher un reglage sans effet. Plafond a 24 h : au-dela, c'est
     * une faute de frappe, pas une piste.
     */
    startSeconds: z.number().int().min(0).max(86400).optional(),
    endSeconds: z.number().int().min(1).max(86400).optional(),
  })
  .refine((t) => t.endSeconds === undefined || t.startSeconds === undefined || t.endSeconds > t.startSeconds, {
    message: "La fin doit venir après le début.",
    path: ["endSeconds"],
  });
export type MusicTrack = z.infer<typeof zMusicTrack>;

export const zMusicBlockData = z
  .object({
    __v: z.literal(1),
    tracks: z.array(zMusicTrack).max(50),
    /**
     * V2.1-6 : sur les pages de lecture, le bloc ne s'affiche plus du tout —
     * il pose seulement un bouton discret a cote du nom de la fiche. Ce
     * drapeau decide si, en plus, la premiere piste demarre d'elle-meme a
     * l'arrivee sur la fiche. `false` par defaut, et pour les blocs deja en
     * base (champ absent) : un wiki qui se met a jouer du son sans qu'on
     * l'ait demande est une mauvaise surprise, c'est un choix qu'on coche.
     */
    autoplayOnVisit: z.boolean().default(false),
    /**
     * Fondu entrant / sortant, en millisecondes (V2.1-6, lot 2). **YouTube
     * seulement** : le volume d'une iframe d'un autre domaine ne se touche
     * pas, seule l'API de YouTube l'expose — et celle de Spotify, non (ADR
     * 0022). Defaut non nul, comme le `fadeMs` du bloc image : c'est
     * precisement le « amener les musiques doucement » demande, il n'aurait
     * pas de sens de livrer le reglage eteint. Plafond a 5 s — au-dela, on
     * n'entend plus un fondu mais un long silence.
     */
    fadeInMs: z.number().int().min(0).max(5000).default(1500),
    fadeOutMs: z.number().int().min(0).max(5000).default(1500),
  })
  .strict();
export type MusicBlockData = z.infer<typeof zMusicBlockData>;
