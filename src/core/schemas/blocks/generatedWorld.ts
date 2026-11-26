import { z } from "zod";
import { zAbstractWorld } from "../../worldgen/world";

/** Une fiche du wiki, par la même forme que `zBlockReference` : l'import d'un monde la recale (`remapEntityIds`). */
const zEntityRef = z.object({ kind: z.literal("entity"), id: z.string().min(1) });

/**
 * G-7b (ADR 0109) — « Monde généré » : toute la carte d'un monde créé depuis
 * Azgaar, gardée pour que ses villes naissent à la découverte (choix de
 * l'auteur, 26 novembre 2026). Posé une fois, à la création du monde, sur la
 * fiche système de la frise (réservée au MJ par la RLS), en visibilité MJ.
 *
 * `places` et `factions` disent quelles villes et quels États ont déjà leur
 * page : une ville n'en reçoit jamais deux.
 */
export const zGeneratedWorldBlockData = z
  .object({
    __v: z.literal(1),
    world: zAbstractWorld,
    places: z.array(z.object({ siteId: z.string().min(1), entity: zEntityRef })).default([]),
    factions: z.array(z.object({ stateId: z.string().min(1), entity: zEntityRef })).default([]),
  })
  .superRefine((data, ctx) => {
    const sites = new Set(data.world.sites.map((s) => s.id));
    const states = new Set(data.world.states.map((s) => s.id));
    const placed = data.places.map((p) => p.siteId);
    if (new Set(placed).size !== placed.length) ctx.addIssue({ code: "custom", message: "Une ville a deux pages" });
    if (placed.some((id) => !sites.has(id))) ctx.addIssue({ code: "custom", message: "Une page renvoie à une ville inconnue" });
    if (data.factions.some((f) => !states.has(f.stateId))) ctx.addIssue({ code: "custom", message: "Une faction renvoie à un État inconnu" });
  });
export type GeneratedWorldBlockData = z.infer<typeof zGeneratedWorldBlockData>;

/** Valide mais jamais posé à la main (hors palette) : seul l'import d'une carte crée ce bloc, avec son vrai monde. */
export const DEFAULT_GENERATED_WORLD_BLOCK_DATA: GeneratedWorldBlockData = {
  __v: 1,
  world: {
    __v: 1,
    seed: 0,
    presentYear: 0,
    cultures: [],
    states: [],
    sites: [
      {
        id: "lieu",
        name: "Lieu",
        stateId: null,
        cultureId: null,
        notable: false,
        settlement: { __v: 1, seed: 0, population: 0, zone: "bourg", wealth: "modeste", biome: "grassland", peoples: [], trades: [] },
      },
    ],
    links: [],
    anchors: [],
  },
  places: [],
  factions: [],
};
