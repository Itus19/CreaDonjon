import { z } from "zod";
import { BUILTIN_BACKGROUNDS } from "./builtinBackgrounds";
import { THEME_MODES, type ThemeMode } from "./oklch";

/**
 * Fond par défaut du wiki d'un monde (V3.1-59, ADR 0047) : un fond, un mode
 * de page, un flou, choisis par le MJ et vus de tous, au wiki public comme
 * dans l'onglet Wiki des joueuses. Une fiche qui a son propre fond le garde.
 * Noyau pur : le vocabulaire, la validation, la résolution.
 */

const zThemeMode = z.enum(THEME_MODES as [ThemeMode, ...ThemeMode[]]);
const zBlur = z.number().int().min(0).max(40);

/** Ce que le MJ envoie. Une image de la bibliothèque est désignée par sa ligne `background_images` ; le serveur la copie dans le monde. */
export const zWikiBackgroundInput = z.discriminatedUnion("source", [
  z.object({ source: z.literal("builtin"), key: z.string().min(1).max(100), mode: zThemeMode, blur: zBlur }),
  z.object({ source: z.literal("library"), backgroundImageId: z.string().uuid(), mode: zThemeMode, blur: zBlur }),
  z.object({ source: z.literal("none") }),
  /** V3.1-60 : le même fond, un autre mode ou un autre flou — sans recopier l'image. */
  z.object({ source: z.literal("keep"), mode: zThemeMode, blur: zBlur }),
]);
export type WikiBackgroundInput = z.infer<typeof zWikiBackgroundInput>;

/**
 * Ce qui est stocké dans `worlds.wiki_background`. Pour une copie, la teinte,
 * la saturation et les modes permis sont relevés sur l'image de la
 * bibliothèque au moment de la copie : la page publique ne peut pas lire la
 * bibliothèque (elle est privée), et ces valeurs décrivent l'image copiée,
 * qui ne change plus.
 */
export const zWorldWikiBackground = z.discriminatedUnion("source", [
  z.object({ source: z.literal("builtin"), key: z.string().min(1), mode: zThemeMode, blur: zBlur }),
  z.object({
    source: z.literal("world_asset"),
    assetId: z.string().min(1),
    mode: zThemeMode,
    blur: zBlur,
    hue: z.number(),
    chroma: z.number(),
    availableModes: z.array(zThemeMode).min(1),
  }),
]);
export type WorldWikiBackground = z.infer<typeof zWorldWikiBackground>;

/** Même forme que le fond d'une fiche (`WikiBackground`, `publicShare.ts`). */
export interface WikiBackgroundView {
  imageUrl: string;
  blurPx: number;
  fadeMs: number;
  hue: number;
  chroma: number;
  mode: string;
}

/** Durée du fondu d'entrée : la même que la valeur par défaut d'un bloc Image (`zImageBlockData.fadeMs`). */
const DEFAULT_FADE_MS = 600;

export function checkWikiBackgroundMode(mode: ThemeMode, availableModes: readonly ThemeMode[]): boolean {
  return availableModes.includes(mode);
}

export function findBuiltinBackground(key: string) {
  return BUILTIN_BACKGROUNDS.find((b) => b.slug === key) ?? null;
}

/**
 * Le fond à afficher. `worldAssetImageUrl` : l'adresse par laquelle CE lecteur
 * obtient la copie (route du lien de partage pour un visiteur, route du monde
 * pour un membre) ; sans elle, une copie ne s'affiche pas.
 */
export function worldWikiBackgroundView(setting: WorldWikiBackground | null, worldAssetImageUrl: string | null): WikiBackgroundView | null {
  if (!setting) return null;
  if (setting.source === "builtin") {
    const builtin = findBuiltinBackground(setting.key);
    if (!builtin) return null;
    return { imageUrl: builtin.backdropUrl, blurPx: setting.blur, fadeMs: DEFAULT_FADE_MS, hue: builtin.hue, chroma: builtin.chroma, mode: setting.mode };
  }
  if (!worldAssetImageUrl) return null;
  return { imageUrl: worldAssetImageUrl, blurPx: setting.blur, fadeMs: DEFAULT_FADE_MS, hue: setting.hue, chroma: setting.chroma, mode: setting.mode };
}

/** Relit la colonne : un contenu illisible vaut « aucun fond », jamais une erreur de page. */
export function parseWorldWikiBackground(raw: unknown): WorldWikiBackground | null {
  if (raw === null || raw === undefined) return null;
  const parsed = zWorldWikiBackground.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Le fond d'une page du wiki : celui de la fiche s'il existe, sinon celui du monde, sinon aucun (ADR 0047). */
export function chooseWikiBackground<T>(ficheBackground: T | null, worldBackground: T | null): T | null {
  return ficheBackground ?? worldBackground;
}

/**
 * Ce que l'écran Publication montre du réglage enregistré (V3.1-60) : la
 * vignette choisie dans la galerie (`ref`, la même clé que la galerie de
 * V3.1-58), et de quoi peindre l'aperçu. Une copie (`world_asset`) n'a pas de
 * vignette — elle ne vient plus de la bibliothèque — mais garde son image.
 */
export interface PublicationBackgroundState {
  ref: string | null;
  imageUrl: string;
  hue: number;
  chroma: number;
  availableModes: ThemeMode[];
  mode: ThemeMode;
  blur: number;
}

export function publicationBackgroundState(setting: WorldWikiBackground | null, worldAssetImageUrl: string | null): PublicationBackgroundState | null {
  if (!setting) return null;
  if (setting.source === "builtin") {
    const builtin = findBuiltinBackground(setting.key);
    if (!builtin) return null;
    return {
      ref: `builtin:${builtin.slug}`,
      imageUrl: builtin.backdropUrl,
      hue: builtin.hue,
      chroma: builtin.chroma,
      availableModes: builtin.availableModes,
      mode: setting.mode,
      blur: setting.blur,
    };
  }
  if (!worldAssetImageUrl) return null;
  return { ref: null, imageUrl: worldAssetImageUrl, hue: setting.hue, chroma: setting.chroma, availableModes: setting.availableModes, mode: setting.mode, blur: setting.blur };
}

/** La clé d'une vignette de la galerie (« builtin:… » ou l'id d'une image de la bibliothèque) devient la requête du MJ. */
export function wikiBackgroundInputFromRef(ref: string, mode: ThemeMode, blur: number): WikiBackgroundInput {
  if (ref.startsWith("builtin:")) return { source: "builtin", key: ref.slice("builtin:".length), mode, blur };
  return { source: "library", backgroundImageId: ref, mode, blur };
}

/**
 * V3.1-60 — garder le fond enregistré et n'en changer que le mode et le flou.
 * Une copie garde la même image (aucune recopie) ; le mode reste contrôlé
 * contre ceux que ce fond permet.
 */
export function retuneWorldWikiBackground(
  current: WorldWikiBackground | null,
  mode: ThemeMode,
  blur: number
): { ok: true; setting: WorldWikiBackground } | { ok: false; reason: "not_found" | "invalid_mode" } {
  if (!current) return { ok: false, reason: "not_found" };
  const availableModes = current.source === "builtin" ? findBuiltinBackground(current.key)?.availableModes : current.availableModes;
  if (!availableModes) return { ok: false, reason: "not_found" };
  if (!checkWikiBackgroundMode(mode, availableModes)) return { ok: false, reason: "invalid_mode" };
  return { ok: true, setting: { ...current, mode, blur } };
}
