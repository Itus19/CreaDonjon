import { z } from "zod";

/** Cadrage par defaut d'UN bloc carte (retour utilisateur, Lot I : "je dois pouvoir centrer la vue par defaut sur une zone differente dans chacun des blocs map que je fais") — coordonnees normalisees (0-1) + niveau de zoom, jamais des pixels (casserait a chaque remplacement d'image). */
export const zMapView = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  zoom: z.number().min(0.1).max(20),
});
export type MapView = z.infer<typeof zMapView>;

const DEFAULT_VIEW: MapView = { x: 0.5, y: 0.5, zoom: 1 };

/**
 * Bloc `map` (Lot I, ADR 0017) — propriétaire OU référent, jamais les
 * deux (décision 1) :
 * - "own" : porte l'image (un `asset`, plein format + vignette) ; les
 *   punaises/zones/couches (phases C/D/E, tables à part — jamais dans ce
 *   JSON, elles ont besoin de leur propre visibilité RLS) appartiennent à
 *   CE bloc.
 * - "ref" : ne porte ni image ni punaises/zones — pointe vers un bloc
 *   propriétaire (`sourceBlockId`) avec son propre cadrage. Modifier une
 *   punaise du bloc source la modifie partout où elle est référencée.
 *
 * Phase B (ce fichier) : mode "own" seul câblé côté UI ; le mode "ref"
 * existe déjà dans le schéma pour ne pas casser les données de la phase F₁
 * qui l'active vraiment.
 */
export const zMapBlockData = z.discriminatedUnion("mode", [
  z.object({
    __v: z.literal(1),
    mode: z.literal("own"),
    assetId: z.string().nullable(),
    thumbnailAssetId: z.string().nullable(),
    defaultView: zMapView,
  }),
  z.object({
    __v: z.literal(1),
    mode: z.literal("ref"),
    sourceBlockId: z.string(),
    defaultView: zMapView,
  }),
]);
export type MapBlockData = z.infer<typeof zMapBlockData>;

export const DEFAULT_MAP_BLOCK_DATA: MapBlockData = {
  __v: 1,
  mode: "own",
  assetId: null,
  thumbnailAssetId: null,
  defaultView: DEFAULT_VIEW,
};
