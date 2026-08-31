import { z } from "zod";
import { detectProvider } from "@/src/core/music/embedUrl";

/** Ajout d'une station radio de monde (MJ uniquement, RLS `world_radio_stations_insert`) — meme verification de lien que le bloc `music` d'une fiche. */
export const addRadioStationSchema = z.object({
  label: z.string().trim().min(1, "Le nom est requis.").max(80),
  url: z
    .string()
    .trim()
    .min(1, "Le lien est requis.")
    .refine((url) => detectProvider(url) !== null, { message: "Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptés." }),
});
