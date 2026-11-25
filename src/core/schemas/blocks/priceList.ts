import { z } from "zod";
import { CURRENCY_ORDER } from "../../rules/currency";

/**
 * V3.2-9 (ADR 0110) — bloc « Carte et tarifs » d'un lieu : ce qu'on y sert
 * ou y loue, et à quel prix. C'est la liste FERMÉE des offres du lieu : le
 * moteur y lit un prix (jamais dans une phrase), l'intention d'achat (V3.2-10)
 * ne reconnaît que ces offres, et le modèle ne reçoit que ces prix (V3.2-11).
 *
 * Tirée une fois par le générateur Taverne puis figée (`seed` la rejoue) ;
 * l'auteur peut la corriger à la main, et le wiki l'emporte.
 */

/** Les rubriques de la carte, dans l'ordre d'affichage. Libellés : `messages/*.json`, `blocs.carte.rubriques`. */
export const PRICE_LIST_GROUPS = ["lodging", "starters", "mains", "desserts", "drinks", "other"] as const;
export type PriceListGroup = (typeof PRICE_LIST_GROUPS)[number];

export const zOfferPrice = z.object({
  amount: z.number().min(0).max(1_000_000),
  coin: z.enum(CURRENCY_ORDER),
});
export type OfferPrice = z.infer<typeof zOfferPrice>;

export const zPriceListOffer = z.object({
  /** Stable : un achat (V3.2-10) et une ardoise (V3.2-11) désignent l'offre par cet identifiant. */
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  label: z.string().trim().min(1).max(160),
  group: z.enum(PRICE_LIST_GROUPS),
  price: zOfferPrice,
  /** Facultatif : la fiche de règle d'un objet vendu (une arme, une corde). */
  rule_key: z.string().trim().min(1).max(120).optional(),
});
export type PriceListOffer = z.infer<typeof zPriceListOffer>;

export const zPriceListBlockData = z
  .object({
    __v: z.literal(1),
    /** Clé de l'option de l'axe `wealth` retenue au tirage (`modeste`, `correcte`, `reputee`) ; nulle pour une carte saisie à la main. */
    wealth: z.string().trim().min(1).max(40).nullable(),
    /** Graine du tirage, pour le rejouer ; nulle pour une carte saisie à la main. */
    seed: z.number().int().min(0).max(2 ** 32 - 1).nullable(),
    offers: z.array(zPriceListOffer).max(80),
  })
  .refine((d) => new Set(d.offers.map((o) => o.id)).size === d.offers.length, { message: "Deux offres de même identifiant." });
export type PriceListBlockData = z.infer<typeof zPriceListBlockData>;

export const DEFAULT_PRICE_LIST_BLOCK_DATA: PriceListBlockData = { __v: 1, wealth: null, seed: null, offers: [] };
