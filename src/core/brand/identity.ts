import { z } from "zod";

/**
 * Identité de l'application (V3.1-84, ADR 0061) : le nom, la phrase d'accueil
 * et le logo que voient tous les visiteurs (écran-titre, rail, onglet du
 * navigateur). Noyau pur : le vocabulaire et les validations ; la lecture et
 * l'écriture vivent dans `src/server/`.
 */

/** Les douze logos au trait (décision de l'auteur, 9 octobre). Ce sont des SVG du code (V3.1-86, 88), jamais des données : seule leur clé est stockée. */
export const APP_LOGO_KEYS = [
  "d20",
  "dungeon_door",
  "dragon_eye",
  "dice_cup",
  "quill_die",
  "key",
  "grimoire",
  "tower",
  "maze",
  "scale",
  "lair",
  "map",
] as const;
export type AppLogoKey = (typeof APP_LOGO_KEYS)[number];

export const APP_NAME_MAX = 32;
export const APP_TAGLINE_MAX = 80;

/** Ce qui vaut tant que le superadmin n'a rien enregistré. Les mêmes textes vivent dans `messages/` pour l'interface. */
export const DEFAULT_APP_IDENTITY = { name: "Antre Nous", tagline: "Le repaire de ta table.", logoKey: "d20" } as const satisfies {
  name: string;
  tagline: string;
  logoKey: AppLogoKey;
};

/** Saisie du superadmin : nom obligatoire, phrase facultative, une des douze clés. */
export const zAppIdentityInput = z.object({
  name: z.string().trim().min(1).max(APP_NAME_MAX),
  tagline: z.string().trim().max(APP_TAGLINE_MAX),
  logoKey: z.enum(APP_LOGO_KEYS),
});
export type AppIdentityInput = z.infer<typeof zAppIdentityInput>;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Le VRAI type d'une image téléversée, lu dans ses premiers octets, jamais
 * dans son extension ni dans le type annoncé par le navigateur : un SVG peut
 * porter du script, et renommé en `.png` il passerait un contrôle de nom.
 * Seuls PNG et WebP sont acceptés pour un logo ; tout le reste rend `null`.
 */
export function detectRasterImageType(bytes: Uint8Array): "image/png" | "image/webp" | null {
  if (bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
