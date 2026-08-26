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
const zMusicTrack = z.object({
  id: z.string().min(1),
  url: z
    .string()
    .url()
    .refine((u) => detectProvider(u) !== null, {
      message: "Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptes.",
    }),
  title: z.string().max(200).optional(),
});
export type MusicTrack = z.infer<typeof zMusicTrack>;

export const zMusicBlockData = z
  .object({
    __v: z.literal(1),
    tracks: z.array(zMusicTrack).max(50),
  })
  .strict();
export type MusicBlockData = z.infer<typeof zMusicBlockData>;
