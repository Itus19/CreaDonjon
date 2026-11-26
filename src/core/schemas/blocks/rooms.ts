import { z } from "zod";

/**
 * V3.2-19 — bloc « Pièces » d'un lieu : les espaces d'un bâtiment (la
 * cuisine, les chambres, la cave), chacun avec deux ou trois phrases. Une
 * pièce n'a pas de page à elle : elle vit dans la page de son lieu
 * (décision de l'auteur, 25 novembre 2026).
 *
 * La visibilité est celle du bloc : une pièce secrète va dans un second
 * bloc « Pièces » réservé au MJ, filtré côté serveur comme tout bloc
 * (règle absolue 5). La narration solo y lit où l'on peut aller et ce
 * qu'on y voit ; une pièce inventée par l'IA et validée par le moteur s'y
 * ajoute (V3.2-19).
 */
/**
 * ME-4 (specs/meteo.md §6) — ce que la météo atteint dans une pièce : dehors
 * (une cour), à l'abri (un porche, une écurie ouverte), dedans (une salle
 * fermée). Facultative et sans changer `__v` : absente, une pièce est
 * dedans.
 */
export const ROOM_EXPOSURES = ["outdoor", "sheltered", "indoor"] as const;
export type RoomExposure = (typeof ROOM_EXPOSURES)[number];

export const zRoom = z.object({
  /** Stable, dérivé du nom à la création : la scène désigne la pièce par lui. */
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(600),
  exposure: z.enum(ROOM_EXPOSURES).optional(),
});
export type Room = z.infer<typeof zRoom>;

export const zRoomsBlockData = z
  .object({
    __v: z.literal(1),
    rooms: z.array(zRoom).max(40),
    /** ME-4 — l'exposition de l'espace principal du lieu, hors de toute pièce. Absente : déduite (`exposureHere`). */
    main_exposure: z.enum(ROOM_EXPOSURES).optional(),
  })
  .refine((d) => new Set(d.rooms.map((r) => r.id)).size === d.rooms.length, { message: "Deux pièces de même identifiant." });
export type RoomsBlockData = z.infer<typeof zRoomsBlockData>;

export const DEFAULT_ROOMS_BLOCK_DATA: RoomsBlockData = { __v: 1, rooms: [] };
